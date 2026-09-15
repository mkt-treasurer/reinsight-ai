from sqlalchemy import Column, Integer, String, DateTime, JSON, Text
from sqlalchemy.sql import func
from app.database import Base


class FileExtraction(Base):
    """Cached extraction results from claim/premium files."""
    __tablename__ = "file_extractions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_path = Column(String(1000), unique=True, index=True)
    file_name = Column(String(500))
    file_type = Column(String(20))  # xlsx, pdf, msg, doc, docx
    claim_type = Column(String(100))  # PLA, SOC, or folder name
    ref_no = Column(String(200), index=True)
    extracted_data = Column(JSON)
    status = Column(String(20), default="pending")  # pending, parsed, failed
    created_at = Column(DateTime, server_default=func.now())
