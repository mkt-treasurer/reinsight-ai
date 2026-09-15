from datetime import datetime
from pydantic import BaseModel


class CompanyOut(BaseModel):
    id: int
    name: str
    code: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True
