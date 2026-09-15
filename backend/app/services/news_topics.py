"""Curated topic feeds for the news-insights tool.

Four topics framed for a reinsurer's business-development desk. Each topic
carries TWO queries: a global/English query for Perigon and a Korean query
for the Naver News Search API. The dashboard pulls an equal number of items
from each source per topic (see ``routers/news.py``), so the two queries
should target the same theme from each market's vantage point.

Pure data — no I/O. Kept tiny and declarative so the query set can be tuned
without touching the fetch/merge/summarize plumbing.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Topic:
    id: str
    label: str  # Korean section heading shown in the dashboard
    description: str  # one-line "why this matters" subtext
    perigon_query: str  # Perigon `q` (global, English) — supports boolean AND/OR
    # Naver Search API does NOT support a boolean OR operator (it treats "OR"
    # as a literal search term), so each topic carries a LIST of single-intent
    # Korean queries that the client runs separately and merges by recency.
    naver_queries: tuple[str, ...]


# Order here is the order rendered in the dashboard.
TOPICS: tuple[Topic, ...] = (
    Topic(
        id="cedants",
        label="원수사 · 대형 고객사",
        description="원수보험사·대형 피보험 그룹의 실적·M&A·신용도 변화 — 갱신 협상 레버리지",
        perigon_query=(
            '(insurer OR reinsurer OR "primary insurance") AND '
            '(merger OR acquisition OR earnings OR "combined ratio" OR '
            'downgrade OR "capital raise")'
        ),
        naver_queries=("삼성화재", "DB손해보험", "현대해상", "메리츠화재", "손해보험 실적"),
    ),
    Topic(
        id="regulation",
        label="규제 · 정책",
        description="자본규제·회계기준·의무보험 등 영업 환경을 바꾸는 정책 변화",
        perigon_query=(
            'insurance AND (regulation OR "Solvency II" OR IFRS17 OR '
            '"capital requirement" OR supervisor OR "regulatory reform")'
        ),
        naver_queries=("K-ICS", "IFRS17 보험", "보험 규제", "금융감독원 보험", "의무보험"),
    ),
    Topic(
        id="market_rates",
        label="시장 · 요율 동향",
        description="재보험 갱신·요율 경/연화·캐파시티 — 글로벌 재보험사 동향 포함",
        perigon_query=(
            'reinsurance AND (renewal OR "rate increase" OR "rate hardening" OR '
            '"rate softening" OR capacity OR "January renewals" OR '
            '"Munich Re" OR "Swiss Re" OR "Hannover Re")'
        ),
        naver_queries=("재보험 요율", "재보험 갱신", "재보험 시장", "재보험사", "보험 손해율"),
    ),
    Topic(
        id="cat_loss",
        label="대형 손실 · 자연재해",
        description="요율·갱신에 직접 영향 주는 대형 손실·자연재해 이벤트",
        perigon_query=(
            '("insured loss" OR reinsurance OR catastrophe) AND '
            '(hurricane OR typhoon OR earthquake OR wildfire OR flood OR '
            '"large loss" OR liability)'
        ),
        naver_queries=("태풍 피해", "지진 보험", "대형화재", "자연재해 보험", "배상책임 사고"),
    ),
)
