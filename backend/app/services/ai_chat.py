import json
import logging
import google.generativeai as genai
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

DB_SCHEMA_CONTEXT = """
You are a SQL assistant for a reinsurance settlement system. The database has these PostgreSQL tables:

TABLE contracts:
- id (serial PK), year (int), cont_month (varchar) -- e.g. "January", "February"
- no (varchar), cover_note_no (varchar), assured (varchar) -- 피보험자
- project_name (varchar), line (varchar) -- 보험종목 e.g. "Property", "Casualty"
- line2 (varchar), new_renew (varchar) -- "N"=new, "R"=renew
- original_cedant (varchar), cedant (varchar) -- 출재사
- period_from (date), period_to (date), currency (varchar)
- gross_prem_100 (numeric) -- 총보험료, gross_prem_inst (numeric)
- reinsurer (varchar) -- 재보험사 e.g. "ACE KR", "NH", "SS", "HM"
- share (numeric) -- 지분율 0~1, ri_prem (numeric) -- 재보험료
- ri_commission (numeric), net_ri_prem (numeric), net_to_uwr (numeric)
- rec_date (date), paid_date (date), co_brokerage (numeric), partner (varchar)

TABLE claims:
- id (serial PK), booking_month (varchar), soc_received (varchar), soc_sent (varchar)
- account_name (varchar) -- 계정명/피보험자, line (varchar) -- 보험종목
- policy_period (date), dol (date) -- 사고일
- reinsurer (varchar), currency (varchar), total_amount (numeric)
- share (numeric), origin_currency (numeric), roe (numeric) -- 환율
- krw_amount (numeric) -- 원화환산보험금, soc_amount (numeric)
- cedant (varchar), status (varchar) -- "Open" or "Closed"
- received_date (date), paid_date (date), account_mgr (varchar)
- ref_no (varchar), remarks (text)

TABLE cover_notes:
- id (serial PK), issuing_date (date), cover_note_number (varchar)
- assured (varchar), reassured (varchar), line (varchar), account (varchar), remarks (text)

RULES:
- Only SELECT queries. Never INSERT, UPDATE, DELETE, DROP.
- Use ILIKE for text search.
- Return SQL in ```sql ... ``` block.
- Explain in Korean after the SQL.
"""


def _configure_gemini():
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel("gemini-3.1-flash-lite")


def _extract_sql(response_text: str) -> str | None:
    if "```sql" in response_text:
        start = response_text.index("```sql") + 6
        end = response_text.index("```", start)
        return response_text[start:end].strip()
    if "```" in response_text:
        start = response_text.index("```") + 3
        end = response_text.index("```", start)
        return response_text[start:end].strip()
    return None


async def chat(message: str, db: AsyncSession) -> dict:
    model = _configure_gemini()
    prompt = f"{DB_SCHEMA_CONTEXT}\n\nUser question: {message}"
    response = model.generate_content(prompt)
    response_text = response.text

    sql_query = _extract_sql(response_text)
    data = None

    if sql_query:
        sql_lower = sql_query.lower().strip()
        if any(kw in sql_lower for kw in ["insert", "update", "delete", "drop", "alter", "truncate"]):
            return {"answer": "안전상의 이유로 데이터 변경 쿼리는 실행할 수 없습니다.", "sql_query": sql_query, "data": None}

        try:
            result = await db.execute(text(sql_query))
            rows = result.fetchall()
            columns = result.keys()
            data = [dict(zip(columns, row)) for row in rows[:100]]

            data_str = json.dumps(data[:20], default=str, ensure_ascii=False)
            answer_prompt = f"""Based on this SQL query result, answer the user's question in Korean.
Be concise and use numbers/tables when appropriate.

User question: {message}
SQL: {sql_query}
Result ({len(data)} rows): {data_str}"""

            answer_response = model.generate_content(answer_prompt)
            answer = answer_response.text
        except Exception as e:
            logger.error(f"SQL execution error: {e}")
            answer = f"쿼리 실행 중 오류가 발생했습니다: {str(e)}\n\n생성된 쿼리:\n```sql\n{sql_query}\n```"
    else:
        answer = response_text

    return {"answer": answer, "sql_query": sql_query, "data": data}
