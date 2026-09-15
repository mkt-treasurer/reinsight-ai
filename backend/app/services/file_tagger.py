"""Scan ALL claim files, register in DB, tag with AI."""

import json
import logging
import re
from pathlib import Path

import openpyxl
import google.generativeai as genai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.file_extraction import FileExtraction

logger = logging.getLogger(__name__)
CLAIM_DIR = Path("/app/data/보험금/2026년 3월")
VALID_EXT = {".pdf", ".xlsx", ".xls", ".msg", ".doc", ".docx"}


async def register_all_files(db: AsyncSession) -> dict:
    """Scan every file in claims folder and register in file_extractions table."""
    if not CLAIM_DIR.exists():
        return {"error": "Claim dir not found"}

    existing = set((await db.execute(select(FileExtraction.file_path))).scalars().all())

    new_count = 0
    for file_path in CLAIM_DIR.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in VALID_EXT:
            continue

        rel_path = str(file_path.relative_to(CLAIM_DIR.parent.parent))
        if rel_path in existing:
            continue

        # Extract what we can from path structure
        parts = file_path.relative_to(CLAIM_DIR).parts
        date_folder = parts[0] if len(parts) > 0 else None  # 3.10
        claim_type = parts[1] if len(parts) > 1 else None    # PLA or SOC
        company = parts[2] if len(parts) > 2 else None       # company name

        # Try to find ref_no in path
        ref_match = re.search(r'(C?\d{7,}[-\d]*)', str(file_path))
        ref_no = ref_match.group(1) if ref_match else None

        fe = FileExtraction(
            file_path=rel_path,
            file_name=file_path.name,
            file_type=file_path.suffix.lower()[1:],
            claim_type=claim_type,
            ref_no=ref_no,
            extracted_data={"_registered": True, "date": date_folder, "company": company},
            status="pending",
        )
        db.add(fe)
        new_count += 1

    await db.commit()
    total = (await db.execute(select(FileExtraction))).scalars().all()
    return {"new_registered": new_count, "total": len(total)}


async def tag_files_batch(db: AsyncSession, batch_size: int = 10) -> dict:
    """Tag a batch of pending files. xlsx sync, PDF/MSG parallel via Gemini."""
    import asyncio
    import concurrent.futures

    pending = (await db.execute(
        select(FileExtraction).where(FileExtraction.status == "pending").limit(batch_size)
    )).scalars().all()

    if not pending:
        return {"processed": 0, "tagged": 0, "failed": 0, "remaining": 0}

    # Split: xlsx (sync fast) vs AI (parallel)
    xlsx_files = [fe for fe in pending if fe.file_type == "xlsx"]
    ai_files = [fe for fe in pending if fe.file_type in ("pdf", "msg")]
    other_files = [fe for fe in pending if fe.file_type not in ("xlsx", "pdf", "msg")]

    tagged = 0
    failed = 0

    # Process xlsx: try direct parse, fallback to Gemini if no data
    for fe in xlsx_files:
        file_path = CLAIM_DIR.parent.parent / fe.file_path
        if not file_path.exists():
            fe.status = "failed"
            fe.extracted_data = {**(fe.extracted_data or {}), "_error": "file_not_found"}
            failed += 1
            continue
        result = _tag_xlsx(file_path)
        if not result:
            # xlsx parse failed → try Gemini multimodal as fallback
            ai_files.append(fe)
            continue
        fe.extracted_data = {**(fe.extracted_data or {}), **result}
        fe.status = "parsed"
        if result.get("ref_no") and not fe.ref_no:
            fe.ref_no = result["ref_no"]
        tagged += 1

    # Process PDF/MSG in parallel (up to 5 concurrent)
    def _process_ai_file(fe_id: int, file_path_str: str, file_type: str, existing_data: dict):
        fp = Path(file_path_str)
        if not fp.exists():
            return fe_id, None, "file_not_found"
        if file_type == "pdf":
            result = _tag_with_gemini(fp, "pdf")
        elif file_type == "msg":
            result = _tag_msg(fp)
        else:
            result = None
        return fe_id, result, None

    if ai_files:
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                loop.run_in_executor(
                    executor,
                    _process_ai_file,
                    fe.id,
                    str(CLAIM_DIR.parent.parent / fe.file_path),
                    fe.file_type,
                    fe.extracted_data or {},
                )
                for fe in ai_files
            ]
            results = await asyncio.gather(*futures)

        fe_map = {fe.id: fe for fe in ai_files}
        for fe_id, result, error in results:
            fe = fe_map[fe_id]
            if error:
                fe.status = "failed"
                fe.extracted_data = {**(fe.extracted_data or {}), "_error": error}
                failed += 1
            elif result:
                fe.extracted_data = {**(fe.extracted_data or {}), **result}
                fe.status = "parsed"
                if result.get("ref_no") and not fe.ref_no:
                    fe.ref_no = result["ref_no"]
                tagged += 1
            else:
                fe.status = "failed"
                fe.extracted_data = {**(fe.extracted_data or {}), "_error": "extraction_failed"}
                failed += 1

    # Mark unsupported as failed
    for fe in other_files:
        fe.status = "failed"
        fe.extracted_data = {**(fe.extracted_data or {}), "_error": f"unsupported_type:{fe.file_type}"}
        failed += 1

    await db.commit()

    remaining_count = (await db.execute(
        select(FileExtraction).where(FileExtraction.status == "pending")
    )).scalars().all()

    return {"processed": len(pending), "tagged": tagged, "failed": failed, "remaining": len(remaining_count)}


def _tag_xlsx(file_path: Path) -> dict | None:
    try:
        wb = openpyxl.load_workbook(str(file_path), read_only=True, data_only=True)
        ws = wb[wb.sheetnames[0]]
        rows = list(ws.iter_rows(max_row=30, values_only=True))
        wb.close()

        result = {}
        for row in rows:
            vals = [v for v in row if v is not None]
            if not vals:
                continue
            s = str(vals[0]).strip()
            if s == "Currency" and len(vals) > 1:
                result["currency"] = str(vals[1]).strip()
            elif "Total (100%)" in s and len(vals) > 1 and isinstance(vals[1], (int, float)):
                result["total_100"] = float(vals[1])
            elif s == "Insured" and len(vals) > 1:
                result["insured"] = str(vals[1]).strip()
            elif s == "Reinsured" and len(vals) > 1:
                result["reinsured"] = str(vals[1]).strip()
            elif s == "Type" and len(vals) > 1:
                result["claim_type_detail"] = str(vals[1]).strip()
            elif "Date of Loss" in s and len(vals) > 1:
                result["dol"] = str(vals[1])
            elif "Cedant" in s and "Ref" in s and len(vals) > 1:
                result["ref_no"] = str(vals[1]).strip()
            elif isinstance(vals[0], (int, float)) and vals[0] >= 1 and vals[0] <= 20 and len(vals) >= 4:
                name = str(vals[1]).strip() if vals[1] else None
                share = float(vals[2]) if isinstance(vals[2], (int, float)) else None
                amount = float(vals[3]) if isinstance(vals[3], (int, float)) else None
                if name and name != "0" and amount:
                    result.setdefault("reinsurers", []).append({"name": name, "share": share, "amount": amount})

        return result if result else None
    except Exception as e:
        logger.warning(f"XLSX tag error {file_path.name}: {e}")
        return None


def _tag_with_gemini(file_path: Path, file_type: str) -> dict | None:
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-3.1-flash-lite")
        uploaded = genai.upload_file(str(file_path))
        response = model.generate_content([
            uploaded,
            '''Extract info from this reinsurance document. Return JSON:
{"ref_no": "reference number if found", "insured": "피보험자", "reinsured": "재보험피보험자/출재사", "currency": "KRW/USD", "total_100": number or null, "reinsurers": [{"name": "reinsurer", "share": 0.05, "amount": number}], "doc_type": "PLA/SOC/CLOSING/OTHER", "summary": "1 sentence Korean summary"}
Only JSON.'''
        ])
        raw = response.text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]
            raw = raw.strip()
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Gemini tag error {file_path.name}: {e}")
        return None


def _tag_msg(file_path: Path) -> dict | None:
    try:
        import extract_msg
        msg = extract_msg.Message(str(file_path))
        result = {
            "email_subject": msg.subject,
            "email_from": str(msg.sender) if msg.sender else None,
            "email_to": str(msg.to) if msg.to else None,
            "email_date": str(msg.date) if msg.date else None,
            "summary": msg.subject,
        }
        body = msg.body[:2000] if msg.body else ""
        msg.close()

        # Try to extract ref_no from subject/body
        ref_match = re.search(r'(C?\d{7,}[-\d]*)', (result.get("email_subject") or "") + body)
        if ref_match:
            result["ref_no"] = ref_match.group(1)

        return result
    except Exception as e:
        logger.warning(f"MSG tag error {file_path.name}: {e}")
        return None
