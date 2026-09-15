"""Run the KB monthly-diff engine over a pair of local directories
and produce a human-readable audit report plus a structured JSON dump.

Usage::

    cd backend && python -m scripts.audit_kb_monthly \\
        --previous-dir /path/to/2026-01/ \\
        --current-dir  /path/to/2026-02/ \\
        --soc-history-dirs /path/to/2026-01/ /path/to/2026-02/ \\
        [--json out.json]

Each input directory should contain xlsx files that
:func:`parse_kb_bordereau` recognises (sheet names ``OS List`` /
``SOC``). The script categorises by parsed sheet kind + recipient
rather than by file name, so directory layout is flexible.

Output sections, in order:
1. SETTLED / DISMISSED — the highest-impact transitions
2. NEW / REOPENED — new claims and reactivations
3. REVISION_BUMP / REVISION_GAP — claim updates
4. **REVISION_REGRESSION** — anomaly section (peer level with #1)
5. UNCHANGED — counts only, full list available in JSON
6. Audit warnings — ``casualty_drift_suspected`` and
   ``casualty_ambiguous_with_siblings`` notes that need human review
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.parsers.kb_bordereau import (  # noqa: E402
    SHEET_KIND_PLA,
    SHEET_KIND_SOC,
    KBBordereauResult,
    parse_kb_bordereau,
)
from app.services.parsers.kb import (  # noqa: E402
    ClaimTransition,
    KBMonthlySnapshot,
    SOCHistory,
    TransitionType,
    diff_monthly,
)
from app.services.parsers.kb.monthly_diff import (  # noqa: E402
    ANOMALY_REGRESSION,
    DRIFT_AMBIGUOUS,
    DRIFT_UNIQUE,
)


# ─── Discovery ─────────────────────────────────────────────────────────────


def _categorise_results(
    paths: Iterable[Path],
) -> tuple[Optional[KBBordereauResult], Optional[KBBordereauResult],
           Optional[KBBordereauResult], Optional[KBBordereauResult]]:
    """Parse every xlsx in ``paths`` and route into the four snapshot
    slots based on sheet_kind + recipient. Returns
    ``(pla_ins, pla_daewoo, soc_ins, soc_daewoo)`` with ``None`` for
    slots that didn't match any file.
    """
    pla_ins = pla_daewoo = soc_ins = soc_daewoo = None
    for p in sorted(paths):
        try:
            r = parse_kb_bordereau(p)
        except Exception as e:
            print(f"  ! skipped {p.name}: {e}", file=sys.stderr)
            continue
        is_daewoo = "DAEWOO" in (r.recipient or "").upper()
        if r.sheet_kind == SHEET_KIND_PLA:
            if is_daewoo and pla_daewoo is None:
                pla_daewoo = r
            elif not is_daewoo and pla_ins is None:
                pla_ins = r
        elif r.sheet_kind == SHEET_KIND_SOC:
            if is_daewoo and soc_daewoo is None:
                soc_daewoo = r
            elif not is_daewoo and soc_ins is None:
                soc_ins = r
    return pla_ins, pla_daewoo, soc_ins, soc_daewoo


def _load_snapshot(directory: Path, year: int, month: int) -> KBMonthlySnapshot:
    files = list(directory.glob("*.xlsx")) + list(directory.glob("*.xls"))
    pla_ins, pla_daewoo, soc_ins, soc_daewoo = _categorise_results(files)
    return KBMonthlySnapshot(
        year=year,
        month=month,
        pla_ins=pla_ins,
        pla_daewoo=pla_daewoo,
        soc_ins=soc_ins,
        soc_daewoo=soc_daewoo,
    )


def _load_soc_history(directories: Iterable[Path]) -> SOCHistory:
    h = SOCHistory()
    for d in directories:
        for p in sorted(d.glob("*.xlsx")):
            try:
                r = parse_kb_bordereau(p)
            except Exception as e:
                print(f"  ! soc-history skipped {p.name}: {e}", file=sys.stderr)
                continue
            if r.sheet_kind == SHEET_KIND_SOC:
                h.add(r)
    return h


# ─── Reporting ─────────────────────────────────────────────────────────────


def _by_type(transitions: list[ClaimTransition]) -> dict[TransitionType, list[ClaimTransition]]:
    out: dict[TransitionType, list[ClaimTransition]] = defaultdict(list)
    for t in transitions:
        out[t.transition].append(t)
    return out


def _format_row(t: ClaimTransition) -> str:
    rec = t.base_key[0]
    ref = t.base_key[1]
    cas = t.base_key[2]
    item = t.base_key[3]
    cession = t.base_key[4]
    rev_repr = ""
    if t.previous and t.current:
        rev_repr = f" rev {t.previous.revision} → {t.current.revision}"
    elif t.previous:
        rev_repr = f" rev {t.previous.revision}"
    elif t.current:
        rev_repr = f" rev {t.current.revision}"
    return (
        f"  {ref} casualty={cas!r} item={item} cession={cession}"
        f"{rev_repr}  ({rec[:20]})"
    )


def _format_section(
    title: str,
    rows: list[ClaimTransition],
    *,
    show_rows: bool = True,
    limit: Optional[int] = None,
) -> list[str]:
    out = [f"\n=== {title} ({len(rows)}) ===" + (" — none" if not rows else "")]
    if not rows or not show_rows:
        return out
    for t in rows[:limit] if limit else rows:
        out.append(_format_row(t))
        for note in t.notes:
            out.append(f"      ↳ {note}")
    if limit and len(rows) > limit:
        out.append(f"  ... ({len(rows) - limit} more)")
    return out


def _audit_warnings(
    transitions: list[ClaimTransition],
) -> tuple[list[ClaimTransition], list[ClaimTransition]]:
    """Split out transitions that carry casualty-drift audit notes.
    Same transition can appear in either bucket independently."""
    drift = [
        t for t in transitions
        if any(DRIFT_UNIQUE in n for n in t.notes)
    ]
    ambiguous = [
        t for t in transitions
        if any(DRIFT_AMBIGUOUS in n for n in t.notes)
    ]
    return drift, ambiguous


def _serialize(t: ClaimTransition) -> dict:
    return {
        "base_key": list(t.base_key),
        "transition": t.transition.value,
        "soc_seen": t.soc_seen,
        "previous_revision": t.previous.revision if t.previous else None,
        "current_revision": t.current.revision if t.current else None,
        "previous_row_index": t.previous.row_index if t.previous else None,
        "current_row_index": t.current.row_index if t.current else None,
        "notes": list(t.notes),
    }


def render_report(
    transitions: list[ClaimTransition],
    *,
    previous_label: str,
    current_label: str,
) -> str:
    grouped = _by_type(transitions)
    total = len(transitions)

    lines = [
        "=" * 72,
        f"KB monthly diff — {previous_label} → {current_label}",
        "=" * 72,
        f"Total transitions: {total}",
        "Counts by type:",
    ]
    for tt in TransitionType:
        n = len(grouped.get(tt, []))
        lines.append(f"  {tt.value:<22s} {n:>4d}")

    # Section 1: settlements / dismissals — highest signal-to-noise.
    lines += _format_section("SETTLED (지급 종결)",
                             grouped.get(TransitionType.SETTLED, []))
    lines += _format_section("DISMISSED (면책 종결)",
                             grouped.get(TransitionType.DISMISSED, []))

    # Section 2: appearances.
    lines += _format_section("REOPENED",
                             grouped.get(TransitionType.REOPENED, []))
    lines += _format_section("NEW",
                             grouped.get(TransitionType.NEW, []),
                             limit=20)

    # Section 3: claim updates.
    lines += _format_section("REVISION_BUMP",
                             grouped.get(TransitionType.REVISION_BUMP, []),
                             limit=15)
    lines += _format_section("REVISION_GAP",
                             grouped.get(TransitionType.REVISION_GAP, []))

    # Section 4: anomaly — kept at peer level with SETTLED/DISMISSED so
    # operators don't miss revision-going-backwards events buried in
    # the bulk transitions.
    lines += _format_section(
        "REVISION_REGRESSION (anomaly:regression)",
        grouped.get(TransitionType.REVISION_REGRESSION, []),
    )

    # Section 5: counts only for UNCHANGED.
    n_unchanged = len(grouped.get(TransitionType.UNCHANGED, []))
    lines.append(f"\n=== UNCHANGED ({n_unchanged}) ===")
    lines.append("  (full list omitted — see JSON for details)")

    # Section 6: audit warnings.
    drift, ambiguous = _audit_warnings(transitions)
    lines += _format_section(
        f"AUDIT — casualty_drift_suspected (human review)",
        drift,
    )
    lines += _format_section(
        f"AUDIT — casualty_ambiguous_with_siblings (human review)",
        ambiguous,
    )

    return "\n".join(lines)


# ─── CLI ───────────────────────────────────────────────────────────────────


def _parse_label(directory: Path) -> str:
    """Best-effort label for the report header. Picks ``YYYY-MM`` from
    a ``YYYY_MM`` or ``YYYY-MM`` directory name; otherwise uses the
    name as-is."""
    name = directory.name
    digits = name.replace("_", "-")
    if len(digits) >= 7 and digits[:4].isdigit() and digits[5:7].isdigit():
        return f"{digits[:4]}-{digits[5:7]}"
    return name


def _parse_year_month(directory: Path) -> tuple[int, int]:
    label = _parse_label(directory)
    if "-" in label and len(label) >= 7:
        try:
            return int(label[:4]), int(label[5:7])
        except ValueError:
            pass
    # Fallback: assume the snapshot is recent. Fail loudly so the user
    # supplies a sensibly-named directory.
    raise SystemExit(
        f"could not parse YYYY-MM from directory name {directory.name!r}; "
        "name the directory 'YYYY-MM' or 'YYYY_MM'"
    )


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--previous-dir", type=Path, required=True)
    p.add_argument("--current-dir", type=Path, required=True)
    p.add_argument(
        "--soc-history-dirs",
        type=Path, nargs="+", required=True,
        help="Directories whose SOC files build the settlement history.",
    )
    p.add_argument(
        "--json",
        type=Path, default=None,
        help="Optional path to write a structured JSON dump.",
    )
    args = p.parse_args()

    prev_y, prev_m = _parse_year_month(args.previous_dir)
    curr_y, curr_m = _parse_year_month(args.current_dir)

    print(f"Loading previous snapshot from {args.previous_dir}", file=sys.stderr)
    prev = _load_snapshot(args.previous_dir, prev_y, prev_m)
    print(f"Loading current snapshot from  {args.current_dir}", file=sys.stderr)
    curr = _load_snapshot(args.current_dir, curr_y, curr_m)
    print(f"Loading SOC history from {[str(d) for d in args.soc_history_dirs]}",
          file=sys.stderr)
    soc = _load_soc_history(args.soc_history_dirs)
    print(f"  SOC history: {len(soc)} distinct full keys", file=sys.stderr)

    transitions = diff_monthly(prev, curr, soc)
    print(render_report(
        transitions,
        previous_label=prev.label,
        current_label=curr.label,
    ))

    if args.json:
        payload = {
            "previous": prev.label,
            "current": curr.label,
            "soc_history_size": len(soc),
            "counts": dict(
                Counter(t.transition.value for t in transitions)
            ),
            "transitions": [_serialize(t) for t in transitions],
        }
        args.json.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
        print(f"\nwrote {args.json}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
