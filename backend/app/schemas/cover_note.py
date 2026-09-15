from datetime import date
from pydantic import BaseModel


class CoverNoteOut(BaseModel):
    id: int
    issuing_date: date | None = None
    cover_note_number: str | None = None
    assured: str | None = None
    reassured: str | None = None
    line: str | None = None
    account: str | None = None
    remarks: str | None = None

    class Config:
        from_attributes = True


class CoverNoteListResponse(BaseModel):
    items: list[CoverNoteOut]
    total: int
    page: int
    page_size: int


class CoverNoteCreate(BaseModel):
    issuing_date: date | None = None
    cover_note_number: str | None = None
    assured: str | None = None
    reassured: str | None = None
    line: str | None = None
    account: str | None = None
    remarks: str | None = None


class CoverNoteUpdate(CoverNoteCreate):
    pass
