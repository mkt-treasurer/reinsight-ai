"""Phase 2 — 뉴스 기반 영업 발굴. 외부 뉴스 → 회사 → 우리 책과 대조 → 리드.

EXPERIMENTAL / ISOLATED. 계약 원장은 **읽기만** 한다.

## 왜 이 구조인가

1. **뉴스 수집은 argo MCP 를 JSON-RPC 로 직접 호출한다.** 챗처럼 Claude 를
   경유하면 검색 한 번에 LLM 턴 비용이 붙는다. 수집은 결정론적 작업이라
   모델이 필요 없다.
2. **`broad_search: true` 는 필수다.** 끄면 `news_search` 가 금융/증권 코퍼스
   (mt.co.kr·mk.co.kr·biz.chosun 등)에 갇혀 "공장 신설 착공"에 버핏·코카콜라
   주가 기사가 나온다. 켜면 광양항 착공식·코오롱인더 김천공장 준공처럼
   실제 보험 수요 신호가 잡힌다 — 2026-07-29 실측.
3. **회사명 추출은 LLM 이 필요하다.** 응답에 회사가 구조화돼 있지 않고 제목
   문장 안에만 있다("코오롱인더, 김천1공장에 PU 인조 가죽 생산라인 준공").
   규칙으로는 못 뽑는다. 그래서 수집한 기사를 **한 번의 배치 호출**로 정리한다.
4. **판정은 우리 책과의 대조에서 나온다.** 기존 고객이면 교차판매, 이탈 고객이면
   복구(가장 강력), 처음 보는 회사면 신규 발굴 — 각각 다른 영업 동작이다.

## 사람 판정 게이트
뉴스는 노이즈가 크다. 이 모듈은 **후보만** 만들고 아무것도 확정하지 않는다
(human_in_the_loop_write). 승격은 사람이 한다.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any

import anthropic
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.bd import BASE, CEDANT_CANON, IS_COMPANY_ASSURED

logger = logging.getLogger(__name__)

_STORE = Path(
    os.environ.get("BD_NEWS_STORE_DIR")
    or (Path(__file__).resolve().parents[2] / "data" / "bd-news")
)

#: 검색 키워드 → 유발되는 종목. 우리 책의 실제 신규 유입 순서를 반영한다
#: (최근 3년 신규: CGL 66 > PAR 22 > Cargo 16 > D&O 15 > EW 9 > PL 8 > CAR 7).
#: 키워드는 '보험 수요가 발생하는 사건'만 넣는다 — 주가·실적 기사는 무의미하다.
KEYWORD_SETS: list[dict[str, Any]] = [
    {"key": "construction", "query": "착공식", "lines": ["CAR", "EAR"], "why": "공사 착공 → 건설공사보험"},
    {"key": "plant_done", "query": "공장 준공", "lines": ["PAR", "EAR"], "why": "공장 준공 → 재산종합"},
    {"key": "plant_new", "query": "공장 신설 투자", "lines": ["PAR", "CAR"], "why": "신설 투자 → 건설+재산"},
    {"key": "expansion", "query": "증설 생산라인 투자", "lines": ["PAR", "EAR"], "why": "증설 → 재산·기계"},
    {"key": "datacenter", "query": "데이터센터 건립", "lines": ["CAR", "PAR"], "why": "데이터센터 → 대형 건설·재산"},
    {"key": "order_win", "query": "수주 계약 체결 플랜트", "lines": ["CAR", "CGL"], "why": "수주 → 공사·배상"},
    {"key": "recall", "query": "리콜 제품 결함", "lines": ["PL", "Recall"], "why": "리콜 → 제조물책임"},
    {"key": "overseas", "query": "해외법인 설립 공장 진출", "lines": ["Cargo", "PAR"], "why": "해외 진출 → 적하·재산"},
    {"key": "logistics", "query": "물류센터 신축", "lines": ["PAR", "Cargo"], "why": "물류센터 → 재산·적하"},
    {"key": "governance", "query": "상장 IPO 이사회 주주대표소송", "lines": ["D&O"], "why": "지배구조 이벤트 → 임원배상"},
]

_EXTRACT_SYSTEM = """뉴스 제목·요약에서 **재보험 영업에 쓸 정보**를 뽑는 작업입니다.

각 기사에 대해:
- company: 사업 주체 회사명. 한국 기업은 정식 상호에 가깝게(예: "코오롱인더" → "코오롱인더스트리").
  지자체·공공기관도 주체면 그대로 적습니다. 주체를 특정할 수 없으면 null.
- aliases: 이 회사를 **영문 상호와 옛 사명까지 포함해** 나열합니다. 매우 중요합니다 —
  대조할 원장에는 영문 표기가 많고 사명 변경 전 이름으로 남아 있습니다.
  예) "한화오션" → ["Hanwha Ocean", "대우조선해양", "Daewoo Shipbuilding & Marine Engineering", "DSME"]
      "GS건설"   → ["GS E&C", "GS Engineering & Construction", "GS Engineering"]
      "농심"     → ["Nongshim"]
  확실한 것만 적고 추측으로 채우지 않습니다. 없으면 빈 배열.
- group: 소속 기업집단 (예: "한화그룹", "GS그룹"). 없거나 모르면 null.
- event: 무슨 일인가 한 줄 (예: "김천1공장 PU 인조가죽 생산라인 준공")
- amount_krw: 기사에 투자·수주 금액이 나오면 원 단위 정수, 없으면 null (226억 → 22600000000)
- event_kind: "demand" 또는 "incident"
    demand   = 보험 수요가 **새로 생기는** 사건 — 착공·준공·증설·신설, 대형 수주,
               해외 공장·법인 설립, 물류센터 신축, 상장·IPO
    incident = 이미 벌어진 **사고·분쟁** — 화재·폭발·붕괴, 리콜, 소송·제재
    사고는 영업 리드가 아니라 리스크 신호입니다. 섞지 마세요.
- relevant: 위 둘 중 하나에 해당하는가 (true/false)

**relevant=false 로 처리할 것**: 주가·실적·컨센서스 기사, 정책·법안 논의, 인사,
단순 시장 전망, 제품 출시 홍보, 사건과 무관한 회사 언급.
**relevant=true 예시**: 착공/준공/증설/신설, 대형 수주, 리콜·제품사고, 해외 공장·법인
설립, 물류센터 신축, 상장·주주대표소송.

판단이 애매하면 relevant=false 로 보수적으로 처리합니다. 억지로 채우지 않습니다."""

_EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "idx": {"type": "integer"},
                    "company": {"type": ["string", "null"]},
                    "aliases": {"type": "array", "items": {"type": "string"}},
                    "group": {"type": ["string", "null"]},
                    "event": {"type": ["string", "null"]},
                    "amount_krw": {"type": ["integer", "null"]},
                    "event_kind": {"type": "string", "enum": ["demand", "incident"]},
                    "relevant": {"type": "boolean"},
                },
                "required": ["idx", "company", "aliases", "group", "event",
                             "amount_krw", "event_kind", "relevant"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


# ── 뉴스 수집 (MCP 직접 호출) ─────────────────────────────────────────


def _mcp_call(tool: str, args: dict[str, Any], timeout: int = 90) -> dict[str, Any] | None:
    """argo MCP 툴 하나를 JSON-RPC 로 호출. 실패는 None (호출자가 건너뛴다)."""
    if not settings.argo_mcp_url:
        return None
    body = json.dumps(
        {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
         "params": {"name": tool, "arguments": args}}
    ).encode()
    headers = {
        "Content-Type": "application/json",
        # 서버가 SSE 로 답할 수 있어 둘 다 받는다고 알린다.
        "Accept": "application/json, text/event-stream",
    }
    if settings.argo_mcp_token:
        headers["Authorization"] = f"Bearer {settings.argo_mcp_token}"
    try:
        req = urllib.request.Request(settings.argo_mcp_url, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        logger.warning("argo MCP %s 호출 실패: %s", tool, e)
        return None
    if "data:" in raw:  # SSE 프레이밍 해제
        raw = "\n".join(l[5:].strip() for l in raw.splitlines() if l.startswith("data:"))
    try:
        content = json.loads(raw).get("result", {}).get("content", [])
        if not content:
            return None
        return json.loads(content[0]["text"])
    except (json.JSONDecodeError, KeyError, IndexError, TypeError) as e:
        logger.warning("argo MCP %s 응답 파싱 실패: %s", tool, e)
        return None


_DATE_RE = re.compile(r"(20\d{2})[-/.]?(\d{2})[-/.]?(\d{2})")


def _norm_date(v: Any) -> str | None:
    """날짜가 '20260729T1', '2026072911', '' 등으로 깨져 온다 — 앞 8자리만 취한다."""
    m = _DATE_RE.search(str(v or ""))
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def fetch_news(days: int = 14, per_query: int = 10) -> list[dict]:
    """키워드 세트를 돌며 기사를 모은다. url 기준 중복 제거."""
    seen: set[str] = set()
    out: list[dict] = []
    for ks in KEYWORD_SETS:
        payload = _mcp_call(
            "news_search",
            {
                "query": ks["query"],
                "date_range_days": days,
                "max_results": per_query,
                # 없으면 금융 코퍼스에 갇힌다 — 이 플래그가 Phase 2 의 성립 조건.
                "broad_search": True,
            },
        )
        if not payload or not payload.get("success"):
            logger.info("키워드 '%s' 수집 실패 또는 결과 없음", ks["query"])
            continue
        for a in (payload.get("data") or {}).get("articles") or []:
            url = (a.get("url") or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            out.append(
                {
                    "keyword": ks["key"],
                    "query": ks["query"],
                    "lines": ks["lines"],
                    "why": ks["why"],
                    "title": (a.get("title") or "").strip(),
                    "summary": (a.get("summary") or "").strip(),
                    "source": a.get("source"),
                    "url": url,
                    "date": _norm_date(a.get("date")),
                }
            )
    return out


# ── 회사·이벤트 추출 (LLM 배치 1회) ────────────────────────────────────


async def extract_companies(articles: list[dict], batch: int = 40) -> list[dict]:
    """기사에서 회사·이벤트·금액을 뽑고 무관 기사를 걸러낸다.

    structured output 으로 스키마를 강제해 파싱 실패를 없앤다. 키가 없으면
    추출을 건너뛰고 기사를 그대로 돌려준다(수집만이라도 살린다).
    """
    if not settings.anthropic_api_key or not articles:
        return articles
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, max_retries=3)

    async def one(chunk: list[dict], offset: int) -> None:
        listing = "\n".join(
            f"{i}. [{a['keyword']}] {a['title']} — {a['summary'][:160]}"
            for i, a in enumerate(chunk)
        )
        try:
            resp = await client.messages.create(
                model=settings.aria_chat_model,
                max_tokens=8000,
                system=_EXTRACT_SYSTEM,
                output_config={"format": {"type": "json_schema", "schema": _EXTRACT_SCHEMA}},
                messages=[{"role": "user", "content": listing}],
            )
            if resp.stop_reason == "refusal":
                logger.warning("추출 거절됨 (offset=%s)", offset)
                return
            txt = next((b.text for b in resp.content if getattr(b, "type", "") == "text"), "")
            for it in json.loads(txt).get("items", []):
                i = it.get("idx")
                if isinstance(i, int) and 0 <= i < len(chunk):
                    chunk[i].update(
                        company=it.get("company"),
                        aliases=it.get("aliases") or [],
                        group=it.get("group"),
                        event=it.get("event"),
                        amount_krw=it.get("amount_krw"),
                        event_kind=it.get("event_kind") or "demand",
                        relevant=bool(it.get("relevant")),
                    )
        except Exception:
            logger.exception("회사 추출 실패 (offset=%s) — 해당 배치는 원문 유지", offset)

    chunks = [articles[i : i + batch] for i in range(0, len(articles), batch)]
    await asyncio.gather(*(one(c, i * batch) for i, c in enumerate(chunks)))
    return articles


# ── 우리 책과 대조 ────────────────────────────────────────────────────


async def match_book(db: AsyncSession, probes: list[tuple[str, list[str]]]) -> dict[str, dict]:
    """회사명 + 별칭들을 우리 계약 원장과 대조한다.

    별칭이 없으면 사실상 매칭이 안 된다 — 우리 책 피보험자 1,530개 중 **영문만
    1,001개(65%)** 이고 뉴스는 한글이다. 사명 변경도 겹친다: 한화오션은 원장에
    `Daewoo Shipbuilding & Marine Engineering` 로, GS건설은 `GS E&C` 로 있다.
    별칭 없이 돌리면 4.4조 딜을 '신규 발굴'로 오분류한다 — 2026-07-29 실측.

    probes: [(대표명, [별칭...]), ...]
    """
    out: dict[str, dict] = {}
    q = f"""
    SELECT count(*)                            AS contracts,
           count(DISTINCT year)                AS years_traded,
           max(period_to)                      AS last_period_to,
           round(sum(ri_commission)::numeric)  AS commission,
           array_agg(DISTINCT line)            AS lines,
           array_agg(DISTINCT {CEDANT_CANON})  AS cedants,
           array_agg(DISTINCT assured)         AS matched_assureds
    FROM contracts
    WHERE {BASE} AND {IS_COMPANY_ASSURED} AND assured ILIKE :like
    HAVING count(*) > 0
    """
    for name, aliases in probes:
        # 짧은 토큰은 오매칭이 심하다 (예: 'GS' 는 아무 데나 걸린다).
        terms = [t.strip() for t in [name, *aliases] if t and len(t.strip()) > 3]
        best: dict | None = None
        hit_term: str | None = None
        for t in terms:
            r = await db.execute(text(q), {"like": f"%{t}%"})
            cols = list(r.keys())
            row = r.fetchone()
            if not row:
                continue
            d = dict(zip(cols, row))
            # 계약 건수가 가장 많은 별칭을 대표 매칭으로 삼는다.
            if best is None or (d["contracts"] or 0) > (best["contracts"] or 0):
                best, hit_term = d, t
        if best is None:
            out[name] = {"relation": "new"}
            continue
        pt = best.get("last_period_to")
        best["relation"] = (
            "active" if pt and pt > date.today()
            else "lapsed" if pt
            else "existing"
        )
        best["matched_via"] = hit_term
        out[name] = best
    return out


# ── 조립 + 캐시 ───────────────────────────────────────────────────────


def _cache_path(day: str) -> Path:
    return _STORE / f"{day}.json"


def read_cache(day: str) -> dict | None:
    p = _cache_path(day)
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        logger.warning("bd-news 캐시 읽기 실패: %s", p)
        return None


def _write_cache(day: str, payload: dict) -> None:
    try:
        _STORE.mkdir(parents=True, exist_ok=True)
        # default=str 은 안전망 — Decimal/date 가 새로 끼어도 캐시 쓰기가 죽지 않게.
        _cache_path(day).write_text(
            json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8"
        )
    except OSError:
        logger.warning("bd-news 캐시 쓰기 실패 (무시하고 계속)")


async def build(db: AsyncSession, days: int = 14, per_query: int = 10) -> dict:
    """수집 → 추출 → 대조 → 후보 리드. 확정은 하지 않는다(사람 판정)."""
    raw = await asyncio.to_thread(fetch_news, days, per_query)
    articles = await extract_companies(raw)

    kept = [a for a in articles if a.get("relevant") and a.get("company")]

    # 같은 사건이 여러 매체 기사로 들어온다(코오롱 김천공장 2건, 쿠팡 화재 2건).
    # (회사, 키워드) 로 접고 금액이 있는 쪽을 대표로 남긴다. 나머지는 기사 수만 센다.
    folded: dict[tuple[str, str], dict] = {}
    for a in kept:
        k = (a["company"], a["keyword"])
        prev = folded.get(k)
        if prev is None:
            folded[k] = {**a, "article_count": 1, "urls": [a["url"]]}
            continue
        prev["article_count"] += 1
        prev["urls"].append(a["url"])
        if (a.get("amount_krw") or 0) > (prev.get("amount_krw") or 0):
            prev.update(title=a["title"], event=a["event"],
                        amount_krw=a["amount_krw"], url=a["url"], date=a.get("date"))
    deduped = list(folded.values())

    book = await match_book(db, [(a["company"], a.get("aliases") or []) for a in deduped])

    leads: list[dict] = []
    for a in deduped:
        m = book.get(a["company"], {"relation": "new"})
        leads.append(
            {
                **a,
                "relation": m.get("relation", "new"),
                "matched_via": m.get("matched_via"),
                "book_contracts": m.get("contracts"),
                "book_years": m.get("years_traded"),
                "book_last_period_to": (
                    str(m["last_period_to"]) if m.get("last_period_to") else None
                ),
                "book_commission": (
                    int(m["commission"]) if m.get("commission") is not None else None
                ),
                "book_lines": [x for x in (m.get("lines") or []) if x],
                "book_cedants": [x for x in (m.get("cedants") or []) if x],
                "matched_assureds": [x for x in (m.get("matched_assureds") or []) if x],
            }
        )

    # 복구 리드가 가장 강하다 — 관계가 있었고 지금 비어 있으니까.
    order = {"lapsed": 0, "existing": 1, "active": 2, "new": 3}
    leads.sort(key=lambda x: (order.get(x["relation"], 9), -(x.get("amount_krw") or 0)))

    # 사고 기사는 영업 리드가 아니다 — 리스크 신호로 분리한다.
    demand = [x for x in leads if x.get("event_kind") != "incident"]
    incidents = [x for x in leads if x.get("event_kind") == "incident"]

    payload = {
        "generated_for_days": days,
        "fetched": len(raw),
        "relevant": len(kept),
        "dropped_irrelevant": len(articles) - len(kept),
        "folded_from": len(kept),
        "counts": {
            k: sum(1 for x in demand if x["relation"] == k)
            for k in ("lapsed", "existing", "active", "new")
        },
        "incident_count": len(incidents),
        "keywords": [{"key": k["key"], "query": k["query"], "lines": k["lines"], "why": k["why"]}
                     for k in KEYWORD_SETS],
        "leads": demand,
        "incidents": incidents,
        "note": "후보 목록입니다. 아무것도 확정하지 않으며 승격은 사람이 판정합니다.",
    }
    _write_cache(date.today().isoformat(), payload)
    return payload


async def get_or_build(db: AsyncSession, days: int = 14, refresh: bool = False) -> dict:
    day = date.today().isoformat()
    if not refresh:
        cached = read_cache(day)
        if cached:
            return {**cached, "cached": True}
    return {**await build(db, days=days), "cached": False}
