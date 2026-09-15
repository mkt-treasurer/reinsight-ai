from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.reconciliation import run_reconciliation
from app.schemas.reconciliation import ReconciliationResult

router = APIRouter(prefix="/api/reconciliation", tags=["reconciliation"])


@router.get("/results", response_model=ReconciliationResult)
async def get_results(db: AsyncSession = Depends(get_db)):
    return await run_reconciliation(db)
