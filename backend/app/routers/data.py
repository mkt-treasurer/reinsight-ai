from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.importer import import_all

router = APIRouter(prefix="/api/data", tags=["data"])


@router.post("/import")
async def run_import(db: AsyncSession = Depends(get_db)):
    result = await import_all(db)
    return {"status": "completed", "counts": result}
