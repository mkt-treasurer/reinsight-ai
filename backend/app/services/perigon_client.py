"""Perigon News API client — global/English source for the news-insights tool.

Single endpoint: GET https://api.perigon.com/v1/all (article search). We sort
by date and cap the window to the recent past so the dashboard stays fresh.
Network/parse failures never raise — they return an empty list and log, so one
flaky source can't blank out the whole dashboard.

Docs: https://docs.perigon.io/docs/overview
API host is ``api.goperigon.com`` (``perigon.io`` is only the docs/marketing site).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.services.news_common import NewsItem, RateGate, clean_text, domain_of, snippet

logger = logging.getLogger(__name__)

_BASE = "https://api.goperigon.com/v1/all"
_TIMEOUT = httpx.Timeout(12.0)
_LOOKBACK_DAYS = 21
# Perigon's free tier rate-limits bursts; concurrent topic builds would
# otherwise fire all four requests at once and trip 429.
_GATE = RateGate(min_interval=1.3)


async def fetch(query: str, *, api_key: str, size: int) -> list[NewsItem]:
    """Fetch up to ``size`` recent global articles matching ``query``.

    Returns ``[]`` on any failure (missing key, HTTP error, malformed body).
    """
    if not api_key:
        return []
    frm = (datetime.now(timezone.utc) - timedelta(days=_LOOKBACK_DAYS)).date().isoformat()
    params = {
        "apiKey": api_key,
        "q": query,
        "language": "en",
        "sortBy": "date",
        "size": str(size),
        "from": frm,
        "showReprints": "false",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await _GATE.get(client, _BASE, params=params)
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Perigon fetch failed for %r: %s", query[:60], exc)
        return []

    articles = payload.get("articles") or []
    return [_normalize(a) for a in articles if a.get("title") and a.get("url")][:size]


def _normalize(a: dict) -> NewsItem:
    src = a.get("source") or {}
    source_name = src.get("domain") or domain_of(a.get("url"))
    return NewsItem(
        title=clean_text(a.get("title")),
        url=a.get("url") or "",
        source=source_name,
        published_at=a.get("pubDate") or a.get("addDate") or "",
        snippet=snippet(a.get("description") or a.get("content")),
        lang="en",
        image_url=a.get("imageUrl") or None,
    )
