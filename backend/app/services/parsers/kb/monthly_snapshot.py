"""Atomic-month container for a KB bordereau drop.

KB ships up to four files per month: PLA × {INS, DAEWOO} and SOC ×
{INS, DAEWOO}. They land at the same time and have to be diffed
together; bundling them in a single ``KBMonthlySnapshot`` keeps the
diff engine's signature small and guarantees the caller can't pass
half a month by accident.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ..kb_bordereau import (
    SHEET_KIND_PLA,
    SHEET_KIND_SOC,
    KBBordereauResult,
    parse_kb_bordereau,
)
from .errors import KBSnapshotError


@dataclass(frozen=True)
class KBMonthlySnapshot:
    """Four-slot container for one month's KB bordereau set.

    All four slots are optional individually because real months
    sometimes ship fewer files (e.g. no DAEWOO claims this month, or
    no SOC was issued). The only invariant: at least one PLA result
    must be present, otherwise there's nothing for the diff engine
    to chew on.
    """

    year: int
    month: int
    pla_ins: Optional[KBBordereauResult] = None
    pla_daewoo: Optional[KBBordereauResult] = None
    soc_ins: Optional[KBBordereauResult] = None
    soc_daewoo: Optional[KBBordereauResult] = None

    def __post_init__(self) -> None:
        if not (1 <= self.month <= 12):
            raise KBSnapshotError(
                f"month must be 1..12, got {self.month}"
            )
        if not (1900 <= self.year <= 2100):
            raise KBSnapshotError(
                f"year out of range: {self.year}"
            )

        if self.pla_ins is None and self.pla_daewoo is None:
            raise KBSnapshotError(
                "snapshot needs at least one PLA result; both PLA "
                "slots were None"
            )

        for label, expected, result in (
            ("pla_ins", SHEET_KIND_PLA, self.pla_ins),
            ("pla_daewoo", SHEET_KIND_PLA, self.pla_daewoo),
            ("soc_ins", SHEET_KIND_SOC, self.soc_ins),
            ("soc_daewoo", SHEET_KIND_SOC, self.soc_daewoo),
        ):
            if result is not None and result.sheet_kind != expected:
                raise KBSnapshotError(
                    f"{label} expected sheet_kind={expected!r}, got "
                    f"{result.sheet_kind!r} (file={result.file_name!r})"
                )

    # ─── Convenient iteration ──────────────────────────────────────────────

    def pla_results(self) -> list[KBBordereauResult]:
        """Return the non-None PLA results in canonical recipient order."""
        return [r for r in (self.pla_ins, self.pla_daewoo) if r is not None]

    def soc_results(self) -> list[KBBordereauResult]:
        """Return the non-None SOC results in canonical recipient order."""
        return [r for r in (self.soc_ins, self.soc_daewoo) if r is not None]

    @property
    def label(self) -> str:
        """Human-readable identifier used in audit output."""
        return f"{self.year:04d}-{self.month:02d}"

    # ─── Constructors ──────────────────────────────────────────────────────

    @classmethod
    def from_paths(
        cls,
        year: int,
        month: int,
        *,
        pla_ins: Optional[str | Path] = None,
        pla_daewoo: Optional[str | Path] = None,
        soc_ins: Optional[str | Path] = None,
        soc_daewoo: Optional[str | Path] = None,
    ) -> "KBMonthlySnapshot":
        """Parse each given path with :func:`parse_kb_bordereau` and
        assemble the snapshot. Slots left as ``None`` stay empty."""
        return cls(
            year=year,
            month=month,
            pla_ins=parse_kb_bordereau(pla_ins) if pla_ins else None,
            pla_daewoo=parse_kb_bordereau(pla_daewoo) if pla_daewoo else None,
            soc_ins=parse_kb_bordereau(soc_ins) if soc_ins else None,
            soc_daewoo=parse_kb_bordereau(soc_daewoo) if soc_daewoo else None,
        )
