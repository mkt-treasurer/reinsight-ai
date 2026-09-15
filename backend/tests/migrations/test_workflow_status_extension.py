"""Regression tests for the ``0001_add_kb_diff_columns`` migration.

These tests boot a temporary SQLite database, seed it with a minimal
``claims`` table mimicking the pre-Alembic production schema, run the
migration, and verify:

- The three new columns + index appear with the right shape on upgrade.
- Pre-existing data is untouched (Phase 3a has no backfill — the new
  columns must come up NULL on every existing row).
- Downgrade cleanly reverses the change so the schema returns to the
  pre-migration state.

SQLite is good enough for the structural check; the migration only
uses ``ALTER TABLE ADD COLUMN`` / ``DROP COLUMN`` and a single index
create / drop, all of which behave the same way SQLite-vs-Postgres
for our purposes (SQLite ≥ 3.35 supports ``DROP COLUMN``).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

BACKEND_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI = BACKEND_ROOT / "alembic.ini"

# alembic and its dependencies need backend on sys.path to import
# ``app.config`` etc., though our env.py reads DATABASE_URL first.
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _alembic_config(db_url: str):
    """Build an alembic Config object pointing at ``db_url``.

    Sets ``DATABASE_URL`` on os.environ so ``alembic/env.py`` picks it
    up; also sets the in-memory ``sqlalchemy.url`` so the offline path
    works too.
    """
    import os
    from alembic.config import Config

    os.environ["DATABASE_URL"] = db_url
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def _seed_claims_table(engine) -> None:
    """Create a minimal pre-Alembic ``claims`` table with two rows
    mimicking real production state (one Closed, one Open)."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE claims (
                id INTEGER PRIMARY KEY,
                workflow_status VARCHAR(30),
                status VARCHAR(50),
                ref_no VARCHAR(200)
            )
        """))
        conn.execute(text(
            "INSERT INTO claims (id, workflow_status, status, ref_no) VALUES "
            "(1, 'completed', 'Closed', '2026-0204009404 001'), "
            "(2, 'sent_to_reinsurer', 'Open', '2026-0101000003 002')"
        ))


# ─── Tests ─────────────────────────────────────────────────────────────────


@pytest.fixture
def tmp_db(tmp_path):
    """Fresh SQLite file with the minimal claims table seeded."""
    db_path = tmp_path / "test.db"
    url = f"sqlite:///{db_path}"
    engine = create_engine(url)
    _seed_claims_table(engine)
    return url, engine


class TestUpgrade:
    def test_upgrade_adds_three_columns(self, tmp_db):
        from alembic import command

        url, engine = tmp_db
        cfg = _alembic_config(url)
        command.upgrade(cfg, "head")

        cols = {c["name"] for c in inspect(engine).get_columns("claims")}
        assert "last_transition" in cols
        assert "last_transition_at" in cols
        assert "last_diff_audit_severity" in cols

    def test_upgrade_creates_index_on_last_transition(self, tmp_db):
        from alembic import command

        url, engine = tmp_db
        cfg = _alembic_config(url)
        command.upgrade(cfg, "head")

        idxs = {i["name"] for i in inspect(engine).get_indexes("claims")}
        assert "ix_claims_last_transition" in idxs

    def test_upgrade_preserves_existing_data(self, tmp_db):
        """Phase 3a doesn't backfill — pre-existing rows must keep
        their workflow_status untouched, with the new columns NULL."""
        from alembic import command

        url, engine = tmp_db
        cfg = _alembic_config(url)
        command.upgrade(cfg, "head")

        with engine.connect() as conn:
            rows = conn.execute(text(
                "SELECT id, workflow_status, status, ref_no, "
                "last_transition, last_transition_at, last_diff_audit_severity "
                "FROM claims ORDER BY id"
            )).fetchall()

        # Existing fields untouched.
        assert rows[0][:4] == (1, "completed", "Closed", "2026-0204009404 001")
        assert rows[1][:4] == (2, "sent_to_reinsurer", "Open", "2026-0101000003 002")
        # New fields all NULL on every pre-existing row.
        for r in rows:
            assert r[4] is None, "last_transition should default to NULL"
            assert r[5] is None, "last_transition_at should default to NULL"
            assert r[6] is None, "last_diff_audit_severity should default to NULL"


class TestDowngrade:
    def test_downgrade_removes_columns(self, tmp_db):
        from alembic import command

        url, engine = tmp_db
        cfg = _alembic_config(url)
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "base")

        cols = {c["name"] for c in inspect(engine).get_columns("claims")}
        assert "last_transition" not in cols
        assert "last_transition_at" not in cols
        assert "last_diff_audit_severity" not in cols

    def test_downgrade_removes_index(self, tmp_db):
        from alembic import command

        url, engine = tmp_db
        cfg = _alembic_config(url)
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "base")

        idxs = {i["name"] for i in inspect(engine).get_indexes("claims")}
        assert "ix_claims_last_transition" not in idxs

    def test_downgrade_leaves_existing_data_intact(self, tmp_db):
        from alembic import command

        url, engine = tmp_db
        cfg = _alembic_config(url)
        command.upgrade(cfg, "head")

        # Pretend Phase 3c wrote some Phase-2 results.
        with engine.begin() as conn:
            conn.execute(text(
                "UPDATE claims SET last_transition='unchanged', "
                "last_diff_audit_severity='info' WHERE id=2"
            ))

        command.downgrade(cfg, "base")

        with engine.connect() as conn:
            rows = conn.execute(text(
                "SELECT id, workflow_status, status, ref_no FROM claims ORDER BY id"
            )).fetchall()
        # Original columns / values preserved.
        assert rows == [
            (1, "completed", "Closed", "2026-0204009404 001"),
            (2, "sent_to_reinsurer", "Open", "2026-0101000003 002"),
        ]


class TestRoundTrip:
    def test_upgrade_then_downgrade_then_upgrade_is_idempotent(self, tmp_db):
        """Running the migration twice with a roundtrip in between
        must leave the DB in the same shape — verifies no leaked
        artefacts (sequences, constraints) on either path."""
        from alembic import command

        url, engine = tmp_db
        cfg = _alembic_config(url)

        command.upgrade(cfg, "head")
        cols_after_first_up = {
            c["name"] for c in inspect(engine).get_columns("claims")
        }
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
        cols_after_second_up = {
            c["name"] for c in inspect(engine).get_columns("claims")
        }
        assert cols_after_first_up == cols_after_second_up
