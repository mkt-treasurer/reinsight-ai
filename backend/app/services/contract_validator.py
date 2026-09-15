"""Contract.share integrity validation — dormant.

This module provides a pure check that, given a set of contract rows, every
(cover_note_no, year) group's shares sum to a target value (default 1.0 with
epsilon = 1e-4). It is intentionally NOT wired into any write or read path
right now; callers must opt in.

See `docs/adr-001-contract-share-invariant.md` for the reason. Short version:
the live `contracts` table is an installment ledger (one row per rec/paid
event, not per reinsurer) and INS Corp is typically a partial broker on a
placement, so the natural-sounding "shares per placement sum to 1.0" rule
holds for only ~3.5% of groups. Wiring this validator unconditionally would
reject 96% of legitimate writes.

The function is kept because once a real invariant is known — e.g. a target
share recorded on `cover_notes`, or a per-(cn, year, reinsurer) consistency
rule — this is the place to express it. Currently used by:

  - `scripts/audit_contract_shares.py`  (structural DB probe)
  - `tests/test_contract_validator.py`  (specifies behaviour for future use)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Iterable, Sequence

# 0.0001 = 0.01%. Tighter than this (e.g. 1e-6) flags benign rounding leftovers
# from bordereau like 1/12 = 0.0833333; looser (e.g. 1e-2) lets a 1% drift
# through, which on a KRW 100M premium is a million-won billing error.
DEFAULT_EPSILON: float = 1e-4

GroupKey = tuple[str, int | None]


@dataclass(frozen=True)
class ShareGroupReport:
    """Result for a single (cover_note_no, year) group."""

    cover_note_no: str
    year: int | None
    contract_ids: tuple[int, ...]
    share_sum: float
    delta: float  # share_sum - 1.0
    ok: bool


@dataclass(frozen=True)
class ShareValidationResult:
    """Aggregate result across all groups examined."""

    groups: tuple[ShareGroupReport, ...] = field(default_factory=tuple)

    @property
    def ok(self) -> bool:
        return all(g.ok for g in self.groups)

    @property
    def failed(self) -> tuple[ShareGroupReport, ...]:
        return tuple(g for g in self.groups if not g.ok)


class ShareSumError(ValueError):
    """Raised when a write would leave a (cover_note_no, year) group's share
    sum outside 1.0 +/- epsilon.

    Carries the failing reports so the caller can format a useful HTTP body.
    """

    def __init__(self, result: ShareValidationResult):
        self.result = result
        msgs = [
            f"cover_note_no={g.cover_note_no} year={g.year} sum={g.share_sum:.6f} delta={g.delta:+.6f}"
            for g in result.failed
        ]
        super().__init__("share sum != 1.0 for: " + "; ".join(msgs))


def _to_float(v) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def validate_share_sum(
    contracts: Iterable,
    *,
    epsilon: float = DEFAULT_EPSILON,
) -> ShareValidationResult:
    """Group `contracts` by (cover_note_no, year) and check each group's share
    sum is 1.0 +/- epsilon.

    Rows with a falsy `cover_note_no` or `share <= 0` are skipped — they aren't
    part of an active placement. An empty input yields an OK result.

    `contracts` may be SQLAlchemy Contract rows or any object with the
    attributes `id`, `cover_note_no`, `year`, `share`.
    """
    groups: dict[GroupKey, list] = {}
    for c in contracts:
        cn = getattr(c, "cover_note_no", None)
        if not cn:
            continue
        share = _to_float(getattr(c, "share", None))
        if share <= 0:
            continue
        key: GroupKey = (cn, getattr(c, "year", None))
        groups.setdefault(key, []).append(c)

    reports: list[ShareGroupReport] = []
    for (cn, year), rows in groups.items():
        s = sum(_to_float(getattr(r, "share", None)) for r in rows)
        delta = s - 1.0
        reports.append(
            ShareGroupReport(
                cover_note_no=cn,
                year=year,
                contract_ids=tuple(getattr(r, "id", -1) for r in rows),
                share_sum=s,
                delta=delta,
                ok=abs(delta) <= epsilon,
            )
        )

    reports.sort(key=lambda r: (r.cover_note_no, r.year or -1))
    return ShareValidationResult(groups=tuple(reports))


def assert_share_sum(
    contracts: Iterable,
    *,
    epsilon: float = DEFAULT_EPSILON,
) -> ShareValidationResult:
    """Like `validate_share_sum`, but raises `ShareSumError` if any group fails.

    Returns the result on success so callers can inspect ok groups too.
    """
    result = validate_share_sum(contracts, epsilon=epsilon)
    if not result.ok:
        raise ShareSumError(result)
    return result


def soft_check_for_fallback(
    contracts: Sequence,
    *,
    epsilon: float = DEFAULT_EPSILON,
) -> tuple[Sequence, list[dict]]:
    """For the SOC fallback path (soc_stream.py): group contracts by year,
    return (rows_to_use, warnings).

    Selection rule:
      - exactly one (cover_note_no, year) group with share sum ≈ 1.0  -> use it
      - none, or multiple, valid groups                              -> use all
        rows but emit per-group warnings so the user sees the drift before
        sending SOCs.

    Warning shape mirrors the SOC dict's `warnings` field:
      {"code": "share_sum_mismatch", "cover_note_no": ..., "year": ...,
       "expected": 1.0, "actual": <sum>, "delta": <sum-1.0>}
    """
    result = validate_share_sum(contracts, epsilon=epsilon)
    valid_groups = [g for g in result.groups if g.ok]

    warnings: list[dict] = []
    for g in result.groups:
        if g.ok:
            continue
        warnings.append({
            "code": "share_sum_mismatch",
            "cover_note_no": g.cover_note_no,
            "year": g.year,
            "expected": 1.0,
            "actual": round(g.share_sum, 6),
            "delta": round(g.delta, 6),
        })

    if len(valid_groups) == 1:
        only = valid_groups[0]
        chosen_ids = set(only.contract_ids)
        rows_to_use = [c for c in contracts if getattr(c, "id", None) in chosen_ids]
        if len(result.groups) > 1:
            warnings.append({
                "code": "multi_year_collapsed",
                "cover_note_no": only.cover_note_no,
                "chosen_year": only.year,
                "other_years": [g.year for g in result.groups if g is not only],
            })
        return rows_to_use, warnings

    return list(contracts), warnings
