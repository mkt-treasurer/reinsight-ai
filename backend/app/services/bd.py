"""영업 발굴(Business Development) — 원보험 출재 세그먼트 전용 리드 산출.

EXPERIMENTAL / ISOLATED. 계약 원장을 **읽기만** 한다 (DB 쓰기 없음).

## 왜 세그먼트를 나누는가
`cedant` 자리에 재보험사가 오는 건은 재재보험(retrocession)이고, 원보험 출재와
영업 성격이 전혀 다르다. 실측(2026-07): 원보험 출재 7,982건/출재사 118/
피보험자 1,880/ri_prem 3,268억 vs 재재보험 9,997건/출재사 7/777/1,436억.
최근 3년 신규는 279 vs 66 — **신규 영업은 원보험 출재에서만 나온다.**
그래서 이 모듈은 원보험 출재만 본다.

## 온톨로지 규칙을 여기 한 곳에 모은다
아래 4개 서술부는 ontology/aria-ontology-l3.json 의 data_quality_traps 와
1:1 대응한다. 쿼리마다 손으로 옮겨 쓰면 반드시 어긋나므로 상수로 고정한다.
규칙을 바꾸면 온톨로지도 같이 바꿀 것.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ── 온톨로지 규칙 → SQL 서술부 (trap 이름은 L3 와 동일하게 유지) ──────────

#: ★ Excel 소계·합계 행이 계약 레코드로 적재 (26건, 원시 미정산액의 71.9%)
NOT_SUBTOTAL = "assured !~* '(sub-?total|grand ?total|합계|소계)'"

#: ★ cedant 에 재보험사가 오면 재재보험 — 원보험 출재만 남긴다
NOT_RETRO = (
    "cedant IS NOT NULL "
    "AND cedant NOT IN ('KR', 'Korean Re') "
    "AND cedant !~* '(reinsur|swiss re|munich|hannover|scor|qgic|qatar general)'"
)

#: assured 에 특약명이 섞여 있다 — 기업 단위 리드에서 제외
IS_COMPANY_ASSURED = (
    "assured IS NOT NULL "
    "AND assured !~* '(quota share|\\bq/s\\b|\\bqs\\b|\\bxol\\b|treaty|\\bvqs\\b|surplus)' "
    "AND coalesce(line,'') NOT IN ('QS','XOL','Treaty','VQS','Surplus','PA QS')"
)

#: ★ 2017년 출재사 표기 전환 — 풀네임과 약어가 같은 회사
#: 병합하지 않으면 대형 손보사 3곳이 '2017년 이후 휴면'으로 오진된다.
CEDANT_ALIASES = {
    "Samsung": "SS",
    "Hanwha": "HW",
    "Hyundai": "HM",
    "Lotte": "LT",
    "Dongbu": "DB",
}
CEDANT_CANON = "CASE cedant " + " ".join(
    f"WHEN '{full}' THEN '{abbr}'" for full, abbr in CEDANT_ALIASES.items()
) + " ELSE cedant END"

#: 원보험 출재 세그먼트 기본 필터
BASE = f"{NOT_SUBTOTAL} AND {NOT_RETRO}"


def _rows(result: Any) -> list[dict]:
    cols = list(result.keys())
    return [dict(zip(cols, r)) for r in result.fetchall()]


async def segments(db: AsyncSession) -> list[dict]:
    """원보험 출재 vs 재재보험 규모 대조 — 왜 원보험만 보는지 화면에서 보이게."""
    q = f"""
    SELECT CASE WHEN {NOT_RETRO} THEN 'direct' ELSE 'retro' END AS segment,
           count(*)                                      AS contracts,
           count(DISTINCT cedant)                        AS cedants,
           count(DISTINCT assured)                        AS assureds,
           round(sum(ri_prem)::numeric)                   AS ri_prem,
           count(*) FILTER (WHERE year >= 2024)           AS recent_2y,
           count(*) FILTER (WHERE new_renew = 'N' AND year >= 2023) AS new_3y
    FROM contracts
    WHERE {NOT_SUBTOTAL}
    GROUP BY 1
    """
    return _rows(await db.execute(text(q)))


async def sectors(db: AsyncSession, since_year: int = 2023) -> list[dict]:
    """종목별 판단 재료.

    요율(rate)은 산출할 수 없다 — contracts 에 보험가입금액 컬럼이 없다.
    대용으로 출재수수료율·평균지분·보험료 규모·신규 유입을 낸다.
    커미션율은 조약정산(PA QS 등)에서 환입 때문에 음수가 나오므로 특약성 행을
    제외한 기업 계약 기준으로만 계산한다.
    """
    q = f"""
    SELECT line,
           count(*)                                        AS contracts,
           count(DISTINCT assured)                         AS assureds,
           round(avg(ri_commission / ri_prem)::numeric, 4)  AS commission_rate,
           round(avg(share)::numeric, 4)                    AS avg_share,
           round(sum(ri_prem)::numeric)                     AS ri_prem,
           count(*) FILTER (WHERE new_renew = 'N')         AS new_count,
           max(year)                                       AS last_year
    FROM contracts
    WHERE {BASE}
      AND {IS_COMPANY_ASSURED}
      AND line IS NOT NULL
      AND year >= :since
      AND ri_prem IS NOT NULL AND ri_prem <> 0
      AND ri_commission IS NOT NULL
    GROUP BY 1
    HAVING count(*) >= 10
    ORDER BY sum(ri_prem) DESC NULLS LAST
    """
    return _rows(await db.execute(text(q), {"since": since_year}))


#: 이탈 상태 분류 — **담보종기(period_to) 기준**.
#:
#: `year` 로 판정하면 안 된다. `year` 는 원장 부킹연도라서 정산 조정 행이 나중
#: 연도에 붙는다. 실측: Kumho Tire 는 2024년 부킹 16건(금액 −200만, 정산 조정)
#: 때문에 last_year=2024 로 보였지만 실제 담보는 2023-03-07 에 끝났다 —
#: 3년 넘게 지난 건이 '최근 이탈' 1순위로 올라왔다.
LEAD_STATUS = """
CASE
  WHEN max(period_to) > CURRENT_DATE                       THEN 'active'
  WHEN max(period_to) >= CURRENT_DATE - INTERVAL '1 year'   THEN 'expiring'
  WHEN max(period_to) >= CURRENT_DATE - INTERVAL '4 years'  THEN 'lapsed'
  ELSE                                                            'stale'
END
"""

#: 정렬 축 — 연평균 **출재수수료**. 우리가 실제로 번 돈이다.
#:
#: 보험료 누적액으로 정렬하면 두 가지가 왜곡된다. ① 거래연수가 긴 곳이 무조건
#: 위로 온다(6년 20억 vs 3년 7억은 연평균으로는 3.4 vs 2.4억으로 좁혀진다)
#: ② 보험료는 원수사가 받는 돈이고 우리 수익은 출재수수료다.
ANNUAL_COMMISSION = "sum(ri_commission) / count(DISTINCT year)"


async def lapsed_leads(
    db: AsyncSession,
    min_years: int = 3,
    status: str = "lapsed",
) -> list[dict]:
    """거래 이력이 있는 피보험자를 담보종기 기준으로 분류해 낸다.

    status:
      ``lapsed``   종기 1~4년 경과 — 진짜 이탈. Phase 1 주력.
      ``expiring`` 종기 1년 내 경과 — 이탈이 아니라 갱신 협상 대상.
      ``active``   종기가 미래 — 진행 중 다년 계약. 리드가 아니다.
      ``stale``    종기 4년 초과 — 오래된 이탈, 전환율 낮음.
      ``all``      전부 (구분 컬럼으로 확인)
    """
    where_status = "" if status == "all" else "WHERE status = :status"
    q = f"""
    WITH agg AS (
      SELECT assured,
             count(DISTINCT year)                    AS years_traded,
             min(year)                               AS first_year,
             max(year)                               AS last_booking_year,
             max(period_to)                          AS last_period_to,
             (CURRENT_DATE - max(period_to))         AS days_since_expiry,
             round(sum(ri_prem)::numeric)            AS ri_prem,
             round((sum(ri_prem) / count(DISTINCT year))::numeric)     AS annual_ri_prem,
             round(sum(ri_commission)::numeric)      AS commission,
             round(({ANNUAL_COMMISSION})::numeric)   AS annual_commission,
             count(*)                                AS contracts,
             array_agg(DISTINCT line)                AS lines,
             array_agg(DISTINCT {CEDANT_CANON})      AS cedants,
             {LEAD_STATUS}                           AS status
      FROM contracts
      WHERE {BASE} AND {IS_COMPANY_ASSURED}
        AND period_to IS NOT NULL
        AND period_to <> period_from       -- 종기 미입력 행은 판정 불가
      GROUP BY assured
      HAVING count(DISTINCT year) >= :min_years
    )
    SELECT * FROM agg
    {where_status}
    ORDER BY annual_commission DESC NULLS LAST
    """
    params: dict[str, Any] = {"min_years": min_years}
    if status != "all":
        params["status"] = status
    return _rows(await db.execute(text(q), params))


async def lead_status_counts(db: AsyncSession, min_years: int = 3) -> list[dict]:
    """구분별 규모 — 화면에서 '이탈'이 무엇을 뜻하는지 보이게 한다."""
    q = f"""
    WITH agg AS (
      SELECT assured, sum(ri_prem) AS prem, sum(ri_commission) AS comm,
             count(DISTINCT year) AS yrs, {LEAD_STATUS} AS status
      FROM contracts
      WHERE {BASE} AND {IS_COMPANY_ASSURED}
        AND period_to IS NOT NULL AND period_to <> period_from
      GROUP BY assured
      HAVING count(DISTINCT year) >= :min_years
    )
    SELECT status, count(*) AS assureds,
           round(sum(prem)::numeric) AS ri_prem,
           round(sum(comm / yrs)::numeric) AS annual_commission
    FROM agg GROUP BY 1
    """
    return _rows(await db.execute(text(q), {"min_years": min_years}))


async def renewal_leads(db: AsyncSession, months_ahead: int = 12) -> list[dict]:
    """갱신 예정 — 만료가 다가오는 계약. 가장 확실하지만 파이프라인이 얕다."""
    q = f"""
    SELECT assured,
           cover_note_no,
           {CEDANT_CANON}                        AS cedant,
           line,
           period_to,
           (period_to::date - CURRENT_DATE)      AS days_to_expiry,
           round(ri_prem::numeric, 2)            AS ri_prem,
           round(share::numeric, 4)              AS share,
           new_renew,
           renewable,
           array_agg(DISTINCT reinsurer)         AS reinsurers
    FROM contracts
    WHERE {BASE} AND {IS_COMPANY_ASSURED}
      AND period_to IS NOT NULL
      AND period_to <> period_from            -- 종기 미입력 행 제외
      AND period_to >= CURRENT_DATE
      -- interval 은 리터럴 연결이 아니라 곱셈으로 만든다. (:months || ' months') 는
      -- asyncpg 가 $1 을 text 로 기대해서 int 를 넘기면 DataError 로 죽는다.
      AND period_to < CURRENT_DATE + (:months * INTERVAL '1 month')
    GROUP BY assured, cover_note_no, cedant, line, period_to, ri_prem, share,
             new_renew, renewable
    ORDER BY period_to
    """
    return _rows(await db.execute(text(q), {"months": months_ahead}))


async def cedant_channels(db: AsyncSession) -> list[dict]:
    """출재사 채널 상태. 별칭 병합 후 판정 — 병합 없이는 대형사가 휴면으로 오진된다."""
    q = f"""
    SELECT {CEDANT_CANON}                              AS cedant,
           count(*)                                    AS contracts,
           round(sum(ri_prem)::numeric)                AS ri_prem,
           max(year)                                   AS last_year,
           count(*) FILTER (WHERE year >= 2024)        AS recent_2y,
           count(*) FILTER (WHERE new_renew = 'N' AND year >= 2023) AS new_3y,
           count(DISTINCT assured)                     AS assureds
    FROM contracts
    WHERE {BASE}
    GROUP BY 1
    ORDER BY count(*) DESC
    """
    return _rows(await db.execute(text(q)))


async def recommend_cedants(db: AsyncSession, assured: str) -> dict:
    """이 리드를 어느 출재사에게 줄지 — 우리 거래 이력에서 산출.

    재보험 브로커의 고객은 피보험자가 아니라 출재사다. 그래서 리드는 '누구에게
    파는가'가 아니라 '어느 출재사에게 넘길 딜인가'로 끝나야 한다.

    두 근거를 함께 낸다:
      prior  — 이 피보험자와 실제로 거래한 이력이 있는 출재사 (관계 존재)
      active — 그 종목에서 최근 3년 신규를 실제로 만든 출재사 (인수 의지)
    """
    hist = _rows(
        await db.execute(
            text(f"""
            SELECT {CEDANT_CANON} AS cedant, count(*) AS contracts,
                   max(year) AS last_year, round(sum(ri_prem)::numeric) AS ri_prem,
                   array_agg(DISTINCT line) AS lines
            FROM contracts
            WHERE {BASE} AND assured = :a
            GROUP BY 1 ORDER BY count(*) DESC
            """),
            {"a": assured},
        )
    )

    lines = _rows(
        await db.execute(
            text(f"""
            SELECT DISTINCT line FROM contracts
            WHERE {BASE} AND assured = :a AND line IS NOT NULL
            """),
            {"a": assured},
        )
    )
    line_list = [r["line"] for r in lines]

    active: list[dict] = []
    if line_list:
        active = _rows(
            await db.execute(
                text(f"""
                SELECT {CEDANT_CANON} AS cedant,
                       count(*) FILTER (WHERE new_renew = 'N') AS new_3y,
                       count(*)                                AS contracts_3y,
                       round(sum(ri_prem)::numeric)            AS ri_prem,
                       array_agg(DISTINCT line)                AS lines
                FROM contracts
                WHERE {BASE} AND {IS_COMPANY_ASSURED}
                  AND year >= 2023
                  AND line = ANY(:lines)
                GROUP BY 1
                HAVING count(*) >= 3
                ORDER BY count(*) FILTER (WHERE new_renew = 'N') DESC, count(*) DESC
                LIMIT 6
                """),
                {"lines": line_list},
            )
        )

    return {"assured": assured, "lines": line_list, "prior": hist, "active": active}


async def lead_detail(db: AsyncSession, assured: str) -> dict:
    """리드 상세 — 내부 이력(계약·클레임) + 출재사 추천."""
    contracts = _rows(
        await db.execute(
            text(f"""
            SELECT year, cover_note_no, {CEDANT_CANON} AS cedant, line, reinsurer,
                   period_from, period_to, round(ri_prem::numeric, 2) AS ri_prem,
                   round(share::numeric, 4) AS share, workflow_status
            FROM contracts
            WHERE {BASE} AND assured = :a
            ORDER BY year DESC, period_to DESC NULLS LAST
            LIMIT 60
            """),
            {"a": assured},
        )
    )
    # 클레임은 account_name 축이라 계약의 assured 와 표기가 다를 수 있다 — 부분일치.
    claims = _rows(
        await db.execute(
            text("""
            SELECT ref_no, account_name, line, dol, reinsurer, currency,
                   total_amount, krw_amount, soc_amount, status, workflow_status
            FROM claims
            WHERE account_name ILIKE :like
              AND lower(coalesce(status,'')) <> 'deleted'
            ORDER BY dol DESC NULLS LAST
            LIMIT 40
            """),
            {"like": f"%{assured}%"},
        )
    )
    return {
        "assured": assured,
        "contracts": contracts,
        "claims": claims,
        "recommendation": await recommend_cedants(db, assured),
    }
