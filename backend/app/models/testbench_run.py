"""Slip testbench — persisted run + per-pair result.

A *run* groups one execution of the testbench pipeline over the
``testbench-dataset`` directory tree. Each *pair* is a single
(input, ground_truth, generated) triple at one ``doc_type``; the
ground-truth ↔ generated comparison is the primary signal, the input
PDF is stored as reference only.

Schema is JSONB-heavy on purpose: trend charts read
``runs.summary`` (a small object) and pair details are drilled into on
demand. Normalising every field into its own column would buy nothing
for the access patterns this UI has.
"""
from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class TestbenchRun(Base):
    __tablename__ = "testbench_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label = Column(String(120), nullable=True)
    dataset_path = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="running")
    # 'running' | 'done' | 'error'
    doc_types = Column(JSONB, nullable=True)
    # e.g. ['soc', 'soc_bordereau'] — which dataset subfolders were scanned
    summary = Column(JSONB, nullable=True)
    # { pairs: int, weighted_accuracy: float,
    #   severity_counts: { match, minor, major, missing },
    #   by_doc_type: { soc: { pairs, accuracy }, ... } }
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at = Column(DateTime(timezone=True), nullable=True)

    pairs = relationship(
        "TestbenchPair",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="TestbenchPair.created_at",
    )


class TestbenchPair(Base):
    __tablename__ = "testbench_pairs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("testbench_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    doc_type = Column(String(40), nullable=False)
    # 'soc' | 'pla' | 'soc_bordereau' | 'pla_bordereau'
    pair_key = Column(String(120), nullable=False)
    # Stable identifier inside a run — typically the ref-no extracted
    # from the filenames; falls back to the GT base name when no ref
    # could be parsed.
    ref_no = Column(String(80), nullable=True)
    reinsurer = Column(String(120), nullable=True)

    input_filename = Column(Text, nullable=True)
    gt_filename = Column(Text, nullable=True)
    gen_filename = Column(Text, nullable=True)

    input_extracted = Column(JSONB, nullable=True)
    gt_extracted = Column(JSONB, nullable=True)
    gen_extracted = Column(JSONB, nullable=True)

    diffs = Column(JSONB, nullable=True)
    # FieldDiff[]; same shape the frontend testbench page already renders.
    vlm_analysis = Column(JSONB, nullable=True)
    # { field_key: { cause, winner, evidence, suggested_fix, confidence } }

    accuracy = Column(Numeric(5, 4), nullable=True)
    status = Column(String(30), nullable=False, default="ok")
    # 'ok' | 'gt_missing' | 'gen_missing' | 'extract_error'
    error_message = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    run = relationship("TestbenchRun", back_populates="pairs")
