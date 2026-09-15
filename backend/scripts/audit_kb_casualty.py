"""One-off audit of the KB ``재해명 (Casualty)`` column.

Run after Phase-1 to characterise the shape of the casualty
disambiguator across the four shipped fixtures. The output is meant to
be eyeballed once and the headline numbers cited in the parsers'
``README.md``; rerun whenever new fixtures are added so the
classification heuristics stay grounded in real data.

The DB ``claims`` table does not store casualty (only ``remarks``), so
this script reads from the xlsx fixtures only. If a future Phase 2
schema change adds a casualty column, extend this script to also pull
from there.

Usage::

    cd backend && python -m scripts.audit_kb_casualty
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

# Allow ``python -m scripts.audit_kb_casualty`` from the backend root,
# or running the file directly.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.parsers.kb_bordereau import parse_kb_bordereau  # noqa: E402

FIXTURES_DIR = ROOT / "tests" / "fixtures" / "kb_borderau"


# ─── Pattern classification ────────────────────────────────────────────────


# Coded discriminator: e.g. ``인001 미상``, ``물001 미상``. The leading
# character is 인 (personal) or 물 (property), followed by a 3-digit
# serial and a status word (most often ``미상``). This is the form that
# disambiguates sibling rows in the parser's natural key.
CODED_PATTERN = re.compile(r"^[인물]\d{3}\s+\S+$")

# Korean masked names: a single Hangul, an asterisk, then 1+ Hangul
# (e.g. ``김*숙``, ``박*혜``). Sometimes 2-character first name with
# multiple asterisks (``Cho***``). This is a person identifier, not a
# casualty-type discriminator — its value is fragile and unsuitable as
# a stable key.
MASKED_KOREAN_NAME = re.compile(r"^[가-힣]{1,2}\*[가-힣]+$")
MASKED_LATIN_NAME = re.compile(r"^[A-Za-z]{1,4}\*+$")

# Generic single-word markers for damage type (``재해자`` = injured
# person, ``재해물`` = damaged property, ``이익상실`` = loss of profit,
# ``담장`` = fence, ``누수`` = water leak).
GENERIC_MARKERS = frozenset({
    "재해자", "재해물", "이익상실", "담장", "누수", "누수(학교)",
})


def classify(s: str | None) -> str:
    if s is None or not s.strip():
        return "(empty)"
    s = s.strip()
    if CODED_PATTERN.match(s):
        return "coded[인/물]"
    if MASKED_KOREAN_NAME.match(s):
        return "masked_name_kr"
    if MASKED_LATIN_NAME.match(s):
        return "masked_name_en"
    if s in GENERIC_MARKERS:
        return "generic_marker"
    return "free_text"


# ─── Main ──────────────────────────────────────────────────────────────────


def main() -> int:
    fixtures = sorted(FIXTURES_DIR.glob("*.xlsx"))
    if not fixtures:
        print(f"No fixtures found at {FIXTURES_DIR}", file=sys.stderr)
        return 1

    casualties: list[tuple[str, str]] = []  # (file_name, casualty)
    per_file_total: dict[str, int] = {}

    for path in fixtures:
        result = parse_kb_bordereau(path)
        per_file_total[path.name] = len(result.rows)
        for row in result.rows:
            if row.casualty is not None:
                casualties.append((path.name, row.casualty))

    print("=" * 72)
    print("KB Casualty (재해명) audit")
    print("=" * 72)

    print("\n--- Per-file row counts ---")
    for name, n in per_file_total.items():
        print(f"  {name:<48s} rows={n}")

    print(f"\nTotal rows across all fixtures: {sum(per_file_total.values())}")
    print(f"Rows with non-empty casualty:   {len(casualties)}")

    counter = Counter(c for _, c in casualties)
    print(f"Distinct casualty values:       {len(counter)}")

    classes = Counter(classify(c) for _, c in casualties)
    print("\n--- By classification ---")
    width = max(len(c) for c in classes) if classes else 12
    for cls, n in classes.most_common():
        pct = 100.0 * n / len(casualties) if casualties else 0
        print(f"  {cls:<{width}s} {n:>4d}  ({pct:5.1f}%)")

    print("\n--- Most-frequent values ---")
    for v, n in counter.most_common(15):
        print(f"  {n:>3d}  {classify(v):<18s}  {v!r}")

    # Sample of free-text values to show the long tail explicitly.
    free_text_samples = [
        v for v, _ in counter.items() if classify(v) == "free_text"
    ][:20]
    if free_text_samples:
        print("\n--- Free-text sample (up to 20) ---")
        for v in free_text_samples:
            print(f"  {v!r}")

    # Sibling-discriminator usage: how many distinct (file, ref) groups
    # have at least one 인/물 coded sibling? This is the population that
    # matters for Phase-2 dedup decisions.
    coded_count = sum(1 for c in counter if classify(c) == "coded[인/물]")
    print(f"\nCoded[인/물] distinct values: {coded_count}")
    print(
        "(These are the values that act as natural-key disambiguators "
        "for sibling personal/property rows under one KB Ref.)"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
