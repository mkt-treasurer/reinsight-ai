"""KB monthly-diff engine (Phase 2).

Builds on Phase 1's :mod:`parsers.kb_bordereau` to detect claim
lifecycle transitions across monthly snapshots.

Public surface:
- :class:`KBMonthlySnapshot` — atomic four-file container per month
- :class:`SOCHistory` — accumulator that answers "has this claim
  ever been settled?" across multiple SOC files
- :class:`ClaimTransition` / :class:`TransitionType` — output shape
- :func:`diff_monthly` — the core diff entry point

Phase 2 is deterministic and DB-free; Phase 3 will integrate the
result into the live :mod:`routers.soc_stream` pipeline and the
``slip_cases`` table.
"""

from .cross_check import (
    SEVERITY_FAIL,
    SEVERITY_INFO,
    SEVERITY_OK,
    SEVERITY_WARNING,
    CrossCheckResult,
    cross_check,
)
from .diff_hooks import apply_workflow_transitions
from .errors import KBSnapshotError
from .llm_context import to_llm_context
from .monthly_diff import (
    ClaimTransition,
    TransitionType,
    diff_monthly,
)
from .monthly_snapshot import KBMonthlySnapshot
from .slip_cases_sync import (
    DAEWOO_RECIPIENT,
    DEFAULT_INS_RECIPIENT,
    ExtractedKey,
    SlipCasesAdapter,
    SlipCasesSyncReport,
    extract_keys_from_slip_case,
)
from .soc_history import (
    QUALITY_EXACT,
    QUALITY_INFERRED,
    QUALITY_ORDER,
    QUALITY_PARTIAL,
    SOCHistory,
)
from .workflow_mapping import (
    AuditSeverity,
    SyncResult,
    WorkflowImpact,
    WorkflowSyncer,
    map_transition_to_workflow,
)

__all__ = [
    "AuditSeverity",
    "ClaimTransition",
    "CrossCheckResult",
    "DAEWOO_RECIPIENT",
    "DEFAULT_INS_RECIPIENT",
    "ExtractedKey",
    "KBMonthlySnapshot",
    "KBSnapshotError",
    "QUALITY_EXACT",
    "QUALITY_INFERRED",
    "QUALITY_ORDER",
    "QUALITY_PARTIAL",
    "SEVERITY_FAIL",
    "SEVERITY_INFO",
    "SEVERITY_OK",
    "SEVERITY_WARNING",
    "SOCHistory",
    "SlipCasesAdapter",
    "SlipCasesSyncReport",
    "SyncResult",
    "TransitionType",
    "WorkflowImpact",
    "WorkflowSyncer",
    "apply_workflow_transitions",
    "cross_check",
    "diff_monthly",
    "extract_keys_from_slip_case",
    "map_transition_to_workflow",
    "to_llm_context",
]
