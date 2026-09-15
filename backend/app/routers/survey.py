"""Satisfaction survey — lightweight feedback collection for INS features.

EXPERIMENTAL / ISOLATED, same contract as the rq-slip / weekly / ops / news
tools:
- prefix ``/api/tools/survey`` — no overlap with the core desk routes.
- NO DB, NO migrations. Each submitted response is persisted as its own JSON
  file under ``backend/data/survey/`` (or ``SURVEY_STORE_DIR`` on prod, where
  ``/app/data`` is read-only). Results are aggregated on read.

The survey asks how satisfied real users are with the features shipped in the
INS desk: overall satisfaction, likelihood-to-recommend (NPS-style), a per
feature rating, and free-text comments.
"""

from __future__ import annotations

import json
import logging
import os
import secrets
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix="/api/tools/survey", tags=["survey"])
logger = logging.getLogger(__name__)

# Submitting the survey is open; VIEWING aggregated results is gated behind a
# shared password (passed as the ``X-Survey-Key`` header). Env-only — no source
# fallback, so the password never ships in the repo or in an exported archive.
_RESULTS_PASSWORD = os.environ.get("SURVEY_RESULTS_PASSWORD") or ""


def _require_results_key(key: str | None) -> None:
    """Constant-time compare; raise 401 on missing/incorrect password.

    Fails closed at request time rather than at import: an unset password
    disables results viewing only, leaving the rest of the backend (and
    survey submission itself) working — same isolation stance as the other
    experimental tools.
    """
    if not _RESULTS_PASSWORD:
        raise HTTPException(
            status_code=503,
            detail="results viewing is not configured (SURVEY_RESULTS_PASSWORD unset)",
        )
    if not key or not secrets.compare_digest(key, _RESULTS_PASSWORD):
        raise HTTPException(status_code=401, detail="invalid password")

# Canonical feature list — MUST stay in sync with the frontend page.
# key -> Korean/English label shown to respondents.
FEATURES: dict[str, str] = {
    "claims": "보험금 (Claims)",
    "premium": "보험료 (Premium)",
    "policies": "증권 (Policies)",
    "documents": "문서 (Documents)",
    "agent": "AI 에이전트 (Chat)",
    "slip_generator": "Slip Generator",
    "rq_slip": "RQ Slip · Placement",
    "weekly": "Weekly 대시보드",
    "ops": "Operations · 계약관리",
    "news": "뉴스 인사이트",
}

# Default backend/data/survey/ (writable in local dev). On prod /app/data is
# read-only, so SURVEY_STORE_DIR points at a writable volume — see
# docker-compose.prod.yml.
_STORE = Path(
    os.environ.get("SURVEY_STORE_DIR")
    or (Path(__file__).resolve().parents[2] / "data" / "survey")
)


def _store_dir() -> Path:
    _STORE.mkdir(parents=True, exist_ok=True)
    return _STORE


class SurveySubmission(BaseModel):
    """One respondent's answers. All rating fields validated at the boundary."""

    respondent: str = Field(default="", max_length=120)
    team: str = Field(default="", max_length=120)
    # 1–5 overall satisfaction (required).
    overall: int = Field(ge=1, le=5)
    # 0–10 likelihood to recommend (NPS-style); -1 == skipped.
    recommend: int = Field(default=-1, ge=-1, le=10)
    # feature key -> 1–5 rating. 0 / omitted == 미사용(N/A), excluded from averages.
    ratings: dict[str, int] = Field(default_factory=dict)
    # feature keys the respondent flagged as most valuable.
    most_useful: list[str] = Field(default_factory=list)
    likes: str = Field(default="", max_length=4000)
    improvements: str = Field(default="", max_length=4000)

    @field_validator("ratings")
    @classmethod
    def _check_ratings(cls, v: dict[str, int]) -> dict[str, int]:
        clean: dict[str, int] = {}
        for key, rating in v.items():
            if key not in FEATURES:
                continue  # ignore unknown feature keys
            if not isinstance(rating, int) or rating < 0 or rating > 5:
                raise ValueError(f"invalid rating for {key}: {rating}")
            if rating > 0:  # drop 0/N-A so it never skews an average
                clean[key] = rating
        return clean

    @field_validator("most_useful")
    @classmethod
    def _check_most_useful(cls, v: list[str]) -> list[str]:
        return [k for k in v if k in FEATURES][:10]


@router.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "responses": len(list(_store_dir().glob("*.json")))}


@router.get("/features")
async def features() -> dict[str, Any]:
    """Feature catalogue so the frontend can render labels from one source."""
    return {"features": [{"key": k, "label": v} for k, v in FEATURES.items()]}


@router.post("/submit")
async def submit(submission: SurveySubmission) -> dict[str, Any]:
    now = datetime.now()
    response_id = f"{now.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"
    payload = {
        "id": response_id,
        "submitted_at": now.isoformat(timespec="seconds"),
        **submission.model_dump(),
    }
    try:
        (_store_dir() / f"{response_id}.json").write_text(
            json.dumps(payload, ensure_ascii=False), encoding="utf-8"
        )
    except OSError as exc:  # pragma: no cover — disk/permission failure
        logger.exception("survey: failed to persist response")
        raise HTTPException(status_code=500, detail="failed to store response") from exc
    return {"ok": True, "id": response_id}


def _read_all() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for fp in sorted(_store_dir().glob("*.json")):
        try:
            rows.append(json.loads(fp.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            logger.warning("survey: skipping unreadable response %s", fp.name)
    rows.sort(key=lambda r: r.get("submitted_at") or "")
    return rows


def _avg(values: list[int]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def _dist(values: list[int], lo: int, hi: int) -> dict[str, int]:
    """Count of each discrete score in [lo, hi] (keys are strings for JSON)."""
    counts = {str(n): 0 for n in range(lo, hi + 1)}
    for v in values:
        if lo <= v <= hi:
            counts[str(v)] += 1
    return counts


@router.get("/results")
async def results(x_survey_key: str | None = Header(default=None)) -> dict[str, Any]:
    """Aggregate every stored response into desk-friendly summary stats.

    Password-gated (``X-Survey-Key`` header) — the survey form is open to all,
    but the aggregated results are for the desk only.
    """
    _require_results_key(x_survey_key)
    rows = _read_all()
    total = len(rows)

    overalls = [r["overall"] for r in rows if isinstance(r.get("overall"), int)]
    recommends = [
        r["recommend"]
        for r in rows
        if isinstance(r.get("recommend"), int) and r["recommend"] >= 0
    ]

    # NPS = %promoters(9–10) − %detractors(0–6), on a 0–10 scale.
    nps: float | None = None
    if recommends:
        promoters = sum(1 for v in recommends if v >= 9)
        detractors = sum(1 for v in recommends if v <= 6)
        nps = round((promoters - detractors) / len(recommends) * 100)

    per_feature = []
    useful_counts: dict[str, int] = {k: 0 for k in FEATURES}
    for r in rows:
        for k in r.get("most_useful", []):
            if k in useful_counts:
                useful_counts[k] += 1
    for key, label in FEATURES.items():
        scores = [
            r["ratings"][key]
            for r in rows
            if isinstance(r.get("ratings"), dict) and isinstance(r["ratings"].get(key), int)
        ]
        per_feature.append(
            {
                "key": key,
                "label": label,
                "avg": _avg(scores),
                "responses": len(scores),
                "distribution": _dist(scores, 1, 5),
                "most_useful_votes": useful_counts[key],
            }
        )
    per_feature.sort(key=lambda f: (f["avg"] is None, -(f["avg"] or 0)))

    comments = [
        {
            "id": r["id"],
            "submitted_at": r.get("submitted_at"),
            "respondent": r.get("respondent") or "",
            "team": r.get("team") or "",
            "overall": r.get("overall"),
            "likes": r.get("likes") or "",
            "improvements": r.get("improvements") or "",
        }
        for r in reversed(rows)  # newest first
        if (r.get("likes") or r.get("improvements"))
    ]

    return {
        "total": total,
        "overall_avg": _avg(overalls),
        "overall_distribution": _dist(overalls, 1, 5),
        "recommend_avg": _avg(recommends),
        "recommend_responses": len(recommends),
        "nps": nps,
        "features": per_feature,
        "comments": comments,
        "latest_at": rows[-1].get("submitted_at") if rows else None,
    }
