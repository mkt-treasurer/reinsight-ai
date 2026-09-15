"""widen slip_cases.doc_type

The slip generator now supports four doc types:
"SOC" | "PLA" | "Bordereau SOC" | "Bordereau PLA". The two Bordereau
variants are 13 characters and overflowed the prior String(10) cap, so
this migration widens the column to String(20).

Revision ID: 0002_widen_slip_case_doc_type
Revises: 0001_add_kb_diff_columns
Create Date: 2026-05-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0002_widen_slip_case_doc_type"
down_revision: Union[str, None] = "0001_add_kb_diff_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "slip_cases",
        "doc_type",
        existing_type=sa.String(length=10),
        type_=sa.String(length=20),
        existing_nullable=False,
        existing_server_default=None,
    )


def downgrade() -> None:
    op.alter_column(
        "slip_cases",
        "doc_type",
        existing_type=sa.String(length=20),
        type_=sa.String(length=10),
        existing_nullable=False,
        existing_server_default=None,
    )
