"""Custom exceptions for the deterministic bordereau parsers."""

from __future__ import annotations


class ParserError(Exception):
    """Base for all parser errors."""


class RefNoParseError(ValueError, ParserError):
    """Raised when a reference number cannot be parsed at all.

    Row-level parse failures are normally collected as warnings on the
    result object instead of raised, so this exception is reserved for
    the explicit `parse_strict()` path.
    """


class KBSchemaError(ParserError):
    """Raised when a KB bordereau file fails structural validation.

    Examples: required sheet missing, header row not found, required
    column missing. The message identifies the specific gap so the
    operator can correct the source file or update the parser config.
    """


class HWSchemaError(ParserError):
    """Reserved for the future HW document parser. Kept here so the
    error hierarchy is stable when HW parsing lands in a later phase.
    """
