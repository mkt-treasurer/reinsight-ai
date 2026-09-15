"""Scan a `testbench-dataset/<doc_type>/{input,ground_truth,generated}`
tree, parse ref-numbers out of filenames, and emit pair triples ready
to feed into the extraction pipeline.

Pairing strategy (designed for the dataset README's filename layout):

1. **ref-no key** — try `\\d{4}-\\d{7,10}` first. Two files in different
   source folders sharing the same ref share a pair key.
2. **filename-stem fallback** — if a file has no ref (typical for
   bordereau ground-truth PDFs that span multiple incidents), it joins
   an "unkeyed" pool. Unkeyed pools across the three sources are zipped
   by sort order, on the assumption the operator places matching files
   one-for-one inside the folder.

This is deliberately conservative: when in doubt the scanner emits the
pair anyway (status=`gt_missing` / `gen_missing`) so the operator sees
unpaired files instead of silently dropping them.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

DOC_TYPES: tuple[str, ...] = ("pla", "soc", "pla_bordereau", "soc_bordereau")
SOURCES: tuple[str, ...] = ("input", "ground_truth", "generated")
SUPPORTED_SUFFIXES: frozenset[str] = frozenset(
    {".pdf", ".png", ".jpg", ".jpeg"}
)

_REF_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Anchored on non-digit (or string start/end) rather than `\b` —
    # the cedant convention `_2013-0000539637` puts an underscore in
    # front of the ref, which counts as a word character and breaks
    # `\b`-based matching.
    re.compile(r"(?:^|[^0-9])(\d{4}-\d{10})(?:[^0-9]|$)"),
    re.compile(r"(?:^|[^0-9])(\d{4}-\d{7,9})(?:[^0-9]|$)"),
)
_REINSURER_PAREN = re.compile(r"\(([^()]+)\)")
_COUNTER_RE = re.compile(r"^\d+$")
_DOL_RE = re.compile(r"^DOL\b", re.IGNORECASE)


@dataclass(frozen=True)
class ScannedFile:
    """A single PDF/image picked up from the dataset tree."""

    source: str            # 'input' | 'ground_truth' | 'generated'
    path: Path
    ref_no: str | None     # parsed from filename (None ⇒ unkeyed)
    reinsurer: str | None  # last meaningful parenthesised token


@dataclass
class ScannedPair:
    """One (input?, ground_truth?, generated?) triple inside a doc_type."""

    doc_type: str
    pair_key: str           # ref_no when available; otherwise `<doc>:#N`
    ref_no: str | None
    reinsurer: str | None
    input: ScannedFile | None = None
    gt: ScannedFile | None = None
    gen: ScannedFile | None = None
    warnings: list[str] = field(default_factory=list)

    @property
    def has_gt(self) -> bool:
        return self.gt is not None

    @property
    def has_gen(self) -> bool:
        return self.gen is not None


def extract_ref_no(name: str) -> str | None:
    """Return the first ref-no pattern found in ``name`` or ``None``."""
    for pat in _REF_PATTERNS:
        m = pat.search(name)
        if m:
            return m.group(1)
    return None


def pick_reinsurer(name: str) -> str | None:
    """Last parenthesised token that doesn't look like a counter or DOL.

    Mirrors the frontend testbench's ``pickReinsurerFromFilename`` so
    the python pipeline groups files the same way the manual compare
    page would.
    """
    matches = [m.group(1).strip() for m in _REINSURER_PAREN.finditer(name)]
    for token in reversed(matches):
        if not token:
            continue
        if _COUNTER_RE.match(token) or _DOL_RE.match(token):
            continue
        return token
    return None


def _scan_source_folder(folder: Path, source: str) -> list[ScannedFile]:
    if not folder.is_dir():
        return []
    out: list[ScannedFile] = []
    for entry in sorted(folder.iterdir()):
        if not entry.is_file():
            continue
        if entry.name.startswith("."):
            continue
        if entry.suffix.lower() not in SUPPORTED_SUFFIXES:
            continue
        out.append(
            ScannedFile(
                source=source,
                path=entry,
                ref_no=extract_ref_no(entry.name),
                reinsurer=pick_reinsurer(entry.name),
            )
        )
    return out


def _attach(pair: ScannedPair, sf: ScannedFile) -> None:
    if sf.source == "input":
        pair.input = sf
    elif sf.source == "ground_truth":
        pair.gt = sf
    elif sf.source == "generated":
        pair.gen = sf


def _pair_doc_type(doc_type: str, base: Path) -> list[ScannedPair]:
    scanned: dict[str, list[ScannedFile]] = {
        s: _scan_source_folder(base / doc_type / s, s) for s in SOURCES
    }
    pairs: dict[str, ScannedPair] = {}
    unkeyed: dict[str, list[ScannedFile]] = {s: [] for s in SOURCES}

    for source, files in scanned.items():
        for sf in files:
            if sf.ref_no is None:
                unkeyed[source].append(sf)
                continue
            pair = pairs.setdefault(
                sf.ref_no,
                ScannedPair(
                    doc_type=doc_type,
                    pair_key=sf.ref_no,
                    ref_no=sf.ref_no,
                    reinsurer=sf.reinsurer,
                ),
            )
            _attach(pair, sf)
            if pair.reinsurer is None and sf.reinsurer:
                pair.reinsurer = sf.reinsurer

    # Absorb unkeyed files into ref-keyed pairs that are missing the
    # corresponding source slot. Common case: the GT bordereau PDF
    # spans multiple incidents and was filed without a ref-no in its
    # name, while the matching INPUT does carry the ref. If exactly
    # one ref-keyed pair has the slot empty AND there's exactly one
    # unkeyed file of that source, they're an unambiguous match.
    for source, bucket in unkeyed.items():
        if len(bucket) != 1:
            continue
        candidates = [
            p for p in pairs.values()
            if getattr(p, "input" if source == "input"
                       else "gt" if source == "ground_truth" else "gen") is None
        ]
        if len(candidates) != 1:
            continue
        sf = bucket[0]
        _attach(candidates[0], sf)
        if candidates[0].reinsurer is None and sf.reinsurer:
            candidates[0].reinsurer = sf.reinsurer
        candidates[0].warnings.append(
            f"{source}: ref-no 미검출 → 빈 슬롯에 흡수"
        )
        unkeyed[source] = []

    # Zip whatever still has no ref by sort order across sources.
    longest = max((len(v) for v in unkeyed.values()), default=0)
    for idx in range(longest):
        pair = ScannedPair(
            doc_type=doc_type,
            pair_key=f"{doc_type}:#{idx + 1}",
            ref_no=None,
            reinsurer=None,
        )
        attached_any = False
        for source in SOURCES:
            bucket = unkeyed[source]
            if idx >= len(bucket):
                continue
            sf = bucket[idx]
            _attach(pair, sf)
            attached_any = True
            if pair.reinsurer is None and sf.reinsurer:
                pair.reinsurer = sf.reinsurer
        if attached_any:
            pair.warnings.append(
                "ref-no 미검출 — 폴더 정렬 순서로 매칭"
            )
            pairs[pair.pair_key] = pair

    return list(pairs.values())


def scan_dataset(
    base: Path, doc_types: Iterable[str] | None = None
) -> list[ScannedPair]:
    """Walk the dataset tree and return every scanned pair.

    Pairs are ordered by (doc_type, ref_no, pair_key). Each pair has
    at least one of input/gt/gen populated — pairs with everything
    missing are pruned (they can't happen in practice but the
    invariant simplifies downstream code).
    """
    types = tuple(doc_types) if doc_types else DOC_TYPES
    out: list[ScannedPair] = []
    for dt in types:
        if dt not in DOC_TYPES:
            continue
        out.extend(_pair_doc_type(dt, base))
    out = [p for p in out if (p.input or p.gt or p.gen)]
    out.sort(key=lambda p: (p.doc_type, p.ref_no or "", p.pair_key))
    return out
