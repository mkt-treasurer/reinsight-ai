# Alembic migrations

Schema versioning for the `reinsai` Postgres database. Until Phase 3a
the project relied on `Base.metadata.create_all()` (no version
tracking); Alembic was bootstrapped alongside the first migration
that adds Phase-2 diff-engine columns to `claims`.

## First-time bootstrap (existing DB)

The production DB already contains the pre-Alembic schema. Stamp it
at the migration that introduces the new columns *before* running it,
so Alembic doesn't try to recreate tables that already exist; then
upgrade to apply only the new column additions:

```bash
cd backend
DATABASE_URL=postgresql+asyncpg://... alembic upgrade head
```

Because the very first migration (`0001_add_kb_diff_columns`) only
adds new columns and an index — no `CREATE TABLE` — running it
against a populated DB is safe with no `stamp` step needed.

## Adding a migration

```bash
cd backend
alembic revision --autogenerate -m "describe the change"
# Review the generated file under alembic/versions/ before merging.
alembic upgrade head
```

To roll back the most recent migration:

```bash
alembic downgrade -1
```

## Configuration

`alembic.ini` carries no real DB URL — `env.py` reads
`DATABASE_URL` from the environment (or falls back to
`app.config.settings.database_url`) and rewrites the asyncpg driver to
the sync psycopg2 driver that Alembic uses for DDL.
