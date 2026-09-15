"""Audit contract.share integrity across the whole DB.

Read-only. Walks every (cover_note_no, year) group with at least one row
whose share > 0, and prints groups whose shares don't sum to 1.0 +/- epsilon.

NOTE: as of 2026-05-04 the "shares per placement sum to 1.0" rule does NOT
hold for this DB — see `docs/adr-001-contract-share-invariant.md`. Roughly
96% of groups will appear here as "failing" because INS Corp typically books
only their own brokered slice. Treat this script as a structural probe, not
as a corruption finder. The interesting subset is groups where the *same*
reinsurer carries different shares across installment rows; that's a separate
invariant and is not what this script reports.

Run inside the backend container:

    python -m scripts.audit_contract_shares
    python -m scripts.audit_contract_shares --epsilon 1e-3
    python -m scripts.audit_contract_shares --json > drift.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict

from sqlalchemy import select

from app.database import async_session
from app.models.contract import Contract
from app.services.contract_validator import (
    DEFAULT_EPSILON,
    validate_share_sum,
)


async def _audit(epsilon: float) -> tuple[int, int, list[dict]]:
    async with async_session() as db:
        rows = (await db.execute(
            select(Contract).where(Contract.cover_note_no.isnot(None))
        )).scalars().all()

    result = validate_share_sum(rows, epsilon=epsilon)
    failed = [
        {
            "cover_note_no": g.cover_note_no,
            "year": g.year,
            "contract_ids": list(g.contract_ids),
            "share_sum": round(g.share_sum, 6),
            "delta": round(g.delta, 6),
            "row_count": len(g.contract_ids),
        }
        for g in result.failed
    ]
    return len(result.groups), len(failed), failed


def _format_human(total: int, failed_count: int, failed: list[dict]) -> str:
    lines = [
        f"groups examined : {total}",
        f"groups failing  : {failed_count}",
        "",
    ]
    if not failed:
        lines.append("OK — every (cover_note_no, year) group sums to 1.0 within epsilon.")
        return "\n".join(lines)

    failed_sorted = sorted(failed, key=lambda r: -abs(r["delta"]))
    lines.append(f"{'cover_note_no':<28} {'year':>6} {'rows':>5} {'sum':>10} {'delta':>10}")
    lines.append("-" * 64)
    for r in failed_sorted:
        lines.append(
            f"{(r['cover_note_no'] or '')[:28]:<28} "
            f"{(r['year'] if r['year'] is not None else '-'):>6} "
            f"{r['row_count']:>5} "
            f"{r['share_sum']:>10.6f} "
            f"{r['delta']:>+10.6f}"
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epsilon", type=float, default=DEFAULT_EPSILON)
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    args = parser.parse_args()

    total, failed_count, failed = asyncio.run(_audit(args.epsilon))

    if args.json:
        json.dump(
            {
                "epsilon": args.epsilon,
                "groups_examined": total,
                "groups_failing": failed_count,
                "failures": failed,
            },
            sys.stdout,
            ensure_ascii=False,
            indent=2,
            default=str,
        )
        print()
    else:
        print(_format_human(total, failed_count, failed))

    return 1 if failed_count else 0


if __name__ == "__main__":
    sys.exit(main())
