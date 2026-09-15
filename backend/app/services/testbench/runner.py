"""Drive a single testbench run end-to-end.

Sequencing per run:

1. ``dataset_scanner.scan_dataset`` walks the local folders and emits
   ``ScannedPair``s.
2. For each pair, every present source PDF is sent through
   ``extractor.extract_fields_from_path``. Extractions run in parallel
   inside one pair (asyncio.gather over input/gt/gen); pairs run
   *sequentially* to keep VLM upload pressure predictable.
3. When both GT and Generated extractions succeed, ``diff.build_diff``
   produces ``FieldDiff[]`` and ``vlm.analyse_pair`` annotates the
   non-match rows.
4. Per-pair results are written to ``testbench_pairs``; the run
   summary (severity totals, weighted accuracy, by-doc-type breakdown)
   is rolled up on ``testbench_runs``.

Failures inside a single pair are caught and persisted as
``status='extract_error'`` so the run can keep going — a flaky Gemini
upload on one PDF shouldn't poison the whole dataset.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.testbench_run import TestbenchPair, TestbenchRun
from app.services.testbench.dataset_scanner import (
    DOC_TYPES,
    ScannedPair,
    scan_dataset,
)
from app.services.testbench.diff import (
    SEVERITY_WEIGHTS,
    build_diff,
    severity_counts,
    weighted_accuracy,
)
from app.services.testbench.extractor import extract_fields_from_path
from app.services.testbench.vlm import analyse_pair, summarise_causes

logger = logging.getLogger(__name__)


@dataclass
class PairResult:
    pair: ScannedPair
    input_extracted: dict[str, Any] | None
    gt_extracted: dict[str, Any] | None
    gen_extracted: dict[str, Any] | None
    diffs: list[dict[str, Any]]
    vlm: dict[str, dict[str, Any]]
    accuracy: float | None
    severity_counts: dict[str, int]
    status: str
    error_message: str | None


async def _safe_extract(path: Path | None) -> tuple[dict[str, Any] | None, str | None]:
    if path is None:
        return None, None
    try:
        return await extract_fields_from_path(path), None
    except Exception as exc:
        logger.exception("Extraction failed for %s", path)
        return None, f"{type(exc).__name__}: {exc}"


async def _process_pair(p: ScannedPair) -> PairResult:
    input_path = p.input.path if p.input else None
    gt_path = p.gt.path if p.gt else None
    gen_path = p.gen.path if p.gen else None

    (input_ex, input_err), (gt_ex, gt_err), (gen_ex, gen_err) = await asyncio.gather(
        _safe_extract(input_path),
        _safe_extract(gt_path),
        _safe_extract(gen_path),
    )

    errors = [e for e in (input_err, gt_err, gen_err) if e]
    status = "ok"
    if not gt_ex and p.gt is None:
        status = "gt_missing"
    elif not gen_ex and p.gen is None:
        status = "gen_missing"
    if errors and status == "ok":
        status = "extract_error"

    diffs: list[dict[str, Any]] = []
    vlm: dict[str, dict[str, Any]] = {}
    acc: float | None = None
    sev_counts: dict[str, int] = {"match": 0, "minor": 0, "major": 0, "missing": 0}

    if gt_ex and gen_ex:
        diff_objs = build_diff(gt_ex, gen_ex)
        diffs = [d.to_dict() for d in diff_objs]
        sev_counts = severity_counts(diff_objs)
        acc = weighted_accuracy(diff_objs)
        try:
            vlm = await analyse_pair(gt_path, gen_path, diff_objs)
        except Exception:
            logger.exception("VLM pair-analysis failed for %s", p.pair_key)
            vlm = {}

    return PairResult(
        pair=p,
        input_extracted=input_ex,
        gt_extracted=gt_ex,
        gen_extracted=gen_ex,
        diffs=diffs,
        vlm=vlm,
        accuracy=acc,
        severity_counts=sev_counts,
        status=status,
        error_message="; ".join(errors)[:1000] if errors else None,
    )


def _build_summary(results: list[PairResult]) -> dict[str, Any]:
    severity = {"match": 0, "minor": 0, "major": 0, "missing": 0}
    by_doc: dict[str, dict[str, Any]] = {}
    by_cause: dict[str, int] = {}
    acc_pairs: list[float] = []

    for r in results:
        for k, v in r.severity_counts.items():
            severity[k] = severity.get(k, 0) + v
        slot = by_doc.setdefault(
            r.pair.doc_type,
            {"pairs": 0, "compared": 0, "weighted_accuracy_sum": 0.0,
             "severity": {"match": 0, "minor": 0, "major": 0, "missing": 0}},
        )
        slot["pairs"] += 1
        for k, v in r.severity_counts.items():
            slot["severity"][k] = slot["severity"].get(k, 0) + v
        if r.accuracy is not None:
            slot["compared"] += 1
            slot["weighted_accuracy_sum"] += float(r.accuracy)
            acc_pairs.append(float(r.accuracy))
        for cause, n in summarise_causes(r.vlm).items():
            by_cause[cause] = by_cause.get(cause, 0) + n

    for slot in by_doc.values():
        compared = slot.pop("compared")
        total = slot.pop("weighted_accuracy_sum")
        slot["weighted_accuracy"] = round(total / compared, 4) if compared else None

    weighted = (
        round(sum(acc_pairs) / len(acc_pairs), 4) if acc_pairs else None
    )
    return {
        "pairs": len(results),
        "compared_pairs": len(acc_pairs),
        "weighted_accuracy": weighted,
        "severity_counts": severity,
        "by_doc_type": by_doc,
        "by_cause": by_cause,
    }


async def execute_run(
    db: AsyncSession,
    run: TestbenchRun,
    dataset_path: Path,
    doc_types: list[str] | None = None,
) -> TestbenchRun:
    """Scan ``dataset_path``, process every pair, persist results,
    and update the ``run`` record in place. The caller commits."""
    if doc_types:
        allowed = [d for d in doc_types if d in DOC_TYPES]
    else:
        allowed = list(DOC_TYPES)
    run.doc_types = allowed

    pairs = scan_dataset(dataset_path, allowed)
    results: list[PairResult] = []
    for p in pairs:
        res = await _process_pair(p)
        results.append(res)
        db.add(
            TestbenchPair(
                run_id=run.id,
                doc_type=p.doc_type,
                pair_key=p.pair_key,
                ref_no=p.ref_no,
                reinsurer=p.reinsurer,
                input_filename=p.input.path.name if p.input else None,
                gt_filename=p.gt.path.name if p.gt else None,
                gen_filename=p.gen.path.name if p.gen else None,
                input_extracted=res.input_extracted,
                gt_extracted=res.gt_extracted,
                gen_extracted=res.gen_extracted,
                diffs=res.diffs,
                vlm_analysis=res.vlm,
                accuracy=res.accuracy,
                status=res.status,
                error_message=res.error_message,
            )
        )
        # Flush incrementally so a crash mid-run still leaves the
        # partial result visible in the runs detail view.
        await db.flush()

    run.summary = _build_summary(results)
    run.status = "done"
    run.finished_at = datetime.now(timezone.utc)
    return run


# Severity weights re-exported for the API serialiser.
__all__ = ["execute_run", "SEVERITY_WEIGHTS"]
