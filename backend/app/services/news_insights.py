"""Turn a topic's merged headlines into reinsurance-sales insights via Gemini.

Given the equal-weighted KR+global items for one topic, produce 2–3 short
Korean bullets framed for a reinsurer's business-development desk — "so what
for our renewals / clients / rates", not a headline rehash. Best-effort: any
failure (no key, model error, unparseable output) returns ``[]`` and the
dashboard simply shows no insight panel for that topic.

Sync on purpose — ``google.generativeai`` is blocking; the router fans these
out with ``asyncio.to_thread`` so the four topics summarize concurrently.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

# Same lightweight model the RQ-slip tool uses.
GEMINI_MODEL = "gemini-3.1-flash-lite"
_MAX_ITEMS_IN_PROMPT = 12
_JSON_BLOCK_RE = re.compile(r"\[.*\]", re.DOTALL)

_PROMPT = """\
당신은 재보험 중개·인수 데스크의 시장 분석가입니다. 아래는 "{label}" 주제의
최근 뉴스 헤드라인입니다(국내·해외 혼합). 재보험 영업 관점에서 실무자가 바로
활용할 인사이트를 한국어로 2~3개 도출하세요.

규칙:
- 단순 헤드라인 요약 금지. "그래서 우리 영업·갱신·요율·고객 협상에 무슨 의미인지"를 짚을 것.
- 각 항목은 1~2문장, 구체적으로. 근거가 약하면 단정하지 말 것.
- 출력은 JSON 문자열 배열만. 예: ["인사이트1", "인사이트2"]. 다른 텍스트 금지.

뉴스:
{items}
"""


def summarize_topic(label: str, items: list[dict[str, Any]]) -> list[str]:
    if not items or not settings.gemini_api_key:
        return []

    lines = []
    for it in items[:_MAX_ITEMS_IN_PROMPT]:
        flag = "🇰🇷" if it.get("lang") == "ko" else "🌐"
        lines.append(f"- [{flag} {it.get('source', '')}] {it.get('title', '')} — {it.get('snippet', '')}")
    prompt = _PROMPT.format(label=label, items="\n".join(lines))

    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)
        resp = model.generate_content(prompt)
        return _parse(resp.text or "")
    except Exception as exc:  # noqa: BLE001 — best-effort, never break the feed
        logger.warning("Insight generation failed for %r: %s", label, exc)
        return []


def _parse(text: str) -> list[str]:
    """Extract a JSON string array from the model output, defensively."""
    match = _JSON_BLOCK_RE.search(text)
    if not match:
        return []
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(x).strip() for x in parsed if str(x).strip()][:3]
