"""Test suite for SOC generator - compares against reference ground truth files.

Test cases live under /app/data/보험금/2026년 3월/*/SOC/**/. Each deepest folder
containing SOC_*.pdf files is a test case:
  - SOC_*.pdf files are the EXPECTED answers (one per target reinsurer)
  - All other files (non-SOC_ prefix) are the INPUT for the generator

Expected reinsurer is parsed from the trailing "(Name)" in each answer filename.
"""

import io
import re
import time
import logging
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, UploadFile, Depends
from fastapi import File as FastAPIFile
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.routers.soc_generator import parse_uploaded_file

router = APIRouter(prefix="/api/tools/soc/test-suite", tags=["soc_test_suite"])
logger = logging.getLogger(__name__)

BASE_DIR = Path("/app/data/보험금/2026년 3월")

# In-memory results cache, keyed by case_id. Survives across requests until restart.
_RESULTS: dict[str, dict] = {}
_RESULTS_LOCK = Lock()

# Capture trailing " (Name)" before extension.
RE_REINSURER = re.compile(r"\(([^()]+)\)\s*$")
# Capture ref_no pattern like C2020023652109-1-43 or similar.
RE_REFNO = re.compile(r"(C\d{6,}[-\w]*|\d{6,}[A-Z]\d+[-\w]*)")


_CANONICAL_KEYWORDS = [
    # ordered: more specific first
    ("TOKIO MARINE", ["TOKIO MARINE", "TM SEOUL", "TMNF"]),
    ("MSIG", ["MSIG", "MITSUI SUMITOMO", "MITSUI"]),
    ("AIG", ["AIG"]),
    ("SAMSUNG", ["SAMSUNG", "\u200bSS", " SS ", "SS "]),
    ("HANNOVER", ["HANNOVER"]),
    ("BERKLEY", ["BERKLEY"]),
    ("QBE", ["QBE"]),
    ("NH", ["NH AGRI", "NONGHYUP"]),
    ("KOREAN RE", ["KOREAN RE", "KOREAN REINSURANCE"]),
    ("MUNICH RE", ["MUNICH RE", "MR"]),
    ("GREAT AMERICAN", ["GREAT AMERICAN"]),
    ("GREAT LAKES", ["GREAT LAKES"]),
    ("SWISS RE", ["SWISS RE"]),
    ("SCOR", ["SCOR"]),
    ("MERITZ", ["MERITZ", "MZ"]),
    ("HYUNDAI MARINE", ["HYUNDAI MARINE", "HMFI"]),
    ("DB INSURANCE", ["DB INSURANCE"]),
    ("HANWHA", ["HANWHA"]),
    ("HEUNGKUK", ["HEUNGKUK"]),  # "HK" alone is too ambiguous (matches AWAC HK, Liberty HK)
    ("KB INSURANCE", ["KB INSURANCE"]),
    ("CHUBB", ["CHUBB", "ACE"]),  # ACE was acquired by Chubb in 2016
    ("ALLIANZ", ["ALLIANZ"]),
    ("ZURICH", ["ZURICH"]),
    ("EVEREST", ["EVEREST"]),
    ("GEN RE", ["GEN RE", "GENERAL REINSURANCE"]),
    ("MAPFRE", ["MAPFRE"]),
]


def _norm_reinsurer(name: str) -> str:
    """Canonicalize reinsurer name to a keyword group for comparison.

    Matches on substring after uppercasing, using the alias list above.
    Falls back to the trimmed uppercase name itself.
    """
    s = name.upper().strip()
    s = re.sub(r"[.,&]", " ", s)
    s = re.sub(r"\s+", " ", s)
    padded = f" {s} "
    for canon, aliases in _CANONICAL_KEYWORDS:
        for a in aliases:
            a_clean = a.strip()
            if not a_clean:
                continue
            # Whole-word-ish match for short tokens
            if len(a_clean) <= 3:
                if f" {a_clean} " in padded:
                    return canon
            elif a_clean in s:
                return canon
    # No alias matched — use leading significant token
    tokens = [t for t in s.split() if t not in {"CO", "LTD", "LIMITED", "INC", "COMPANY", "REINSURANCE", "INSURANCE", "RE", "SA", "AG", "PLC", "THE"}]
    return tokens[0] if tokens else s


def _case_id(path: Path) -> str:
    return str(path.relative_to(BASE_DIR)).replace("/", "|")


def _case_from_id(case_id: str) -> Path:
    return BASE_DIR / case_id.replace("|", "/")


def _find_case_dirs() -> list[Path]:
    if not BASE_DIR.exists():
        return []
    dirs = set()
    for pdf in BASE_DIR.rglob("SOC_*.pdf"):
        # Only include if somewhere in path there's an "SOC" folder segment
        if "SOC" in pdf.parts:
            dirs.add(pdf.parent)
    return sorted(dirs)


def _parse_expected(case_dir: Path) -> dict:
    answer_files = sorted([p for p in case_dir.iterdir() if p.is_file() and p.name.startswith("SOC_") and p.suffix.lower() == ".pdf"])
    input_files = sorted([p for p in case_dir.iterdir() if p.is_file() and not p.name.startswith("SOC_")])
    reinsurers = []
    ref_no = None
    for a in answer_files:
        stem = a.stem
        m = RE_REINSURER.search(stem)
        if m:
            reinsurers.append(m.group(1).strip())
        if not ref_no:
            m2 = RE_REFNO.search(stem)
            if m2:
                ref_no = m2.group(1)
    # Dedupe but preserve order
    seen = set()
    unique_reinsurers = []
    for r in reinsurers:
        if r not in seen:
            seen.add(r)
            unique_reinsurers.append(r)
    return {
        "answer_files": [a.name for a in answer_files],
        "input_files": [f.name for f in input_files],
        "expected_reinsurers": unique_reinsurers,
        "expected_ref_no": ref_no,
    }


class Case(BaseModel):
    id: str
    path: str
    name: str
    expected_reinsurers: list[str]
    expected_ref_no: str | None
    input_files: list[str]
    answer_files: list[str]


@router.get("/cases")
async def list_cases() -> list[Case]:
    out: list[Case] = []
    for d in _find_case_dirs():
        info = _parse_expected(d)
        if not info["input_files"]:
            continue
        out.append(Case(
            id=_case_id(d),
            path=str(d.relative_to(BASE_DIR)),
            name=d.name,
            expected_reinsurers=info["expected_reinsurers"],
            expected_ref_no=info["expected_ref_no"],
            input_files=info["input_files"],
            answer_files=info["answer_files"],
        ))
    return out


class RunRequest(BaseModel):
    case_id: str


@router.get("/results")
async def get_results():
    """Return all cached run results + currently-running set, for UI polling."""
    with _RESULTS_LOCK:
        return {"results": dict(_RESULTS), "updated_at": time.time()}


@router.post("/results/clear")
async def clear_results():
    with _RESULTS_LOCK:
        _RESULTS.clear()
    return {"ok": True}


@router.post("/run")
async def run_case(body: RunRequest, db: AsyncSession = Depends(get_db)):
    case_dir = _case_from_id(body.case_id)
    if not case_dir.exists():
        return {"error": f"case not found: {case_dir}"}

    info = _parse_expected(case_dir)
    input_paths = [case_dir / n for n in info["input_files"]]
    if not input_paths:
        return {"error": "no input files"}

    # Mark as running
    with _RESULTS_LOCK:
        _RESULTS[body.case_id] = {"case_id": body.case_id, "status": "running", "started_at": time.time()}

    # Build UploadFile list from disk
    uploads: list[UploadFile] = []
    for p in input_paths:
        data = p.read_bytes()
        uploads.append(UploadFile(filename=p.name, file=io.BytesIO(data)))

    # Call the existing parse endpoint
    t0 = time.time()
    try:
        result = await parse_uploaded_file(files=uploads, text=None, db=db)
    except Exception as e:
        logger.exception("test run failed")
        out = {"case_id": body.case_id, "status": "done", "error": str(e), "expected": info, "elapsed": time.time() - t0}
        with _RESULTS_LOCK:
            _RESULTS[body.case_id] = out
        return out

    actual_reinsurers = [s.get("reinsurer", "") for s in (result.get("socs") or [])]
    actual_ref_no = (result.get("extracted") or {}).get("ref_no")

    exp_norm = {_norm_reinsurer(r) for r in info["expected_reinsurers"]}
    act_norm = {_norm_reinsurer(r) for r in actual_reinsurers}

    matched = exp_norm & act_norm
    missing = exp_norm - act_norm
    extra = act_norm - exp_norm

    refno_ok = False
    if info["expected_ref_no"] and actual_ref_no:
        refno_ok = info["expected_ref_no"].strip().upper() in str(actual_ref_no).strip().upper() or \
                   str(actual_ref_no).strip().upper() in info["expected_ref_no"].strip().upper()

    pass_ = len(missing) == 0 and len(exp_norm) > 0

    out = {
        "case_id": body.case_id,
        "status": "done",
        "pass": pass_,
        "elapsed": time.time() - t0,
        "expected": info,
        "actual": {
            "reinsurers": actual_reinsurers,
            "ref_no": actual_ref_no,
            "extracted": result.get("extracted"),
            "socs": result.get("socs"),
            "policy": result.get("policy"),
            "evidence": result.get("evidence"),
            "thinking": result.get("thinking"),
        },
        "compare": {
            "matched": sorted(matched),
            "missing": sorted(missing),
            "extra": sorted(extra),
            "refno_ok": refno_ok,
        },
    }
    with _RESULTS_LOCK:
        _RESULTS[body.case_id] = out
    return out
