"""Audit script — read-only reconciliation of ``slip_cases``-derived
KB SOC partial keys against KB SOC bordereau full keys.

The script does **no** database writes. It connects to the DB via the
project's ``app.config.settings.database_url`` (rewritten to the
psycopg2 driver) and pulls every ``slip_cases`` row whose extracted
JSONB declares ``cedant=KB``. Each row is run through the same
:func:`extract_keys_from_slip_case` the production sync would use,
then compared against the natural keys produced by parsing the KB
SOC fixtures (``backend/tests/fixtures/kb_borderau/`` by default).

Usage::

    cd backend && python -m scripts.audit_slip_cases_keys \\
        [--bordereau-dir DIR] \\
        [--json out.json]

The output highlights three categories:

1. **Both tiers agree** at ref level — slip_cases and bordereau both
   recorded a settlement under the same ``(recipient, ref_body)``.
2. **Bordereau-only** — claim was settled per the monthly file but
   the slip_cases pipeline never produced a record. Expected when
   the SOC went out before slip-cases adoption, or when the document
   was never run through the live SOC generator.
3. **slip_cases-only** — slip_cases recorded a settlement that the
   bordereau doesn't show. Suspicious; could indicate LLM extraction
   error, a missing bordereau month, or a SOC issued outside the
   monthly cadence.

Quality breakdown of the slip_cases keys is also reported so we can
see how many cases extract cleanly vs fall to ``inferred``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Iterable, Optional


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.parsers.kb_bordereau import (  # noqa: E402
    SHEET_KIND_SOC,
    parse_kb_bordereau,
)
from app.services.parsers.kb import (  # noqa: E402
    QUALITY_ORDER,
    SOCHistory,
    SlipCasesAdapter,
    extract_keys_from_slip_case,
)
from app.services.parsers.kb.slip_cases_sync import reconcile  # noqa: E402
from app.services.parsers.kb.soc_history import _ref_body  # noqa: E402


DEFAULT_BORDEREAU_DIR = ROOT / "tests" / "fixtures" / "kb_borderau"


# ─── DB query ──────────────────────────────────────────────────────────────


def _fetch_kb_slip_cases() -> list[dict]:
    """Pull every cedant=KB SOC slip_case from the live DB.

    Read-only. Uses sqlalchemy's sync engine so this can run without
    booting the asyncpg infrastructure that the FastAPI app uses.
    """
    from sqlalchemy import create_engine, text
    from app.config import settings

    url = settings.database_url.replace("+asyncpg", "+psycopg2", 1)
    engine = create_engine(url, pool_pre_ping=True)
    rows: list[dict] = []
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, doc_type, status, extracted, input_files
            FROM slip_cases
            WHERE is_deleted = false
              AND extracted->>'cedant' = 'KB'
              AND doc_type = 'SOC'
            ORDER BY created_at DESC
        """))
        for r in result.mappings():
            rows.append({
                "id": str(r["id"]),
                "doc_type": r["doc_type"],
                "status": r["status"],
                "extracted": r["extracted"],
                "input_files": r["input_files"],
            })
    return rows


# ─── Bordereau ingestion ───────────────────────────────────────────────────


def _load_bordereau_keys(directory: Path) -> tuple[SOCHistory, list[Path]]:
    """Parse every SOC xlsx under ``directory`` and accumulate keys."""
    history = SOCHistory()
    seen: list[Path] = []
    for path in sorted(directory.glob("**/*.xlsx")):
        try:
            r = parse_kb_bordereau(path)
        except Exception as e:
            print(f"  ! skipped {path.name}: {e}", file=sys.stderr)
            continue
        if r.sheet_kind == SHEET_KIND_SOC:
            history.add(r)
            seen.append(path)
    return history, seen


# ─── Reconciliation ────────────────────────────────────────────────────────


# ─── Reporting ─────────────────────────────────────────────────────────────


def render_report(rec: dict) -> str:
    out = [
        "=" * 72,
        "Slip-cases ↔ KB SOC bordereau reconciliation (read-only)",
        "=" * 72,
        f"slip_cases rows scanned:       {rec['slip_cases_total']}",
        f"  extracted partial keys:      {rec['sync_report']['extracted_keys']}",
        f"  admitted (threshold any):    {rec['sync_report']['admitted']}",
        f"  quality breakdown:",
    ]
    for q, n in rec["sync_report"]["quality_breakdown"].items():
        out.append(f"    {q:<10s} {n}")
    out += [
        "",
        f"bordereau full keys (rows):    {rec['bordereau_keys_total']}",
        f"bordereau (recipient,ref) refs: {rec['bordereau_refs_total']}",
        f"slip partial (recipient,ref):   {rec['slip_refs_total']}",
        "",
        f"=== Ref-level reconciliation (counts) ===",
        f"  both tiers agree: {len(rec['ref_level_both'])}",
        f"  bordereau-only:   {len(rec['ref_level_bordereau_only'])}",
        f"  slip-only:        {len(rec['ref_level_slip_only'])}    "
        f"({'⚠ investigate' if rec['ref_level_slip_only'] else 'ok'})",
    ]
    if rec["ref_level_both"]:
        out.append("\n--- Both tiers agree (sample up to 10) ---")
        for ref in rec["ref_level_both"][:10]:
            out.append(f"  {ref[0][:24]} / {ref[1]}")
    if rec["ref_level_slip_only"]:
        out.append("\n--- slip-only (suspicious — full list) ---")
        for ref in rec["ref_level_slip_only"]:
            out.append(f"  {ref[0][:24]} / {ref[1]}")
    if rec["sync_report"]["skipped"]:
        out.append("\n--- Skip reasons (sample up to 10) ---")
        for s in rec["sync_report"]["skipped"][:10]:
            out.append(f"  case={s['slip_case_id']}: {s['reason']}")
    return "\n".join(out)


# ─── CLI ───────────────────────────────────────────────────────────────────


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument(
        "--bordereau-dir",
        type=Path, default=DEFAULT_BORDEREAU_DIR,
        help=(
            f"Directory holding KB SOC xlsx fixtures "
            f"(default: {DEFAULT_BORDEREAU_DIR})"
        ),
    )
    p.add_argument(
        "--json",
        type=Path, default=None,
        help="Optional path to write the structured reconciliation as JSON.",
    )
    p.add_argument(
        "--from-rows-json",
        type=Path, default=None,
        help=(
            "Read slip_cases rows from a JSON file instead of querying "
            "the database. Useful for offline audits / tests."
        ),
    )
    args = p.parse_args()

    if args.from_rows_json:
        slip_rows = json.loads(args.from_rows_json.read_text())
        print(
            f"Loaded {len(slip_rows)} slip_cases rows from "
            f"{args.from_rows_json}",
            file=sys.stderr,
        )
    else:
        print("Querying slip_cases from DB (read-only)...", file=sys.stderr)
        slip_rows = _fetch_kb_slip_cases()
        print(f"  fetched {len(slip_rows)} KB SOC rows", file=sys.stderr)

    print(f"Loading SOC bordereaux from {args.bordereau_dir}", file=sys.stderr)
    bordereau_history, seen_paths = _load_bordereau_keys(args.bordereau_dir)
    print(f"  parsed {len(seen_paths)} SOC files", file=sys.stderr)

    rec = reconcile(slip_rows, bordereau_history)
    print(render_report(rec))

    if args.json:
        # Convert tuple keys (set members) into list-of-list for JSON.
        rec_for_json = dict(rec)
        for fld in (
            "ref_level_both", "ref_level_bordereau_only", "ref_level_slip_only",
        ):
            rec_for_json[fld] = [list(t) for t in rec[fld]]
        args.json.write_text(json.dumps(rec_for_json, ensure_ascii=False, indent=2))
        print(f"\nwrote {args.json}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
