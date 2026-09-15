"""Demo evidence logging for the placement RQ-slip tool.

Two channels, both append-only and gitignored under ``backend/logs/rq_slip/``:

1. **extract_<ts>.json** — one file per ``/extract`` call. Records the
   uploaded filenames, the prompt size, the raw Gemini response text and
   the parsed structured output. Lets us inspect "what did the model
   actually say" after a live demo without rerunning Gemini.

2. **events.jsonl** — newline-delimited JSON. Each case lifecycle action
   (load / save / verdict / status) appends one line. Lets us replay the
   demo session timeline (which case, when, in what order).

Failures NEVER raise — audit logging is best-effort. If the disk is full
or the path is unwritable, we log a warning and let the request succeed.
The caller does not need to wrap these calls.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ``backend/`` root → backend/logs/rq_slip/. Resolved relative to this file so
# the path is stable regardless of the CWD a process is launched with.
_LOG_ROOT = Path(__file__).resolve().parents[2] / "logs" / "rq_slip"

# extract_*.json holds the raw Gemini response (insured names, financials =
# PII). Keep it only long enough to tune the prompt after a demo, then
# auto-purge. RQ_SLIP_LOG_RETENTION_DAYS=0 disables purging.
_RETENTION_DAYS = int(os.environ.get("RQ_SLIP_LOG_RETENTION_DAYS", "7"))
# RQ_SLIP_AUDIT_RAW=0 → never persist the raw response / parsed values, only a
# redacted shape summary (for environments that must hold zero PII at rest).
_STORE_RAW = os.environ.get("RQ_SLIP_AUDIT_RAW", "1") != "0"


def _purge_old(root: Path) -> None:
    """Best-effort delete of extract logs older than the retention window."""
    if _RETENTION_DAYS <= 0:
        return
    cutoff = datetime.utcnow().timestamp() - _RETENTION_DAYS * 86400
    try:
        for p in root.glob("extract_*.json"):
            try:
                if p.stat().st_mtime < cutoff:
                    p.unlink()
            except OSError:
                pass
    except OSError:
        pass


def _ensure_dir() -> Path | None:
    try:
        _LOG_ROOT.mkdir(parents=True, exist_ok=True)
        return _LOG_ROOT
    except OSError as exc:
        logger.warning("rq_audit: cannot create log dir %s: %s", _LOG_ROOT, exc)
        return None


def log_extract(
    *,
    request_id: str,
    filenames: list[str],
    text_chars: int,
    raw_response: str | None,
    parsed: dict | None,
    error: str | None = None,
) -> None:
    """Persist a single /extract call for post-demo inspection.

    ``raw_response`` is the un-parsed Gemini output — kept verbatim so we
    can audit prompt-vs-output behaviour even if the JSON extraction
    fails later in the pipeline.
    """
    root = _ensure_dir()
    if root is None:
        return
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    path = root / f"extract_{ts}_{request_id[:8]}.json"
    if _STORE_RAW:
        stored_raw, stored_parsed = raw_response, parsed
    else:
        # PII-safe mode: keep the shape for debugging, drop the values.
        stored_raw = f"<redacted: {len(raw_response or '')} chars>"
        stored_parsed = (
            {"_keys": sorted(parsed.keys())} if isinstance(parsed, dict) else None
        )
    payload = {
        "request_id": request_id,
        "ts": datetime.utcnow().isoformat() + "Z",
        "filenames": filenames,
        "text_chars": text_chars,
        "raw_response": stored_raw,
        "parsed": stored_parsed,
        "error": error,
    }
    try:
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    except OSError as exc:
        logger.warning("rq_audit: cannot write extract log %s: %s", path, exc)
    # Bound the PII-at-rest window: drop logs past the retention horizon.
    _purge_old(root)


def log_event(action: str, *, case_id: str | None = None, **detail: Any) -> None:
    """Append a structured event to ``events.jsonl``.

    ``action`` is a short string like ``case.create`` / ``case.update`` /
    ``case.verdict`` / ``case.sent`` / ``case.delete``. ``detail`` is
    free-form context (verdict value, status, line, insured, etc.).
    """
    root = _ensure_dir()
    if root is None:
        return
    path = root / "events.jsonl"
    record = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "case_id": case_id,
        **detail,
    }
    try:
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError as exc:
        logger.warning("rq_audit: cannot append event log %s: %s", path, exc)


def new_request_id() -> str:
    """Short unique id used to correlate an extract log with server logs."""
    return uuid.uuid4().hex
