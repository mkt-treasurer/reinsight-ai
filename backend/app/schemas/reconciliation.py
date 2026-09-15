from pydantic import BaseModel


# --- SOC Reconciliation ---
class SocMismatch(BaseModel):
    claim_id: int
    account_name: str | None = None
    reinsurer: str | None = None
    ref_no: str | None = None
    krw_amount: float | None = None
    soc_amount: float | None = None
    difference: float | None = None


class SocSummary(BaseModel):
    total: int
    exact_match: int
    mismatch: int
    soc_missing: int
    mismatch_total_diff: float


# --- Cover Note Integrity ---
class UnbookedCoverNote(BaseModel):
    cover_note_id: int
    cover_note_number: str | None = None
    assured: str | None = None
    line: str | None = None
    issuing_date: str | None = None


class CoverNoteSummary(BaseModel):
    total_cover_notes: int
    matched: int
    unbooked: int


# --- Duplicate Detection ---
class DuplicateGroup(BaseModel):
    ref_no: str
    count: int
    claims: list[dict]


class DuplicateSummary(BaseModel):
    total_refs: int
    unique_refs: int
    duplicate_refs: int
    heavy_duplicates: int


# --- Combined ---
class ReconciliationResult(BaseModel):
    soc_summary: SocSummary
    soc_mismatches: list[SocMismatch]
    cover_note_summary: CoverNoteSummary
    unbooked_cover_notes: list[UnbookedCoverNote]
    duplicate_summary: DuplicateSummary
    duplicate_groups: list[DuplicateGroup]
