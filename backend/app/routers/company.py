from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.company import Company
from app.schemas.company import CompanyOut

router = APIRouter(prefix="/api/company", tags=["company"])


@router.get("/current", response_model=CompanyOut)
async def get_current_company(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).where(Company.code == "ins-insurance"))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return CompanyOut.model_validate(company)
