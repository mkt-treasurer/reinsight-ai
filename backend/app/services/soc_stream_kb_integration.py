"""Phase 3c — soc_stream integration helpers.

All KB-deterministic-parser logic that's specific to the live SOC
generation flow lives here so ``soc_stream.py`` only carries ~25
lines of glue. Every helper short-circuits on
``KB_PARSER_MODE == OFF`` so the legacy code path stays
byte-identical when the feature flag is off.

Surface:

- :func:`init_kb_integration` — build a per-stream context. Inactive
  when the flag is OFF.
- :func:`try_parse_kb_xlsx` — detect + parse a single xlsx; returns
  the LLM-context string only when ``mode == ON``. Records audit
  events regardless.
- :func:`run_kb_cross_checks` — compare every parsed result against
  the LLM Pass-1 output.
- :func:`finalize_kb_integration` — invoke the Phase-3d hook
  (transitions=[] in Phase 3c) and attach ``kb_audit`` to the
  ``evidence_payload`` returned to the user.

Every function is exception-safe: failures land in
``ctx.audit_events`` rather than propagating, so a misbehaving
deterministic step can never break the legacy SOC stream.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from openpyxl import load_workbook

from app.config import KB_PARSER_MODE, KBParserMode
from app.services.cedant_detector import detect_cedant
from app.services.parsers.kb import (
    CrossCheckResult,
    SOCHistory,
    apply_workflow_transitions,
    cross_check,
    to_llm_context,
)
from app.services.parsers.kb_bordereau import (
    SHEET_KIND_SOC,
    KBBordereauResult,
    parse_kb_bordereau,
)


logger = logging.getLogger(__name__)


# ─── Per-stream state ──────────────────────────────────────────────────────


@dataclass
class KBIntegrationContext:
    """Per-stream KB integration state.

    ``active`` is the master switch the helpers consult on every
    call; flipping it to ``False`` (which init does in OFF mode)
    short-circuits everything to a true no-op.
    """

    active: bool = False
    mode: KBParserMode = KBParserMode.OFF
    soc_history: SOCHistory = field(default_factory=SOCHistory)
    parsed_results: dict[str, KBBordereauResult] = field(default_factory=dict)
    audit_events: list[dict] = field(default_factory=list)
    cross_checks: list[CrossCheckResult] = field(default_factory=list)


def _audit(ctx: KBIntegrationContext, event: str, **fields: Any) -> None:
    """Push an audit-event dict onto the context. Always safe — even
    inactive contexts can have events appended (we just won't surface
    them in :func:`finalize_kb_integration`)."""
    ctx.audit_events.append({
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **fields,
    })


# ─── Bootstrap ─────────────────────────────────────────────────────────────


def init_kb_integration(db_session: Any = None) -> KBIntegrationContext:
    """Build a context appropriate for the current ``KB_PARSER_MODE``.

    Returns an inactive context when mode is OFF — every other helper
    early-exits on ``not ctx.active``. The ``db_session`` parameter
    exists for forward compatibility with Phase 3d (when SlipCases
    sync becomes part of the per-request flow); Phase 3c does not use
    it because the slip_cases tier provides no value to a per-request
    cross-check.
    """
    if KB_PARSER_MODE is KBParserMode.OFF:
        return KBIntegrationContext(active=False, mode=KBParserMode.OFF)

    ctx = KBIntegrationContext(active=True, mode=KB_PARSER_MODE)
    _audit(ctx, "kb_integration_initialised", mode=KB_PARSER_MODE.value)
    return ctx


# ─── Probe + parse ─────────────────────────────────────────────────────────


_HEADER_SCAN_LIMIT = 26
_SHEET_SCAN_LIMIT = 3


def _gather_header_text(tmp_path: str) -> tuple[list[str], str]:
    """Open the workbook lightly and return ``(sheet_names, header_text)``.

    The header_text is a space-joined concat of every non-empty cell
    value in the first ~25 rows of the first three sheets — enough
    to cover the KB letterhead + column headers without reading the
    whole file. Errors degrade to ``([], "")``.
    """
    try:
        wb = load_workbook(tmp_path, data_only=True, read_only=True)
        sheets = list(wb.sheetnames)
        parts: list[str] = []
        for sn in sheets[:_SHEET_SCAN_LIMIT]:
            ws = wb[sn]
            for r in range(1, min(_HEADER_SCAN_LIMIT, ws.max_row + 1)):
                for cell in ws[r]:
                    if cell.value:
                        parts.append(str(cell.value))
        wb.close()
        return sheets, " ".join(parts)
    except Exception as e:
        logger.warning("kb header probe failed for %s: %s", tmp_path, e)
        return [], ""


def try_parse_kb_xlsx(
    ctx: KBIntegrationContext,
    tmp_path: str,
    filename: str,
) -> Optional[str]:
    """Detect + parse one xlsx. Returns an LLM-context string only
    when the parser succeeded *and* mode is ``ON``.

    SHADOW mode parses (so cross-check has data) but returns ``None``
    so the LLM prompt stays unchanged. OFF mode is a no-op.
    """
    if not ctx.active:
        return None

    sheets, header_text = _gather_header_text(tmp_path)

    hint = detect_cedant(tmp_path, sheet_names=sheets, header_text=header_text)

    if hint.cedant != "KB":
        # Below-threshold matches still get audited so the operator
        # can spot near-misses that might warrant tuning.
        if hint.confidence > 0:
            _audit(
                ctx, "cedant_detector_below_threshold",
                filename=filename,
                confidence=hint.confidence,
                signals=list(hint.signals),
            )
        return None

    if hint.decision == "auto_with_audit":
        _audit(
            ctx, "kb_borderline_detected",
            filename=filename,
            confidence=hint.confidence,
            signals=list(hint.signals),
        )

    try:
        result = parse_kb_bordereau(tmp_path)
    except Exception as e:
        _audit(
            ctx, "kb_parse_failed",
            filename=filename,
            error=str(e),
            confidence=hint.confidence,
        )
        return None

    ctx.parsed_results[filename] = result
    if result.sheet_kind == SHEET_KIND_SOC:
        ctx.soc_history.add(result)

    _audit(
        ctx, "kb_parsed",
        filename=filename,
        sheet_kind=result.sheet_kind,
        rows=len(result.rows),
        recipient=result.recipient,
        decision=hint.decision,
        confidence=hint.confidence,
    )

    if ctx.mode is KBParserMode.ON:
        return to_llm_context(result)
    return None


# ─── Cross-check ───────────────────────────────────────────────────────────


def run_kb_cross_checks(
    ctx: KBIntegrationContext,
    llm_response: dict,
) -> list[CrossCheckResult]:
    """Run :func:`cross_check` for each parsed result against the
    Pass-1 LLM extraction. Records every check on ``ctx.cross_checks``.

    Always returns a (possibly empty) list — never raises. The caller
    is expected to surface severity via SSE events or audit-only
    logging based on the active mode.
    """
    if not ctx.active:
        return []
    if not isinstance(llm_response, dict):
        _audit(
            ctx, "cross_check_skipped",
            reason="llm_response is not a dict",
        )
        return []

    results: list[CrossCheckResult] = []
    for filename, det in ctx.parsed_results.items():
        try:
            cc = cross_check(det, llm_response)
        except Exception as e:
            _audit(
                ctx, "cross_check_error",
                filename=filename,
                error=str(e),
            )
            continue
        ctx.cross_checks.append(cc)
        results.append(cc)
        _audit(
            ctx, "cross_check",
            filename=filename,
            severity=cc.severity,
            epsilon_violated=cc.epsilon_violated,
            det_row_count=cc.deterministic_row_count,
            llm_row_count=cc.llm_row_count,
            details_count=len(cc.mismatch_details),
        )
    return results


# ─── Phase 3d hook + finalize ──────────────────────────────────────────────


def invoke_phase_3d_hook(ctx: KBIntegrationContext) -> list:
    """Phase 3d entry point. Phase 3c always passes ``transitions=[]``
    because no monthly diff happens inside a single SSE stream;
    Phase 3d will replace the empty list with a
    :func:`diff_monthly` invocation against a previous-month
    snapshot.
    """
    if not ctx.active:
        return []

    transitions: list = []  # Phase 3d: produce from diff_monthly(...)
    results = apply_workflow_transitions(transitions, mode=ctx.mode)
    _audit(
        ctx, "phase_3d_hook_invoked",
        transition_count=len(transitions),
        mode=ctx.mode.value,
    )
    return results


def finalize_kb_integration(
    ctx: KBIntegrationContext,
    evidence_payload: dict,
) -> None:
    """Run the Phase-3d hook and attach the audit summary to the
    user's evidence payload. Mutates ``evidence_payload`` in place.

    OFF mode (``ctx.active is False``) is a strict no-op so the
    legacy ``evidence_payload`` shape stays byte-identical.
    """
    if not ctx.active:
        return

    invoke_phase_3d_hook(ctx)

    evidence_payload["kb_audit"] = {
        "mode": ctx.mode.value,
        "events": list(ctx.audit_events),
        "cross_checks": [
            {
                "severity": cc.severity,
                "epsilon_violated": cc.epsilon_violated,
                "det_row_count": cc.deterministic_row_count,
                "llm_row_count": cc.llm_row_count,
                "mismatch_details": list(cc.mismatch_details),
            }
            for cc in ctx.cross_checks
        ],
    }
