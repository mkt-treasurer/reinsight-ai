from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey
from app.database import Base


class CoverNote(Base):
    __tablename__ = "cover_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True, nullable=False, default=1)
    issuing_date = Column(Date)
    cover_note_number = Column(String(50), index=True)
    assured = Column(String(200))
    reassured = Column(String(50))
    line = Column(String(50))
    account = Column(String(50))
    remarks = Column(Text)
