"""ARIA ins/chat 코파일럿 — 온톨로지 그라운딩 + 내부 툴 + 선택적 알파렌즈 MCP.

플레이북(treasurer-ontology/patterns/planning_patterns.json) 준수:
- ontology_as_grounding: L3 JSON(aria-ontology-l3.json)을 시스템 프롬프트로 직렬화
- numbers_from_db_words_from_llm: 수치는 내부 툴(SQL)에서만, LLM 은 서술·추론
- agent_step_trace_ui: 툴콜·사고 요약을 SSE 로 방출 (과정=상품)
- external_tools_as_mcp: '+ 알파렌즈' 모드에서 argo MCP 툴을 같은 루프에 합류
- human_in_the_loop_write: modify_record 는 쓰기 — reasoning 필수

SSE 이벤트 계약은 Gemini 구현과 동일하게 유지한다(status/thinking/tool_call/
tool_result/answer/done). MCP 턴은 mcp_tool_call/mcp_tool_result 를 추가로 낸다.
"""

import asyncio
import base64
import inspect
import json
import logging
from pathlib import Path
from typing import Any, AsyncGenerator

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.agent.tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 10

# argo MCP 는 툴이 100개고 대부분 재보험과 무관하다(암호화폐·VCP·CANSLIM 등).
# 전량 노출 시 턴당 입력 54,456 토큰 → allowlist 15개로 19,638 토큰(63.9% 절감).
# L3 온톨로지 external_tools.allowlist 와 같은 목록을 유지할 것.
ARGO_ALLOWED_TOOLS = [
    "news_search",
    "resolve_entity",
    "company_profile",
    "financial_query",
    "dart_disclosure_search",
    "dart_company_overview",
    "dart_financial_indicators",
    "dart_audit_opinion",
    "opensanctions_search",
    "opensanctions_match",
    "opensanctions_entity",
    "macro_data",
    "fred_series",
    "fred_treasury",
    "economic_calendar",
]

_BASE_SYSTEM = """당신은 재보험 중개사의 AI 정산 분석가 ARIA 입니다.

## 절대 규칙
1. **수치는 반드시 툴에서.** 기억이나 추측으로 숫자를 말하지 않습니다. 모든 금액·건수·비율은
   sql_query 등 내부 툴의 실제 결과에서만 가져옵니다. 툴 없이 수치를 답하면 실패입니다.
2. **조용한 정규화 금지.** 아래 온톨로지의 데이터 품질 함정을 적용했다면(예: 'Kwon'을 KRW로 병합,
   reinsurer='Unknown' 제외) 그 처리를 답변에 반드시 밝힙니다. 몇 건을 제외했는지도 씁니다.
3. **쓰기는 신중히.** modify_record 는 데이터를 바꿉니다. 사용자가 명시적으로 변경을 요청한
   경우에만 쓰고, 무엇을 왜 바꾸는지 reasoning 에 적습니다.
4. 쿼리가 실패하면 스키마를 다시 확인하고 다른 접근을 시도합니다. 실패를 숨기지 않습니다.

## 작업 순서
불확실하면 get_table_sample / get_distinct_values 로 실제 스키마·코드값을 먼저 확인한 뒤
sql_query 로 집계합니다. 아래 온톨로지에 이미 있는 내용은 다시 조회하지 않아도 됩니다.

## 답변
한국어로, 결론부터. 실제 수치와 함께 간결하게. 근거가 된 처리(제외·병합·정본 선택)를 명시합니다.
표는 마크다운 표(GFM)로 씁니다 — 화면에서 실제 표로 렌더됩니다.
"""

# 서버측 code_execution(파이썬 샌드박스, matplotlib·pandas 사전설치) — 차트 생성용.
# 수치 자체는 SQL 툴에서 나온다. 파이썬은 '이미 확보한 수치를 그리는' 용도이지
# 집계 수단이 아니다 (numbers_from_db_words_from_llm).
_CODE_TOOL = {"type": "code_execution_20260120", "name": "code_execution"}

_CHART_SYSTEM = """
## 차트 (code_execution)
추이·비교·구성처럼 그림이 이해를 돕는 질문이면 code_execution(파이썬)으로 차트를 그립니다.

**수치는 SQL 툴로 먼저 확보하고, 그 값을 코드에 리터럴로 넣어 그립니다.** 파이썬으로 집계하지 않습니다.

**아래 형식을 그대로 쓰세요.** 두 가지를 어기면 차트가 사용자에게 전달되지 않습니다:
① 저장 위치는 반드시 `$OUTPUT_DIR` — 다른 경로(CWD, /tmp)에 저장하면 파일이 회수되지 않습니다.
② 한 번의 bash 호출로 작성과 실행을 동시에 — 스크립트를 `.py` 로 쓴 뒤 별도 호출로 실행하려 하면
   턴이 끊겨 실행되지 않은 채 끝납니다.

```bash
python3 - <<'EOF'
import os
import matplotlib
matplotlib.use('Agg')
matplotlib.rcParams['font.family'] = 'WenQuanYi Zen Hei'   # 없으면 한글 전부 깨짐
matplotlib.rcParams['axes.unicode_minus'] = False
import matplotlib.pyplot as plt

# ... 여기서 그리기 (수치는 SQL 결과를 리터럴로) ...

out = os.path.join(os.environ['OUTPUT_DIR'], 'chart.png')
plt.savefig(out, dpi=130, bbox_inches='tight')
print('saved', out)
EOF
```

- 파일명은 `chart.png` 하나로 고정합니다(재시도 시 덮어쓰기).
- 실행 stdout 으로 저장을 확인한 뒤에만 답변에 `![설명](chart.png)` 을 씁니다.
  실패했으면 이미지 문법을 쓰지 말고, 표로만 답하고 차트 실패 사실을 밝힙니다.
- 금액은 억/조 단위로 축을 축약해 읽기 쉽게 만듭니다. 통화가 섞였으면 KRW 환산 기준만 그리고 그 사실을 밝힙니다.
- 차트를 그렸으면 답변 본문에도 핵심 수치를 글로 남깁니다 — 그림만 남기지 않습니다.
"""

_MCP_SYSTEM = """
## + 알파렌즈 모드 (외부 툴 활성)
argo 외부 툴을 함께 쓸 수 있습니다. 용도는 **내부 정본과의 교차대조**입니다.
- 내부 DB 가 답할 수 있는 것은 내부 툴로 답합니다. 외부 툴로 내부 수치를 대체하지 않습니다.
- 외부 툴은 내부에 없는 정보(제재 여부, 상대방 재무·감사의견, 뉴스 정황, 환율·매크로)에 씁니다.
- 교차대조 결과는 "내부 기록 X / 외부 신호 Y" 형태로 둘을 나란히 제시하고, 부합하는지 밝힙니다.
- 외부 출처는 근거를 함께 답변에 남깁니다.
"""


def _find_l3() -> Path | None:
    """L3 온톨로지 위치 탐색.

    레포에선 `<repo>/ontology/`지만 컨테이너는 빌드 컨텍스트가 `backend` 하나라
    그 위가 없다. 고정 인덱스 대신 env → 조상 경로 순으로 찾고, 없으면 None.
    """
    env = (settings.aria_l3_path or "").strip()
    if env:
        p = Path(env)
        if p.is_file():
            return p
        logger.warning("ARIA_L3_PATH 가 가리키는 파일 없음: %s", p)

    name = "aria-ontology-l3.json"
    for anc in Path(__file__).resolve().parents:
        c = anc / "ontology" / name
        if c.is_file():
            return c
    c = Path("/ontology") / name
    return c if c.is_file() else None


_L3_PATH = _find_l3()


def _ontology_context() -> str:
    if not _L3_PATH:
        logger.warning("L3 온톨로지를 찾지 못했습니다 — 그라운딩 없이 동작합니다")
        return "\n\n(온톨로지 파일을 찾지 못했습니다. 스키마는 툴로 직접 확인하세요.)"
    try:
        raw = json.loads(_L3_PATH.read_text(encoding="utf-8"))
    except Exception as e:  # 손상된 파일이 챗 전체를 죽이지 않게
        logger.error("L3 온톨로지 파싱 실패 %s: %s", _L3_PATH, e)
        return "\n\n(온톨로지 로드 실패. 스키마는 툴로 직접 확인하세요.)"
    return (
        "\n\n## 도메인 온톨로지 (L3 정본 — 이 내용을 신뢰하고, 수치만 툴로 확인)\n"
        + json.dumps(raw, ensure_ascii=False, indent=1)
    )


_client: anthropic.AsyncAnthropic | None = None


def _anthropic() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        # 한 대화가 툴콜 여러 턴에 걸치므로 중간에 529(overloaded)가 뜨면 분석이
        # 통째로 날아간다. SDK 기본 재시도 2회는 부족해서 올린다(지수 백오프).
        _client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key, max_retries=5
        )
    return _client


def _anthropic_tools() -> list[dict]:
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["parameters"],
        }
        for t in TOOL_DEFINITIONS
    ]


def _summarize(result: dict) -> str:
    """툴 결과를 트레이스용 한 줄로."""
    if not result.get("success"):
        return f"Error: {result.get('error', 'unknown')}"
    if "data" in result:
        return f"{result.get('row_count', len(result['data']))} rows"
    if "total_rows" in result:
        return f"{result.get('table')}: {result['total_rows']} rows, {len(result.get('columns', []))} cols"
    if "values" in result:
        return f"{len(result['values'])} distinct values"
    return json.dumps(result, ensure_ascii=False, default=str)[:200]


async def _collect_charts(client: Any, block: Any) -> list[dict]:
    """code_execution 결과 블록에서 생성된 이미지를 Files API 로 내려받아 base64 임베드.

    샌드박스가 만든 파일은 file_id 로만 돌아오므로 별도 다운로드가 필요하다.
    이미지가 아닌 산출물(로그·csv)은 건너뛴다.
    """
    out: list[dict] = []
    content = getattr(block, "content", None)
    items = getattr(content, "content", None)
    if items is None and isinstance(content, list):
        items = content  # 일부 결과 타입은 content 가 곧 리스트다
    logger.info(
        "code_exec result: content_type=%s rc=%s items=%s stdout=%r stderr=%r",
        getattr(content, "type", None),
        getattr(content, "return_code", None),
        [(getattr(i, "type", None), getattr(i, "file_id", None)) for i in (items or [])],
        str(getattr(content, "stdout", ""))[:200],
        str(getattr(content, "stderr", ""))[:200],
    )
    for it in items or []:
        if getattr(it, "type", "") not in (
            "bash_code_execution_output",
            "code_execution_output",
        ):
            continue
        fid = getattr(it, "file_id", None)
        if not fid:
            continue
        try:
            meta = await client.beta.files.retrieve_metadata(fid)
            mime = getattr(meta, "mime_type", "") or "image/png"
            if not mime.startswith("image/"):
                continue
            resp = await client.beta.files.download(fid)
            # async 클라이언트의 .read() 는 코루틴을 돌려준다 — 동기/비동기 양쪽 대응.
            raw = resp.read()
            if inspect.isawaitable(raw):
                raw = await raw
            out.append(
                {
                    "name": getattr(meta, "filename", "chart.png"),
                    "mime": mime,
                    "b64": base64.b64encode(raw).decode(),
                }
            )
        except Exception:  # 차트 회수 실패가 답변 전체를 죽이지 않게
            logger.exception("차트 다운로드 실패 (file_id=%s)", fid)
    return out


_RETRYABLE = ("overloaded_error", "rate_limit_error", "api_error")


def _error_kind(exc: Exception) -> str:
    """예외 본문에서 Anthropic 에러 타입을 뽑는다.

    스트리밍 중간에 오는 overloaded_error 는 HTTP 200 으로 도착하므로 SDK 의
    상태코드 기반 재시도가 걸리지 않는다. 본문 타입을 봐야 재시도 판단이 된다.
    """
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict) and err.get("type"):
            return str(err["type"])
    return ""


async def _stream_turn(client: Any, **kwargs: Any) -> Any:
    """한 턴을 스트리밍으로 받아 완성 메시지를 돌려준다. 과부하는 백오프 재시도."""
    delay = 2.0
    last: Exception | None = None
    for attempt in range(1, 5):
        try:
            async with client.beta.messages.stream(**kwargs) as stream:
                return await stream.get_final_message()
        except Exception as e:
            kind = _error_kind(e)
            if kind not in _RETRYABLE:
                raise
            last = e
            logger.warning(
                "%s — %.0fs 후 재시도 (%s/4)", kind, delay, attempt
            )
            await asyncio.sleep(delay)
            delay *= 2
    raise last  # type: ignore[misc]


def _mcp_result_snippet(block: Any) -> str:
    content = getattr(block, "content", None)
    if isinstance(content, list) and content:
        return str(getattr(content[0], "text", content[0]))[:400]
    return str(content)[:400] if content else ""


async def run_agent(
    message: str, db: AsyncSession, use_mcp: bool = False
) -> AsyncGenerator[dict, None]:
    """에이전트 루프. SSE 이벤트를 순차 방출한다."""
    if not settings.anthropic_api_key:
        yield {
            "event": "answer",
            "data": {"content": "ANTHROPIC_API_KEY 가 설정되지 않아 채팅을 사용할 수 없습니다."},
        }
        yield {"event": "done", "data": {}}
        return

    mcp_on = bool(use_mcp and settings.argo_mcp_url)
    if use_mcp and not settings.argo_mcp_url:
        logger.warning("use_mcp=true 이지만 ARGO_MCP_URL 미설정 — 내부 툴만 사용")

    client = _anthropic()
    system = (
        _BASE_SYSTEM
        + _CHART_SYSTEM
        + (_MCP_SYSTEM if mcp_on else "")
        + _ontology_context()
    )
    # 로컬 DB 툴 + 서버측 파이썬 샌드박스(차트용)
    tools: list[dict[str, Any]] = _anthropic_tools() + [_CODE_TOOL]

    # argo 외부 툴 서비스(MCP)가 켜져 있으면 connector 로 붙인다 — Claude 가 argo.*
    # 툴과 로컬 툴을 한 루프에서 조합. 서버측 실행이라 우리 컨테이너는 관여하지 않는다.
    extra: dict[str, Any] = {}
    if mcp_on:
        tools.append(
            {
                "type": "mcp_toolset",
                "mcp_server_name": "argo",
                # allowlist 모드. configs 는 툴명을 키로 하는 **객체** (배열이면 400).
                "default_config": {"enabled": False},
                "configs": {n: {"enabled": True} for n in ARGO_ALLOWED_TOOLS},
            }
        )
        srv: dict[str, Any] = {
            "type": "url",
            "name": "argo",
            "url": settings.argo_mcp_url,
        }
        if settings.argo_mcp_token:
            srv["authorization_token"] = settings.argo_mcp_token
        extra = {"betas": ["mcp-client-2025-11-20"], "mcp_servers": [srv]}

    messages: list[dict[str, Any]] = [{"role": "user", "content": message}]

    yield {
        "event": "status",
        "data": {"message": "+ 알파렌즈 분석 시작..." if mcp_on else "분석 시작..."},
    }

    for iteration in range(1, MAX_ITERATIONS + 1):
        try:
            # 스트리밍으로 받아 HTTP 타임아웃을 피하고, 턴 단위로는 완성 메시지를 쓴다.
            resp = await _stream_turn(
                client,
                model=settings.aria_chat_model,
                max_tokens=16000,
                system=system,
                messages=messages,
                tools=tools,
                thinking={"type": "adaptive", "display": "summarized"},
                output_config={"effort": settings.aria_chat_effort},
                **extra,
            )
        except Exception as e:
            kind = _error_kind(e)
            logger.exception("Anthropic 호출 실패 (kind=%s)", kind or "unknown")
            msg = (
                "모델 서비스가 계속 과부하 상태입니다. 잠시 후 다시 시도해 주세요."
                if kind in _RETRYABLE
                else "모델 호출에 실패했습니다. 로그를 확인해 주세요."
            )
            yield {"event": "answer", "data": {"content": msg}}
            break

        # 안전 분류기가 거절하면 content 가 비거나 부분적이다 — 먼저 확인.
        if resp.stop_reason == "refusal":
            detail = getattr(resp, "stop_details", None)
            cat = getattr(detail, "category", None)
            yield {
                "event": "answer",
                "data": {
                    "content": f"이 요청은 안전 정책으로 처리할 수 없습니다{f' ({cat})' if cat else ''}."
                },
            }
            break

        logger.info(
            "turn %s stop=%s blocks=%s out_tokens=%s",
            iteration,
            resp.stop_reason,
            [getattr(b, "type", "?") for b in resp.content],
            getattr(resp.usage, "output_tokens", None),
        )

        assistant_blocks: list[Any] = []
        tool_uses: list[Any] = []
        texts: list[str] = []

        for b in resp.content:
            assistant_blocks.append(b)
            bt = getattr(b, "type", "")
            if bt == "thinking":
                text = (getattr(b, "thinking", "") or "").strip()
                if text:
                    yield {
                        "event": "thinking",
                        "data": {"step": iteration, "content": text},
                    }
            elif bt == "text":
                if b.text:
                    texts.append(b.text)
            elif bt == "tool_use":
                tool_uses.append(b)
            elif bt == "server_tool_use":  # code_execution 이 돌린 코드
                inp = getattr(b, "input", None) or {}
                # 키는 툴에 따라 다르다: bash 는 command, text_editor 는 file_text.
                code = ""
                if isinstance(inp, dict):
                    code = str(inp.get("file_text") or inp.get("command") or inp.get("code") or "")
                if code:
                    yield {
                        "event": "code",
                        "data": {"step": iteration, "tool": "code_execution", "code": code[:2000]},
                    }
            elif bt in (
                "bash_code_execution_tool_result",
                "code_execution_tool_result",
                "text_editor_code_execution_tool_result",
            ):
                for im in await _collect_charts(client, b):
                    yield {"event": "image", "data": {"step": iteration, **im}}
                # 샌드박스 실패는 조용히 넘기지 않는다 — 트레이스에 남긴다.
                res = getattr(b, "content", None)
                rc = getattr(res, "return_code", None)
                err = (getattr(res, "stderr", "") or "").strip()
                if rc not in (None, 0) or err:
                    yield {
                        "event": "tool_result",
                        "data": {
                            "step": iteration,
                            "tool": "code_execution",
                            "success": False,
                            "summary": f"exit={rc} {err[:300]}",
                        },
                    }
            elif bt == "mcp_tool_use":  # argo 원격 툴 호출 (서버측 실행)
                yield {
                    "event": "mcp_tool_call",
                    "data": {
                        "step": iteration,
                        "server": getattr(b, "server_name", "argo"),
                        "tool": b.name,
                        "params": dict(getattr(b, "input", {}) or {}),
                    },
                }
            elif bt == "mcp_tool_result":
                yield {
                    "event": "mcp_tool_result",
                    "data": {
                        "step": iteration,
                        "success": not getattr(b, "is_error", False),
                        "summary": _mcp_result_snippet(b),
                    },
                }

        # 어시스턴트 턴은 블록을 **그대로** 되돌려준다 (thinking 서명 포함).
        messages.append({"role": "assistant", "content": assistant_blocks})

        # 서버측 code_execution 루프가 자체 한계에 닿으면 pause_turn 으로 멈춘다.
        # 로컬 툴콜이 없어도 여기서 break 하면 차트를 그리다 만 채 끝난다 —
        # 어시스턴트 턴만 붙여 재전송하면 서버가 이어서 실행한다.
        if resp.stop_reason == "pause_turn":
            logger.info("pause_turn — code_execution 이어서 실행 (iteration=%s)", iteration)
            continue

        if not tool_uses:
            answer = "\n".join(texts).strip()
            yield {
                "event": "answer",
                "data": {"content": answer or "응답을 생성할 수 없습니다."},
            }
            break

        # 로컬 툴 실행 — 결과는 하나의 user 메시지에 모아 되돌려준다.
        tool_results: list[dict[str, Any]] = []
        for tu in tool_uses:
            params = dict(tu.input or {})
            reasoning = params.pop("reasoning", None)
            if reasoning:
                yield {
                    "event": "thinking",
                    "data": {"step": iteration, "content": reasoning},
                }

            yield {
                "event": "tool_call",
                "data": {"step": iteration, "tool": tu.name, "params": params},
            }

            # reasoning 은 트레이스용이지만 툴 스키마의 일부다 — 원본 input 을 그대로 넘긴다.
            result = await execute_tool(tu.name, dict(tu.input or {}), db)

            yield {
                "event": "tool_result",
                "data": {
                    "step": iteration,
                    "tool": tu.name,
                    "success": result.get("success", False),
                    "summary": _summarize(result),
                },
            }

            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": json.dumps(result, ensure_ascii=False, default=str)[:8000],
                    "is_error": not result.get("success", False),
                }
            )

        messages.append({"role": "user", "content": tool_results})
    else:
        yield {
            "event": "answer",
            "data": {"content": "최대 반복 횟수에 도달했습니다. 질문을 더 구체적으로 해주세요."},
        }

    yield {"event": "done", "data": {}}
