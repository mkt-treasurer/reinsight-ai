import os
from enum import Enum

from pydantic_settings import BaseSettings


class KBParserMode(str, Enum):
    """How the KB deterministic parser participates in :mod:`soc_stream`.

    - ``OFF`` (default) — parser bypassed, legacy LLM-only flow runs unchanged.
    - ``SHADOW`` — parser runs in parallel with the LLM; result is recorded
      in the audit trail and cross-checked against the LLM output, but the
      user-facing SOC is still produced from the LLM result. Use this to
      gather evidence before promoting to ``ON``.
    - ``ON`` — parser result is injected into the LLM reasoning prompt
      and the cross-check warns on disagreements. Phase 3c does not
      override the LLM-produced SOC even in ``ON`` mode; that override
      is gated to Phase 3d. ``ON`` requires ``KB_PARSER_ON_APPROVED`` to
      be set so the cutover review can't be skipped accidentally.
    """

    OFF = "off"
    SHADOW = "shadow"
    ON = "on"


def _resolve_kb_parser_mode() -> KBParserMode:
    """Read the runtime mode from env, defaulting to ``OFF`` and
    enforcing the ``KB_PARSER_ON_APPROVED`` gate when ``ON`` is
    requested. Lives at module scope so it runs at import time —
    misconfigurations fail fast instead of leaking into a request."""
    raw = os.environ.get("KB_PARSER_MODE", "off").strip().lower()
    try:
        mode = KBParserMode(raw)
    except ValueError:
        raise RuntimeError(
            f"KB_PARSER_MODE={raw!r} is not a valid mode; "
            f"expected one of {[m.value for m in KBParserMode]}"
        )
    if mode is KBParserMode.ON and not os.environ.get("KB_PARSER_ON_APPROVED"):
        raise RuntimeError(
            "KB_PARSER_MODE=on requires KB_PARSER_ON_APPROVED to be set. "
            "Phase 3d cutover review must approve activation first."
        )
    return mode


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://reinsai:reinsai@postgres:5432/reinsai"
    redis_url: str = "redis://redis:6379"
    gemini_api_key: str = ""
    # News-insights tool (isolated /api/tools/news). Global news via Perigon,
    # Korean news via the Naver Search API. Empty by default → the tool reports
    # a "missing" health state instead of crashing the rest of the backend.
    perigon_api_key: str = ""
    naver_client_id: str = ""
    naver_client_secret: str = ""

    # ins/chat 코파일럿 (app/services/agent). Anthropic Claude + 온톨로지 그라운딩.
    # 키가 비면 채팅만 비활성 안내를 내보내고 나머지 백엔드는 정상 동작한다.
    anthropic_api_key: str = ""
    aria_chat_model: str = "claude-opus-5"
    # low | medium | high | xhigh | max — 지저분한 실데이터 위 SQL 추론이라 high 기본.
    aria_chat_effort: str = "high"
    # L3 온톨로지 경로 오버라이드. 비우면 조상 경로에서 ontology/aria-ontology-l3.json 탐색.
    aria_l3_path: str = ""

    # argo(alpha-lenz) 외부 툴 MCP 서버. '+ 알파렌즈' 토글이 켜졌고 URL 이 설정된
    # 경우에만 붙는다. 미설정이면 use_mcp=true 여도 내부 툴만 쓴다.
    argo_mcp_url: str = ""
    argo_mcp_token: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
KB_PARSER_MODE: KBParserMode = _resolve_kb_parser_mode()
