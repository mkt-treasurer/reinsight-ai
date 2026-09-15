from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.cover_note import CoverNote
from app.schemas.cover_note import CoverNoteOut, CoverNoteListResponse, CoverNoteCreate, CoverNoteUpdate
from app.services.audit import log_change

router = APIRouter(prefix="/api/cover-notes", tags=["cover_notes"])


@router.get("", response_model=CoverNoteListResponse)
async def list_cover_notes(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    line: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(CoverNote)
    count_query = select(func.count(CoverNote.id))

    if line:
        query = query.where(CoverNote.line == line)
        count_query = count_query.where(CoverNote.line == line)
    if search:
        query = query.where(CoverNote.assured.ilike(f"%{search}%"))
        count_query = count_query.where(CoverNote.assured.ilike(f"%{search}%"))

    total = (await db.execute(count_query)).scalar()
    items = (
        await db.execute(
            query.order_by(CoverNote.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return CoverNoteListResponse(
        items=[CoverNoteOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{cover_note_id}", response_model=CoverNoteOut)
async def get_cover_note(cover_note_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CoverNote).where(CoverNote.id == cover_note_id))
    cover_note = result.scalar_one_or_none()
    if not cover_note:
        raise HTTPException(status_code=404, detail="Cover note not found")
    return CoverNoteOut.model_validate(cover_note)


@router.post("", response_model=CoverNoteOut, status_code=201)
async def create_cover_note(data: CoverNoteCreate, db: AsyncSession = Depends(get_db)):
    cover_note = CoverNote(**data.model_dump(exclude_none=True), company_id=1)
    db.add(cover_note)
    await db.commit()
    await db.refresh(cover_note)
    await log_change(db, "cover_notes", cover_note.id, "create", changes=data.model_dump(exclude_none=True), actor_type="human")
    await db.commit()
    return CoverNoteOut.model_validate(cover_note)


@router.put("/{cover_note_id}", response_model=CoverNoteOut)
async def update_cover_note(cover_note_id: int, data: CoverNoteUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CoverNote).where(CoverNote.id == cover_note_id))
    cover_note = result.scalar_one_or_none()
    if not cover_note:
        raise HTTPException(status_code=404, detail="Cover note not found")
    old_values = {}
    for key, val in data.model_dump(exclude_none=True).items():
        old_val = getattr(cover_note, key, None)
        if old_val != val:
            old_values[key] = {"old": str(old_val) if old_val is not None else None, "new": str(val)}
        setattr(cover_note, key, val)
    await db.commit()
    await db.refresh(cover_note)
    if old_values:
        await log_change(db, "cover_notes", cover_note.id, "update", changes=old_values, actor_type="human")
        await db.commit()
    return CoverNoteOut.model_validate(cover_note)


@router.delete("/{cover_note_id}")
async def delete_cover_note(cover_note_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CoverNote).where(CoverNote.id == cover_note_id))
    cover_note = result.scalar_one_or_none()
    if not cover_note:
        raise HTTPException(status_code=404, detail="Cover note not found")
    await log_change(db, "cover_notes", cover_note.id, "delete", actor_type="human")
    await db.commit()
    await db.delete(cover_note)
    await db.commit()
    return {"status": "deleted"}
