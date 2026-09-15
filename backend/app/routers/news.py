"""News-insights dashboard — reinsurance business-development news feed.

EXPERIMENTAL / ISOLATED, same contract as the rq-slip and weekly tools:
- prefix ``/api/tools/news`` — no overlap with claims/contract routes.
- NO DB. The build pipeline and daily cache live in ``services/news_feed`` so
  the worker's scheduled refresh and these HTTP routes share one cache.

``GET /`` returns today's cached feed (built on first request of the day),
``POST /refresh`` forces a live rebuild, ``GET /health`` reports key presence.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.config import settings
from app.services import news_feed

router = APIRouter(prefix="/api/tools/news", tags=["news"])


@router.get("/health")
async def health() -> dict[str, Any]:
    checks = {
        "perigon_api_key": "ok" if settings.perigon_api_key else "missing",
        "naver_credentials": "ok"
        if (settings.naver_client_id and settings.naver_client_secret)
        else "missing",
        "gemini_api_key": "ok" if settings.gemini_api_key else "missing",
    }
    return {"status": "ok", "checks": checks, "per_source": news_feed.PER_SOURCE}


@router.get("")
async def get_feed() -> dict[str, Any]:
    """Return today's cached feed, building it on first request of the day."""
    cached = news_feed.read_cache(news_feed.today())
    if cached is not None:
        return cached
    return await news_feed.build_and_cache()


@router.post("/refresh")
async def refresh() -> dict[str, Any]:
    """Force a rebuild from the live sources, replacing today's cache."""
    return await news_feed.build_and_cache()
