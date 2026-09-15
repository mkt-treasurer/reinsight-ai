"""Dump / load RQ-slip cases as JSON.

Lets an operator clone a known-good RQ-slip case from a development
environment onto a demo machine so a live PoC can fall back on a
pre-saved case if the live extract fails (Gemini timeout, network, etc).

Usage::

    cd backend && python -m scripts.rq_slip_io dump rq_cases.json
    cd backend && python -m scripts.rq_slip_io load rq_cases.json

The ``load`` command is idempotent: a row whose ``id`` already exists is
skipped, so re-running the same load is safe. Soft-deleted rows on the
source are excluded from the dump.

NOT a migration tool — the JSON format is tied to the current
``rq_slip_cases`` schema and may change. Re-dump after schema changes.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, text  # noqa: E402

from app.config import settings  # noqa: E402


def _engine():
    """Sync engine — keeps the script independent of the asyncpg loop."""
    url = settings.database_url.replace("+asyncpg", "+psycopg2", 1)
    return create_engine(url, pool_pre_ping=True)


def _iso(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v)


def dump(out_path: Path) -> int:
    """Write every non-deleted rq_slip_cases row to ``out_path``."""
    engine = _engine()
    rows: list[dict] = []
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT id, insured, line, reinsured, status,
                       extracted, slip, note,
                       last_edited_at, edit_count, reviewed_at, verdict,
                       created_at, updated_at
                FROM rq_slip_cases
                WHERE is_deleted = false
                ORDER BY created_at ASC
                """
            )
        )
        for r in result.mappings():
            rows.append(
                {
                    "id": str(r["id"]),
                    "insured": r["insured"],
                    "line": r["line"],
                    "reinsured": r["reinsured"],
                    "status": r["status"],
                    "extracted": r["extracted"],
                    "slip": r["slip"],
                    "note": r["note"],
                    "last_edited_at": _iso(r["last_edited_at"]),
                    "edit_count": r["edit_count"] or 0,
                    "reviewed_at": _iso(r["reviewed_at"]),
                    "verdict": r["verdict"],
                    "created_at": _iso(r["created_at"]),
                    "updated_at": _iso(r["updated_at"]),
                }
            )
    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    print(f"wrote {len(rows)} cases → {out_path}")
    return len(rows)


def load(in_path: Path) -> int:
    """Insert cases from ``in_path``. Rows whose id already exists are skipped."""
    data = json.loads(in_path.read_text())
    if not isinstance(data, list):
        raise SystemExit("expected a JSON array at the top level")

    engine = _engine()
    inserted = 0
    skipped = 0
    with engine.begin() as conn:
        for row in data:
            case_id = row.get("id")
            if not case_id:
                continue
            try:
                uuid.UUID(case_id)
            except ValueError:
                print(f"  ! invalid uuid skipped: {case_id}", file=sys.stderr)
                continue
            exists = conn.execute(
                text("SELECT 1 FROM rq_slip_cases WHERE id = :id"),
                {"id": case_id},
            ).first()
            if exists:
                skipped += 1
                continue
            conn.execute(
                text(
                    """
                    INSERT INTO rq_slip_cases (
                      id, insured, line, reinsured, status,
                      extracted, slip, note,
                      last_edited_at, edit_count, reviewed_at, verdict,
                      is_deleted, created_at, updated_at
                    ) VALUES (
                      :id, :insured, :line, :reinsured, :status,
                      CAST(:extracted AS JSONB), CAST(:slip AS JSONB), :note,
                      :last_edited_at, :edit_count, :reviewed_at, :verdict,
                      false, COALESCE(:created_at, NOW()), COALESCE(:updated_at, NOW())
                    )
                    """
                ),
                {
                    "id": case_id,
                    "insured": row.get("insured"),
                    "line": row.get("line"),
                    "reinsured": row.get("reinsured"),
                    "status": row.get("status") or "draft",
                    "extracted": json.dumps(row.get("extracted") or {}),
                    "slip": json.dumps(row.get("slip") or {}),
                    "note": row.get("note"),
                    "last_edited_at": row.get("last_edited_at"),
                    "edit_count": row.get("edit_count") or 0,
                    "reviewed_at": row.get("reviewed_at"),
                    "verdict": row.get("verdict"),
                    "created_at": row.get("created_at"),
                    "updated_at": row.get("updated_at"),
                },
            )
            inserted += 1
    print(f"inserted {inserted} cases, skipped {skipped} existing")
    return inserted


def main() -> int:
    p = argparse.ArgumentParser(description="Dump / load RQ-slip cases as JSON.")
    sub = p.add_subparsers(dest="cmd", required=True)
    p_dump = sub.add_parser("dump", help="export every rq_slip_cases row")
    p_dump.add_argument("path", type=Path)
    p_load = sub.add_parser("load", help="insert cases from a previously dumped JSON")
    p_load.add_argument("path", type=Path)
    args = p.parse_args()
    if args.cmd == "dump":
        dump(args.path)
    elif args.cmd == "load":
        load(args.path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
