"""add testbench_runs and testbench_pairs

Persists slip-testbench executions so we can chart accuracy over time
and drill into individual ground-truth ↔ generated comparisons. See
``app/models/testbench_run.py`` for the model docstring covering why
the body columns are JSONB rather than normalised.

Revision ID: 0004_testbench_runs
Revises: 0003_slip_case_columns_config
Create Date: 2026-05-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision: str = "0004_testbench_runs"
down_revision: Union[str, None] = "0003_slip_case_columns_config"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "testbench_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("label", sa.String(120), nullable=True),
        sa.Column("dataset_path", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'running'"),
        ),
        sa.Column("doc_types", JSONB(), nullable=True),
        sa.Column("summary", JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "testbench_pairs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "run_id",
            UUID(as_uuid=True),
            sa.ForeignKey("testbench_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("doc_type", sa.String(40), nullable=False),
        sa.Column("pair_key", sa.String(120), nullable=False),
        sa.Column("ref_no", sa.String(80), nullable=True),
        sa.Column("reinsurer", sa.String(120), nullable=True),
        sa.Column("input_filename", sa.Text(), nullable=True),
        sa.Column("gt_filename", sa.Text(), nullable=True),
        sa.Column("gen_filename", sa.Text(), nullable=True),
        sa.Column("input_extracted", JSONB(), nullable=True),
        sa.Column("gt_extracted", JSONB(), nullable=True),
        sa.Column("gen_extracted", JSONB(), nullable=True),
        sa.Column("diffs", JSONB(), nullable=True),
        sa.Column("vlm_analysis", JSONB(), nullable=True),
        sa.Column("accuracy", sa.Numeric(5, 4), nullable=True),
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default=sa.text("'ok'"),
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_testbench_pairs_run_id", "testbench_pairs", ["run_id"]
    )
    op.create_index(
        "ix_testbench_runs_created_at",
        "testbench_runs",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_testbench_runs_created_at", table_name="testbench_runs")
    op.drop_index("ix_testbench_pairs_run_id", table_name="testbench_pairs")
    op.drop_table("testbench_pairs")
    op.drop_table("testbench_runs")
