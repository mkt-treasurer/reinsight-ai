"""Tools available to the ReAct agent."""

import json
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

TOOL_DEFINITIONS = [
    {
        "name": "sql_query",
        "description": "Execute a SELECT SQL query on the reinsurance database. Use this to look up contracts, claims, cover notes, and computed aggregations. Only SELECT allowed.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The SQL SELECT query to execute"},
                "reasoning": {"type": "string", "description": "Why you're running this query"}
            },
            "required": ["query", "reasoning"]
        }
    },
    {
        "name": "get_table_sample",
        "description": "Get sample rows and column info from a table. Use this first to understand the data structure before writing queries.",
        "parameters": {
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "enum": ["contracts", "claims", "cover_notes", "companies", "audit_logs"], "description": "Table to inspect"}
            },
            "required": ["table_name"]
        }
    },
    {
        "name": "get_distinct_values",
        "description": "Get distinct values for a column. Useful for understanding what values exist (e.g., reinsurer names, line types, statuses).",
        "parameters": {
            "type": "object",
            "properties": {
                "table_name": {"type": "string", "description": "Table name"},
                "column_name": {"type": "string", "description": "Column to get distinct values for"},
                "limit": {"type": "integer", "description": "Max values to return (default 30)"}
            },
            "required": ["table_name", "column_name"]
        }
    },
    {
        "name": "run_reconciliation_check",
        "description": "Run a specific reconciliation check. Returns summary statistics.",
        "parameters": {
            "type": "object",
            "properties": {
                "check_type": {"type": "string", "enum": ["soc", "cover_note", "duplicates"], "description": "Which check to run"}
            },
            "required": ["check_type"]
        }
    },
    {
        "name": "modify_record",
        "description": "Create, update, or delete a record. Use this when the user asks to change data.",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["create", "update", "delete"]},
                "table_name": {"type": "string", "enum": ["contracts", "claims", "cover_notes"]},
                "record_id": {"type": "integer", "description": "Required for update/delete"},
                "data": {"type": "object", "description": "Fields to set (for create/update)"},
                "reasoning": {"type": "string", "description": "Why this modification is needed"}
            },
            "required": ["action", "table_name", "reasoning"]
        }
    }
]


async def execute_tool(tool_name: str, params: dict, db: AsyncSession) -> dict:
    """Execute a tool and return the result."""
    try:
        if tool_name == "sql_query":
            return await _sql_query(params, db)
        elif tool_name == "get_table_sample":
            return await _get_table_sample(params, db)
        elif tool_name == "get_distinct_values":
            return await _get_distinct_values(params, db)
        elif tool_name == "run_reconciliation_check":
            return await _run_reconciliation_check(params, db)
        elif tool_name == "modify_record":
            return await _modify_record(params, db)
        else:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}
    except Exception as e:
        logger.error(f"Tool {tool_name} error: {e}")
        # Postgres aborts the whole transaction on any statement error, so every
        # later statement on this session fails with InFailedSQLTransactionError
        # until someone rolls back. The agent retries failed queries by design
        # (bad SQL is a normal step), so without this one bad query would kill
        # the rest of the conversation.
        try:
            await db.rollback()
        except Exception:  # rollback itself failing must not mask the real error
            logger.exception("rollback after tool error failed")
        return {"success": False, "error": str(e)}


async def _sql_query(params: dict, db: AsyncSession) -> dict:
    query = params["query"].strip()
    # Safety: only SELECT
    if not query.upper().startswith("SELECT"):
        return {"success": False, "error": "Only SELECT queries allowed. Use modify_record for changes."}

    result = await db.execute(text(query))
    rows = result.fetchall()
    columns = list(result.keys())
    data = [dict(zip(columns, row)) for row in rows[:100]]
    return {"success": True, "columns": columns, "data": data, "row_count": len(rows), "truncated": len(rows) > 100}


async def _get_table_sample(params: dict, db: AsyncSession) -> dict:
    table = params["table_name"]
    # Get column info
    col_result = await db.execute(text(
        f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :t ORDER BY ordinal_position"
    ), {"t": table})
    columns = [{"name": r[0], "type": r[1]} for r in col_result.fetchall()]

    # Get sample rows
    sample = await db.execute(text(f"SELECT * FROM {table} LIMIT 5"))
    sample_cols = list(sample.keys())
    sample_data = [dict(zip(sample_cols, row)) for row in sample.fetchall()]

    # Get count
    count_result = await db.execute(text(f"SELECT count(*) FROM {table}"))
    total = count_result.scalar()

    return {"success": True, "table": table, "total_rows": total, "columns": columns, "sample": sample_data}


async def _get_distinct_values(params: dict, db: AsyncSession) -> dict:
    table = params["table_name"]
    column = params["column_name"]
    limit = params.get("limit", 30)

    result = await db.execute(text(
        f"SELECT DISTINCT {column}, count(*) as cnt FROM {table} WHERE {column} IS NOT NULL GROUP BY {column} ORDER BY cnt DESC LIMIT :lim"
    ), {"lim": limit})
    values = [{"value": r[0], "count": r[1]} for r in result.fetchall()]
    return {"success": True, "column": column, "values": values}


async def _run_reconciliation_check(params: dict, db: AsyncSession) -> dict:
    check = params["check_type"]

    if check == "soc":
        result = await db.execute(text("""
            SELECT
                count(*) as total,
                count(*) FILTER (WHERE soc_amount IS NOT NULL AND krw_amount IS NOT NULL AND ROUND(soc_amount::numeric) = ROUND(krw_amount::numeric)) as exact_match,
                count(*) FILTER (WHERE soc_amount IS NOT NULL AND krw_amount IS NOT NULL AND ROUND(soc_amount::numeric) != ROUND(krw_amount::numeric)) as mismatch,
                count(*) FILTER (WHERE soc_amount IS NULL AND krw_amount IS NOT NULL) as soc_missing
            FROM claims
        """))
        row = result.fetchone()
        return {"success": True, "check": "soc", "total": row[0], "exact_match": row[1], "mismatch": row[2], "soc_missing": row[3]}

    elif check == "cover_note":
        result = await db.execute(text("""
            SELECT
                count(DISTINCT cn.cover_note_number) as total,
                count(DISTINCT cn.cover_note_number) FILTER (WHERE c.id IS NOT NULL) as matched,
                count(DISTINCT cn.cover_note_number) FILTER (WHERE c.id IS NULL) as unbooked
            FROM cover_notes cn LEFT JOIN contracts c ON cn.cover_note_number = c.cover_note_no
        """))
        row = result.fetchone()
        return {"success": True, "check": "cover_note", "total": row[0], "matched": row[1], "unbooked": row[2]}

    elif check == "duplicates":
        result = await db.execute(text("""
            SELECT count(DISTINCT ref_no) FILTER (WHERE cnt = 1) as unique_refs,
                   count(DISTINCT ref_no) FILTER (WHERE cnt > 1) as duplicate_refs
            FROM (SELECT ref_no, count(*) as cnt FROM claims WHERE ref_no IS NOT NULL GROUP BY ref_no) t
        """))
        row = result.fetchone()
        return {"success": True, "check": "duplicates", "unique": row[0], "duplicate": row[1]}

    return {"success": False, "error": f"Unknown check: {check}"}


async def _modify_record(params: dict, db: AsyncSession) -> dict:
    action = params["action"]
    table = params["table_name"]
    record_id = params.get("record_id")
    data = params.get("data", {})

    if action == "create":
        cols = ", ".join(data.keys())
        vals = ", ".join(f":{k}" for k in data.keys())
        result = await db.execute(text(f"INSERT INTO {table} ({cols}, company_id) VALUES ({vals}, 1) RETURNING id"), data)
        new_id = result.scalar()
        await db.commit()
        return {"success": True, "action": "created", "id": new_id}

    elif action == "update":
        if not record_id:
            return {"success": False, "error": "record_id required for update"}
        sets = ", ".join(f"{k} = :{k}" for k in data.keys())
        data["rid"] = record_id
        await db.execute(text(f"UPDATE {table} SET {sets} WHERE id = :rid"), data)
        await db.commit()
        return {"success": True, "action": "updated", "id": record_id}

    elif action == "delete":
        if not record_id:
            return {"success": False, "error": "record_id required for delete"}
        await db.execute(text(f"DELETE FROM {table} WHERE id = :rid"), {"rid": record_id})
        await db.commit()
        return {"success": True, "action": "deleted", "id": record_id}

    return {"success": False, "error": f"Unknown action: {action}"}
