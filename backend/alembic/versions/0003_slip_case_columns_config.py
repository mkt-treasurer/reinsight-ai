"""add slip_cases.columns_config

The bordereau slip output is moving from a hardcoded 15-column table
to a column-driven render. Saved cases need a place to persist the
user-edited column layout (visibility, order, label overrides, and
user-added static/custom columns) so that reopening a permalink
shows the same table the operator built. ``NULL`` keeps the legacy
default-columns behavior.

Revision ID: 0003_slip_case_columns_config
Revises: 0002_widen_slip_case_doc_type
Create Date: 2026-05-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "0003_slip_case_columns_config"
down_revision: Union[str, None] = "0002_widen_slip_case_doc_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "slip_cases",
        sa.Column("columns_config", JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("slip_cases", "columns_config")
