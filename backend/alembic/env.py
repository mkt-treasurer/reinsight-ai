"""Alembic environment configuration.

Reads the database URL from ``DATABASE_URL`` (or ``settings.database_url``)
and rewrites the asyncpg driver to the synchronous psycopg2 driver
that Alembic itself uses. The async driver in ``database.py`` is
correct for the application; Alembic only needs a sync handle for
DDL.

Models are imported eagerly so ``Base.metadata`` is populated for
``--autogenerate`` to inspect.
"""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool


# Backend root on sys.path so ``from app...`` imports work when alembic
# runs from the repo root or the backend dir.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Pull the database URL from env (so we don't ship a real URL in
# alembic.ini). Fall back to ``settings.database_url`` if available.
def _resolve_database_url() -> str:
    raw = os.environ.get("DATABASE_URL")
    if not raw:
        try:
            from app.config import settings
            raw = settings.database_url
        except Exception as e:
            raise RuntimeError(
                "DATABASE_URL not set and app.config.settings unavailable"
            ) from e
    # asyncpg driver → sync psycopg2 driver. Alembic needs sync for DDL.
    return raw.replace("+asyncpg", "+psycopg2", 1)


config.set_main_option("sqlalchemy.url", _resolve_database_url())


# Import all models so Base.metadata is populated. autogenerate diffs
# the in-memory metadata against the live DB to suggest migrations.
#
# The model imports go through ``app.database`` which eagerly builds
# an async engine bound to ``settings.database_url``. For non-async
# DBs (SQLite-backed tests) that fails at import time even though we
# never actually use that engine here. autogenerate is the only path
# that needs the metadata; ``upgrade`` / ``downgrade`` don't, so make
# the load defensive and let the rest of env.py keep working when the
# import chain can't be brought up.
def _load_metadata():
    try:
        from app.database import Base  # noqa: F401
        from app.models import (  # noqa: F401
            audit_log,
            claim,
            claim_workflow,
            company,
            contract,
            contract_claim_link,
            contract_workflow,
            cover_note,
            file_extraction,
            policy,
            slip_case,
        )
        return Base.metadata
    except Exception:
        # autogenerate requires metadata; raw upgrade/downgrade do not.
        # The CLI will error usefully if --autogenerate is invoked
        # without a usable model import path.
        return None


target_metadata = _load_metadata()


def run_migrations_offline() -> None:
    """Run migrations without binding to a real connection — useful
    for generating SQL scripts to apply manually."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Render type changes as ``alter_column`` so type widening
            # (e.g. String(30) → String(50)) shows up in autogenerate.
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
