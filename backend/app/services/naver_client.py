"""Naver News Search API client — Korean source for the news-insights tool.

Endpoint: GET https://openapi.naver.com/v1/search/news.json. Auth is via the
``X-Naver-Client-Id`` / ``X-Naver-Client-Secret`` headers. Titles and
descriptions come back with ``<b>`` highlight tags and HTML entities, so they
go through :func:`news_common.clean_text`. Failures return ``[]`` and log.

Docs: https://developers.naver.com/docs/serviceapi/search/news/news.md
"""

from __future__ import annotations

import asyncio
import logging
from email.utils import parsedate_to_datetime

import httpx

from app.services.news_common import NewsItem, RateGate, clean_text, domain_of, snippet

logger = logging.getLogger(__name__)

_BASE = "https://openapi.naver.com/v1/search/news.json"
_TIMEOUT = httpx.Timeout(12.0)
# Naver caps `display` at 100; we only ever want a handful per query.
_MAX_DISPLAY = 100
# Naver rejects bursts too: a refresh fans out ~20 queries (4 topics × ~5).
# Space them so the whole set lands instead of half-failing with 429.
_GATE = RateGate(min_interval=0.4)


async def fetch(
    queries: tuple[str, ...] | list[str],
    *,
    client_id: str,
    client_secret: str,
    size: int,
) -> list[NewsItem]:
    """Run each query separately, then merge to the ``size`` most recent items.

    Naver has no boolean OR, so a topic's intent is expressed as several single
    queries. We fetch a few from each, dedupe by URL, and keep the newest
    ``size``. Returns ``[]`` on missing creds; individual query failures are
    skipped, not fatal.
    """
    if not (client_id and client_secret):
        return []
    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }
    # Spread the budget across queries (at least 2 each) so no single term
    # starves the others, then trim the merged set back down to ``size``.
    per_query = max(2, -(-size // max(1, len(queries))))
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        batches = await asyncio.gather(
            *(_fetch_one(client, q, headers, per_query) for q in queries)
        )

    seen: set[str] = set()
    merged: list[NewsItem] = []
    for item in (i for batch in batches for i in batch):
        if item.url in seen:
            continue
        seen.add(item.url)
        merged.append(item)
    merged.sort(key=lambda i: i.published_at, reverse=True)
    return merged[:size]


async def _fetch_one(
    client: httpx.AsyncClient, query: str, headers: dict[str, str], display: int
) -> list[NewsItem]:
    params = {"query": query, "display": str(min(display, _MAX_DISPLAY)), "sort": "date"}
    try:
        resp = await _GATE.get(client, _BASE, params=params, headers=headers)
        resp.raise_for_status()
        payload = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Naver fetch failed for %r: %s", query, exc)
        return []
    items = payload.get("items") or []
    return [_normalize(i) for i in items if i.get("title") and i.get("link")]


def _normalize(i: dict) -> NewsItem:
    url = i.get("originallink") or i.get("link") or ""
    return NewsItem(
        title=clean_text(i.get("title")),
        url=url,
        source=domain_of(url),
        published_at=_iso_date(i.get("pubDate")),
        snippet=snippet(i.get("description")),
        lang="ko",
        image_url=None,
    )


def _iso_date(raw: str | None) -> str:
    """Naver returns RFC 1123 dates (e.g. 'Mon, 16 Jun 2026 09:00:00 +0900')."""
    if not raw:
        return ""
    try:
        return parsedate_to_datetime(raw).isoformat()
    except (TypeError, ValueError):
        return ""
