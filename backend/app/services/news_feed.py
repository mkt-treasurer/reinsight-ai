"""Build pipeline + daily cache for the news-insights tool.

Extracted from the router so both the HTTP layer (``routers/news.py``) and the
scheduled refresh (``worker.py`` cron) share one implementation and one cache
location. NO DB — the built feed persists as one JSON file per day under
``NEWS_STORE_DIR`` (defaults to ``backend/data/news/``; prod points it at a
writable volume since ``/app/data`` is read-only there).

For each curated topic we pull from both sources, drop off-topic noise with the
relevance gate, interleave for balance, then ask Gemini for sales-angle
insights. Equal weight per topic: up to ``NEWS_PER_SOURCE`` items from each
source after filtering.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from itertools import zip_longest
from pathlib import Path
from typing import Any

from app.config import settings
from app.services import naver_client, news_insights, perigon_client
from app.services.news_common import NewsItem, filter_relevant
from app.services.news_topics import TOPICS, Topic

logger = logging.getLogger(__name__)

_STORE = Path(
    os.environ.get("NEWS_STORE_DIR") or (Path(__file__).resolve().parents[2] / "data" / "news")
)
PER_SOURCE = max(1, int(os.environ.get("NEWS_PER_SOURCE", "5")))


def today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def sources_status() -> dict[str, bool]:
    return {
        "perigon": bool(settings.perigon_api_key),
        "naver": bool(settings.naver_client_id and settings.naver_client_secret),
    }


# ─── build pipeline ─────────────────────────────────────────────────────────
async def build_and_cache() -> dict[str, Any]:
    """Fetch all topics live, build the payload, and write today's cache."""
    topics = await asyncio.gather(*(_build_topic(t) for t in TOPICS))
    payload = {
        "date": today(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "per_source": PER_SOURCE,
        "sources": sources_status(),
        "topics": list(topics),
    }
    _write_cache(today(), payload)
    return payload


async def _build_topic(topic: Topic) -> dict[str, Any]:
    global_raw, korea_raw = await asyncio.gather(
        perigon_client.fetch(
            topic.perigon_query, api_key=settings.perigon_api_key, size=PER_SOURCE * 3
        ),
        naver_client.fetch(
            topic.naver_queries,
            client_id=settings.naver_client_id,
            client_secret=settings.naver_client_secret,
            size=PER_SOURCE * 3,
        ),
    )
    # Filter for insurance relevance, then trim each source to equal weight.
    korea = filter_relevant(korea_raw, PER_SOURCE)
    glob = filter_relevant(global_raw, PER_SOURCE)
    items = [it.to_dict() for it in _interleave(korea, glob)]
    insights = await asyncio.to_thread(news_insights.summarize_topic, topic.label, items)
    return {
        "id": topic.id,
        "label": topic.label,
        "description": topic.description,
        "insights": insights,
        "items": items,
        "counts": {"korea": len(korea), "global": len(glob)},
    }


def _interleave(a: list[NewsItem], b: list[NewsItem]) -> list[NewsItem]:
    """Alternate the two source lists so the card feed stays balanced."""
    merged: list[NewsItem] = []
    for x, y in zip_longest(a, b):
        if x is not None:
            merged.append(x)
        if y is not None:
            merged.append(y)
    return merged


# ─── cache I/O (best-effort) ─────────────────────────────────────────────────
def read_cache(date: str) -> dict[str, Any] | None:
    path = _cache_path(date)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        logger.warning("News cache read failed (%s): %s", path, exc)
        return None


def _cache_path(date: str) -> Path:
    return _STORE / f"{date}.json"


def _write_cache(date: str, payload: dict[str, Any]) -> None:
    try:
        _STORE.mkdir(parents=True, exist_ok=True)
        _cache_path(date).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    except OSError as exc:
        logger.warning("News cache write failed (%s): %s", _cache_path(date), exc)
