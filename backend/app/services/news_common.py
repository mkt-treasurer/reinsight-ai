"""Shared types and helpers for the news-insights source clients.

Both the Perigon (global) and Naver (Korean) clients normalize their raw
responses into the same :class:`NewsItem` shape so the router can merge them
with equal weight and the frontend renders a single card type.
"""

from __future__ import annotations

import asyncio
import html
import re
import time
from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import urlparse

import httpx

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_SNIPPET_MAX = 280


class RateGate:
    """Serializes outbound requests and enforces minimum spacing, retrying on
    HTTP 429. Both the Perigon and Naver free tiers reject bursts, and the
    topic builds fan out many requests at once — a module-level gate per source
    keeps them spaced without throttling the unrelated source.
    """

    def __init__(self, min_interval: float, retry_backoffs: tuple[float, ...] = (2.0, 4.0)):
        self._lock = asyncio.Lock()
        self._min_interval = min_interval
        self._backoffs = retry_backoffs
        self._last = 0.0

    async def get(self, client: httpx.AsyncClient, url: str, **kwargs: Any) -> httpx.Response:
        resp: httpx.Response | None = None
        for attempt in range(len(self._backoffs) + 1):
            async with self._lock:
                wait = self._min_interval - (time.monotonic() - self._last)
                if wait > 0:
                    await asyncio.sleep(wait)
                resp = await client.get(url, **kwargs)
                self._last = time.monotonic()
            if resp.status_code == 429 and attempt < len(self._backoffs):
                await asyncio.sleep(self._backoffs[attempt])
                continue
            return resp
        assert resp is not None  # loop runs at least once
        return resp


@dataclass(frozen=True)
class NewsItem:
    title: str
    url: str
    source: str  # outlet / publisher name (or domain)
    published_at: str  # ISO 8601 if known, else ""
    snippet: str
    lang: str  # "en" | "ko"
    image_url: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def clean_text(raw: str | None) -> str:
    """Strip HTML tags (Naver wraps matches in ``<b>``) and unescape entities."""
    if not raw:
        return ""
    text = _TAG_RE.sub("", raw)
    text = html.unescape(text)
    return _WS_RE.sub(" ", text).strip()


def snippet(raw: str | None) -> str:
    text = clean_text(raw)
    if len(text) <= _SNIPPET_MAX:
        return text
    return text[:_SNIPPET_MAX].rsplit(" ", 1)[0] + "…"


def domain_of(url: str | None) -> str:
    if not url:
        return ""
    try:
        host = urlparse(url).netloc
        return host[4:] if host.startswith("www.") else host
    except ValueError:
        return ""


# Substring markers (lowercased) that flag an item as insurance/reinsurance
# relevant. Broad search terms — esp. bare Korean nouns like "대형화재" or
# "삼성화재" (matches the 삼성화재배 Go tournament) — drag in general news; this
# is the cheap relevance gate that keeps the card feed on-topic.
_INSURANCE_TERMS: tuple[str, ...] = (
    # Korean
    "보험", "재보험", "손보", "생보", "손해율", "요율", "언더라이팅", "담보",
    "보험금", "보상", "보험료", "약관", "캐파", "출재", "수재", "보험사", "보험업",
    # English (substring match: "insur" covers insurance/insurer/insured, etc.)
    "insur", "reinsur", "underwrit", "catastroph", "cat bond", "premium",
    "loss ratio", "claim", "cedant", "cedent", "reinsurer", "lloyd", "solvency",
    "actuar", "policyholder", "casualty", "peril", "treaty",
)


def is_insurance_relevant(item: NewsItem) -> bool:
    haystack = f"{item.title} {item.snippet}".lower()
    return any(term in haystack for term in _INSURANCE_TERMS)


def filter_relevant(
    items: list[NewsItem], size: int, *, min_keep: int = 2
) -> list[NewsItem]:
    """Prefer insurance-relevant items, trimmed to ``size``.

    When at least ``min_keep`` clearly-relevant items exist we drop the rest
    (cuts the bare-noun noise). When too few do, we backfill with the others so
    a thin-news topic still shows something rather than going blank.
    """
    relevant: list[NewsItem] = []
    other: list[NewsItem] = []
    for item in items:
        (relevant if is_insurance_relevant(item) else other).append(item)
    chosen = relevant if len(relevant) >= min_keep else relevant + other
    return chosen[:size]
