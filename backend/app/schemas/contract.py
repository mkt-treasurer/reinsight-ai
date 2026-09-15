from datetime import date
from pydantic import BaseModel


class ContractOut(BaseModel):
    id: int
    year: int | None = None
    cont_month: str | None = None
    no: str | None = None
    cover_note_no: str | None = None
    assured: str | None = None
    project_name: str | None = None
    line: str | None = None
    line2: str | None = None
    new_renew: str | None = None
    currency: str | None = None
    gross_prem_100: float | None = None
    gross_prem_inst: float | None = None
    reinsurer: str | None = None
    share: float | None = None
    ri_prem: float | None = None
    ri_commission: float | None = None
    net_ri_prem: float | None = None
    cedant: str | None = None
    period_from: date | None = None
    period_to: date | None = None
    rec_date: date | None = None
    paid_date: date | None = None
    partner: str | None = None
    remarks: str | None = None

    class Config:
        from_attributes = True


class ContractListResponse(BaseModel):
    items: list[ContractOut]
    total: int
    page: int
    page_size: int


class ContractCreate(BaseModel):
    year: int | None = None
    cont_month: str | None = None
    no: str | None = None
    cover_note_no: str | None = None
    assured: str | None = None
    project_name: str | None = None
    line: str | None = None
    line2: str | None = None
    new_renew: str | None = None
    currency: str | None = None
    gross_prem_100: float | None = None
    gross_prem_inst: float | None = None
    reinsurer: str | None = None
    share: float | None = None
    ri_prem: float | None = None
    ri_commission: float | None = None
    net_ri_prem: float | None = None
    cedant: str | None = None
    period_from: date | None = None
    period_to: date | None = None
    rec_date: date | None = None
    paid_date: date | None = None
    partner: str | None = None
    remarks: str | None = None


class ContractUpdate(ContractCreate):
    pass
