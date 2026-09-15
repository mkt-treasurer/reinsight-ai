"""add kb diff columns to claims

Adds the three columns that Phase 2's monthly-diff engine writes
through the Phase 3a workflow_mapping layer:

- ``last_transition``         (String(30))  — Phase-2 TransitionType value
- ``last_transition_at``      (DateTime)    — when this transition was detected
- ``last_diff_audit_severity`` (String(20)) — info / warning / anomaly

Plus an index on ``last_transition`` so audit dashboards can filter
the table without a sequential scan.

Phase 3a does not change the existing ``workflow_status`` column
itself; the new ``dismissed`` value is simply a string the column
will start carrying when DISMISSED transitions land.

Revision ID: 0001_add_kb_diff_columns
Revises:
Create Date: 2026-05-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0001_add_kb_diff_columns"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "claims",
        sa.Column("last_transition", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "claims",
        sa.Column("last_transition_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "claims",
        sa.Column("last_diff_audit_severity", sa.String(length=20), nullable=True),
    )
    op.create_index(
        "ix_claims_last_transition",
        "claims",
        ["last_transition"],
    )


def downgrade() -> None:
    op.drop_index("ix_claims_last_transition", table_name="claims")
    op.drop_column("claims", "last_diff_audit_severity")
    op.drop_column("claims", "last_transition_at")
    op.drop_column("claims", "last_transition")
