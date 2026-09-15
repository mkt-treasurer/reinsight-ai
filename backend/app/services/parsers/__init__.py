"""Deterministic bordereau / claim document parsers.

Phase 1 scope:
- KB monthly bordereau (PLA `OS List` + SOC `SOC` sheets)
- KB reference-number parsing

HW reference-number parsing exists as a Phase-2 draft in
``parsers._unverified.hw_ref_no_draft`` but is intentionally excluded
from this public API. Production code must not depend on it until the
draft is verified against real HW fixtures.
"""

from .errors import (
    HWSchemaError,
    KBSchemaError,
    ParserError,
    RefNoParseError,
)
from .ref_no_parser import (
    ParsedRefNo,
    parse_kb_ref_no,
)

__all__ = [
    "HWSchemaError",
    "KBSchemaError",
    "ParsedRefNo",
    "ParserError",
    "RefNoParseError",
    "parse_kb_ref_no",
]
