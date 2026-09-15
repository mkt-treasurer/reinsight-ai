"""Phase-2 error types.

Phase 1 errors live in :mod:`parsers.errors`; we extend rather than
replace so existing imports keep working.
"""

from __future__ import annotations

from ..errors import ParserError


class KBSnapshotError(ParserError):
    """Raised when a :class:`KBMonthlySnapshot` cannot be assembled.

    Includes: required PLA file missing, sheet_kind mismatch, duplicate
    base key within a single PLA snapshot (which would violate the
    Phase-1 uniqueness invariant the diff engine relies on).
    """
