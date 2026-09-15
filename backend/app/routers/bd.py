"""영업 발굴(BD) 리드 보드 — 원보험 출재 세그먼트.

EXPERIMENTAL / ISOLATED, rq-slip·weekly·news 와 같은 계약:
- prefix ``/api/tools/bd`` — 기존 claims/contract 라우트와 겹치지 않는다.
- **읽기 전용.** 계약 원장을 조회만 하고 어떤 테이블도 쓰지 않는다.

산출 규칙(세그먼트 분리·출재사 별칭 병합·특약명 제외)은 ``services/bd.py``
상단에 모아뒀고 ontology/aria-ontology-l3.json 의 data_quality_traps 와 대응한다.
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services import bd, bd_news

router = APIRouter(prefix="/api/tools/bd", tags=["bd"])


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """세그먼트 규모로 살아있음을 확인 — 원보험 출재가 0이면 필터가 잘못된 것."""
    segs = await bd.segments(db)
    direct = next((s for s in segs if s["segment"] == "direct"), None)
    return {
        "status": "ok" if direct and direct["contracts"] else "degraded",
        "segments": segs,
        "rules": {
            "requires_sum_insured_for_rate": False,
            "rate_computable": False,
            "note": "요율은 보험가입금액 컬럼이 없어 산출 불가 — 출재수수료율·지분으로 대용",
        },
    }


@router.get("/segments")
async def get_segments(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """원보험 출재 vs 재재보험 — 왜 원보험만 보는지 근거를 화면에 남긴다."""
    return await bd.segments(db)


@router.get("/sectors")
async def get_sectors(
    since_year: int = Query(2023, ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """종목별 커미션율·평균지분·보험료 규모·신규 유입. (요율 아님 — 산출 불가)"""
    return await bd.sectors(db, since_year=since_year)


@router.get("/channels")
async def get_channels(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """출재사 채널 상태. 2017 표기 별칭을 병합한 결과다."""
    return await bd.cedant_channels(db)


#: 구분별 사람이 읽을 설명 — '이탈'이 무엇을 뜻하는지 화면에 남긴다.
STATUS_LABEL = {
    "lapsed": "담보종기 1~4년 경과 · 진짜 이탈",
    "expiring": "담보종기 1년 내 경과 · 갱신 협상 대상",
    "active": "담보종기가 미래 · 진행 중 다년계약 (리드 아님)",
    "stale": "담보종기 4년 초과 · 오래된 이탈",
    "all": "전 구간",
}


@router.get("/lead-status")
async def get_lead_status(
    min_years: int = Query(3, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """구분별 규모 — 담보종기 기준 분류."""
    return await bd.lead_status_counts(db, min_years=min_years)


@router.get("/leads")
async def get_leads(
    kind: Literal["lapsed", "renewal"] = "lapsed",
    status: Literal["lapsed", "expiring", "active", "stale", "all"] = "lapsed",
    min_years: int = Query(3, ge=1, le=10),
    months_ahead: int = Query(12, ge=1, le=36),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """리드 목록.

    ``kind=lapsed`` 는 **담보종기(period_to)** 기준으로 분류한다. 부킹연도(year)로
    판정하면 정산 조정 행 때문에 이미 오래 끝난 건이 '최근 이탈'로 올라온다.
    정렬은 연평균 출재수수료 — 우리가 실제로 번 돈이고, 거래연수 편향도 없앤다.
    """
    if kind == "lapsed":
        rows = await bd.lapsed_leads(db, min_years=min_years, status=status)
        criteria = f"{min_years}년+ 거래 · {STATUS_LABEL[status]} · 연평균 수수료순"
    else:
        rows = await bd.renewal_leads(db, months_ahead=months_ahead)
        criteria = f"향후 {months_ahead}개월 내 만료"
    return {
        "kind": kind,
        "status": status if kind == "lapsed" else None,
        "criteria": criteria,
        "count": len(rows),
        "leads": rows,
    }


@router.get("/news-leads")
async def get_news_leads(
    days: int = Query(14, ge=1, le=60),
    refresh: bool = Query(False, description="캐시 무시하고 다시 수집"),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Phase 2 — 뉴스에서 발굴한 **후보** 리드. 확정하지 않는다(사람 판정).

    argo MCP news_search 를 직접 호출해 모으고, Claude 로 회사·이벤트·금액을
    뽑고, 우리 계약 원장과 대조해 관계(복구/교차판매/신규)를 붙인다.
    일별 캐시 — 같은 날 재요청은 캐시를 준다(``refresh=true`` 로 강제 재수집).
    """
    if not settings.argo_mcp_url:
        raise HTTPException(
            status_code=503,
            detail="ARGO_MCP_URL 미설정 — 뉴스 발굴을 쓸 수 없습니다.",
        )
    return await bd_news.get_or_build(db, days=days, refresh=refresh)


@router.get("/lead")
async def get_lead(
    assured: str = Query(..., min_length=1, max_length=300),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """리드 상세 — 내부 계약·클레임 이력 + 출재사 추천."""
    detail = await bd.lead_detail(db, assured)
    if not detail["contracts"]:
        raise HTTPException(status_code=404, detail=f"계약 이력 없음: {assured}")
    return detail
