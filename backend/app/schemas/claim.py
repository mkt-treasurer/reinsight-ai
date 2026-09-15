from datetime import date
from pydantic import BaseModel


class ClaimOut(BaseModel):
    id: int
    booking_month: str | None = None
    soc_received: str | None = None
    soc_sent: str | None = None
    account_name: str | None = None
    line: str | None = None
    dol: date | None = None
    reinsurer: str | None = None
    currency: str | None = None
    total_amount: float | None = None
    share: float | None = None
    krw_amount: float | None = None
    soc_amount: float | None = None
    cedant: str | None = None
    status: str | None = None
    received_date: date | None = None
    paid_date: date | None = None
    account_mgr: str | None = None
    ref_no: str | None = None
    remarks: str | None = None
    workflow_status: str | None = None
    case_id: int | None = None

    class Config:
        from_attributes = True


class ClaimListResponse(BaseModel):
    items: list[ClaimOut]
    total: int
    page: int
    page_size: int


class ClaimCreate(BaseModel):
    booking_month: str | None = None
    soc_received: str | None = None
    soc_sent: str | None = None
    account_name: str | None = None
    line: str | None = None
    dol: date | None = None
    reinsurer: str | None = None
    currency: str | None = None
    total_amount: float | None = None
    share: float | None = None
    krw_amount: float | None = None
    soc_amount: float | None = None
    cedant: str | None = None
    status: str | None = None
    received_date: date | None = None
    paid_date: date | None = None
    account_mgr: str | None = None
    ref_no: str | None = None
    remarks: str | None = None


class ClaimUpdate(ClaimCreate):
    pass
