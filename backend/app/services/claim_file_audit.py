"""Audit: match DB claims to actual files and compare amounts.
Uses FileExtraction table to cache parsed results."""

import json
import logging
import re
from pathlib import Path
from collections import defaultdict

import openpyxl
import google.generativeai as genai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.claim import Claim
from app.models.file_extraction import FileExtraction

logger = logging.getLogger(__name__)
CLAIM_DIR = Path("/app/data/보험금/2026년 3월")


def _extract_amounts_xlsx(file_path: Path) -> dict | None:
    """Extract amounts from PLA/SOC xlsx file."""
    try:
        wb = openpyxl.load_workbook(str(file_path), read_only=True, data_only=True)
        ws = wb[wb.sheetnames[0]]
        rows = list(ws.iter_rows(max_row=30, values_only=True))
        wb.close()

        result = {"currency": None, "total_100": None, "reinsurers": []}
        for row in rows:
            vals = [v for v in row if v is not None]
            if not vals: continue
            s = str(vals[0]).strip()
            if s == "Currency" and len(vals) > 1:
                result["currency"] = str(vals[1]).strip()
            elif "Total (100%)" in s and len(vals) > 1 and isinstance(vals[1], (int, float)):
                result["total_100"] = float(vals[1])
            elif isinstance(vals[0], (int, float)) and vals[0] >= 1 and vals[0] <= 20 and len(vals) >= 4:
                name = str(vals[1]).strip() if vals[1] else None
                share = float(vals[2]) if isinstance(vals[2], (int, float)) else None
                amount = float(vals[3]) if isinstance(vals[3], (int, float)) else None
                if name and name != "0" and amount:
                    result["reinsurers"].append({"name": name, "share": share, "amount": amount})
        return result if result["total_100"] is not None else None
    except Exception as e:
        logger.warning(f"XLSX parse error {file_path.name}: {e}")
        return None


def _extract_amounts_pdf_multimodal(file_path: Path) -> dict | None:
    """Extract amounts from PDF using Gemini multimodal (sends file directly)."""
    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-3.1-flash-lite")
        uploaded = genai.upload_file(str(file_path))
        response = model.generate_content([
            uploaded,
            'Extract all amounts from this reinsurance document. Return JSON: {"currency": "KRW", "total_100": number, "reinsurer_amounts": [{"name": "reinsurer", "share": 0.05, "amount": number}], "summary": "1 sentence Korean summary"}\nOnly JSON.'
        ])
        raw = response.text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]
            raw = raw.strip()
        result = json.loads(raw)
        # Normalize to match xlsx format
        if "reinsurer_amounts" in result and "reinsurers" not in result:
            result["reinsurers"] = result.pop("reinsurer_amounts")
        return result
    except Exception as e:
        logger.warning(f"PDF multimodal extract failed {file_path.name}: {e}")
        return None


def _scan_claim_files() -> dict[str, list[dict]]:
    """Scan all claim files and index by ref_no."""
    if not CLAIM_DIR.exists():
        return {}
    ref_pattern = re.compile(r'(C?\d{4,}[-\d]+)')
    index: dict[str, list[dict]] = defaultdict(list)

    for date_dir in CLAIM_DIR.iterdir():
        if not date_dir.is_dir(): continue
        for type_dir in date_dir.iterdir():
            if not type_dir.is_dir(): continue
            for company_dir in type_dir.iterdir():
                if not company_dir.is_dir(): continue
                # Collect all ref_nos found in this company folder
                folder_refs = set()
                # First pass: find ref_nos from subfolders and filenames
                for item in company_dir.iterdir():
                    if item.is_dir():
                        ref_match = ref_pattern.search(item.name)
                        if ref_match:
                            folder_refs.add(ref_match.group(1))
                            files = [{"name": f.name, "path": str(f.relative_to(CLAIM_DIR.parent.parent)), "type": f.suffix.lower()[1:]}
                                     for f in item.rglob("*") if f.is_file() and f.suffix.lower() in (".pdf", ".xlsx", ".msg", ".doc", ".docx")]
                            index[ref_match.group(1)].append({"date": date_dir.name, "claim_type": type_dir.name, "company": company_dir.name, "files": files})
                    elif item.is_file() and item.suffix.lower() in (".pdf", ".xlsx", ".msg"):
                        ref_match = ref_pattern.search(item.stem)
                        if ref_match:
                            folder_refs.add(ref_match.group(1))
                            index[ref_match.group(1)].append({"date": date_dir.name, "claim_type": type_dir.name, "company": company_dir.name,
                                                              "files": [{"name": item.name, "path": str(item.relative_to(CLAIM_DIR.parent.parent)), "type": item.suffix.lower()[1:]}]})

                # Second pass: files WITHOUT ref_no in name → attach to first ref found in this folder
                if folder_refs:
                    primary_ref = sorted(folder_refs)[0]
                    for item in company_dir.iterdir():
                        if item.is_file() and item.suffix.lower() in (".pdf", ".xlsx", ".msg"):
                            ref_match = ref_pattern.search(item.stem)
                            if not ref_match:
                                # No ref in filename — attach to folder's primary ref
                                index[primary_ref].append({"date": date_dir.name, "claim_type": type_dir.name, "company": company_dir.name,
                                                           "files": [{"name": item.name, "path": str(item.relative_to(CLAIM_DIR.parent.parent)), "type": item.suffix.lower()[1:]}]})
    return dict(index)


async def extract_and_cache(db: AsyncSession) -> dict:
    """Extract amounts from all claim files and cache in DB. xlsx first, PDF multimodal fallback."""
    file_index = _scan_claim_files()
    all_files = []
    for ref_no, entries in file_index.items():
        for e in entries:
            for f in e["files"]:
                if f["type"] in ("xlsx", "pdf"):
                    all_files.append({"ref_no": ref_no, "claim_type": e["claim_type"], **f})

    existing = set((await db.execute(select(FileExtraction.file_path))).scalars().all())

    parsed_refs = set()
    for fe in (await db.execute(select(FileExtraction).where(FileExtraction.status == "parsed"))).scalars().all():
        if fe.ref_no:
            parsed_refs.add(fe.ref_no)

    logger.info(f"Extract: {len(all_files)} files to check, {len(existing)} already cached, {len(parsed_refs)} refs already parsed")

    new_count = 0
    ai_count = 0
    for f in all_files:
        if f["path"] in existing:
            continue
        # Skip PDF if this ref already has a successful xlsx extraction
        if f["type"] == "pdf" and f["ref_no"] in parsed_refs:
            continue

        fpath = CLAIM_DIR.parent.parent / f["path"]
        extracted = None

        if f["type"] == "xlsx":
            extracted = _extract_amounts_xlsx(fpath)
            if extracted:
                parsed_refs.add(f["ref_no"])
        elif f["type"] == "pdf":
            # Skip PDF in batch — use "Extract with AI" button per file
            continue

        fe = FileExtraction(
            file_path=f["path"], file_name=f["name"], file_type=f["type"],
            claim_type=f.get("claim_type"), ref_no=f["ref_no"],
            extracted_data=extracted, status="parsed" if extracted else "failed",
        )
        db.add(fe)
        new_count += 1

    await db.commit()
    total_cached = (await db.execute(select(FileExtraction))).scalars().all()
    return {"new_extracted": new_count, "ai_extracted": ai_count, "total_cached": len(total_cached)}


async def audit_claims_vs_files(db: AsyncSession) -> dict:
    """Compare DB claims with cached file extractions."""
    # First ensure extractions are cached
    cache_result = await extract_and_cache(db)

    # Load all cached extractions
    extractions = (await db.execute(select(FileExtraction).where(FileExtraction.status == "parsed"))).scalars().all()
    ext_by_ref: dict[str, list[FileExtraction]] = defaultdict(list)
    for e in extractions:
        if e.ref_no:
            ext_by_ref[e.ref_no].append(e)

    # Get claims
    claims = (await db.execute(
        select(Claim).where(Claim.ref_no.isnot(None)).where(Claim.booking_month.like("26-%"))
    )).scalars().all()

    claims_by_ref: dict[str, list] = defaultdict(list)
    for cl in claims:
        if cl.ref_no:
            claims_by_ref[cl.ref_no.strip()].append(cl)

    # Also scan file index for file listing
    file_index = _scan_claim_files()

    matched = []
    no_file = []
    file_only_refs = set(file_index.keys())

    for ref_no, claim_group in claims_by_ref.items():
        file_only_refs.discard(ref_no)
        file_entries = file_index.get(ref_no)
        if not file_entries:
            no_file.append({
                "ref_no": ref_no, "account_name": claim_group[0].account_name,
                "reinsurers": list(set(c.reinsurer for c in claim_group if c.reinsurer)),
                "claim_count": len(claim_group), "total_krw": sum(float(c.krw_amount or 0) for c in claim_group),
            })
            continue

        all_files = [f for e in file_entries for f in e["files"]]
        db_total = sum(float(c.krw_amount or 0) for c in claim_group)

        # Get cached extractions
        cached = ext_by_ref.get(ref_no, [])
        all_extractions = []
        file_amounts = None
        for ce in cached:
            if ce.extracted_data and ce.extracted_data.get("total_100") is not None:
                all_extractions.append({"file": ce.file_name, "type": ce.file_type, **ce.extracted_data})
                if not file_amounts:
                    file_amounts = ce.extracted_data

        # Compare
        amount_diffs = []
        amount_status = "no_data"
        if file_amounts and file_amounts.get("total_100") is not None:
            ri_list = file_amounts.get("reinsurers") or []
            for fri in ri_list:
                fri_name = fri.get("name", "")
                fri_amount = fri.get("amount", 0)
                db_match = next((c for c in claim_group if c.reinsurer and (c.reinsurer.lower() in fri_name.lower() or fri_name.lower() in c.reinsurer.lower())), None)
                if db_match:
                    db_amt = float(db_match.krw_amount or 0)
                    diff = fri_amount - db_amt
                    if abs(diff) > 1:
                        amount_diffs.append({"reinsurer": fri_name, "file_amount": fri_amount, "db_amount": db_amt, "diff": diff})
            amount_status = "match" if not amount_diffs else "mismatch"

        cross_file_ok = True
        if len(all_extractions) >= 2:
            totals = [e["total_100"] for e in all_extractions if e.get("total_100") is not None]
            if totals and len(set(round(t) for t in totals)) > 1:
                cross_file_ok = False

        matched.append({
            "ref_no": ref_no, "account_name": claim_group[0].account_name,
            "reinsurers": list(set(c.reinsurer for c in claim_group if c.reinsurer)),
            "claim_count": len(claim_group), "total_krw": db_total,
            "file_count": len(all_files),
            "file_types": list(set(f["type"] for f in all_files)),
            "claim_type": file_entries[0]["claim_type"],
            "date": file_entries[0]["date"],
            "files": all_files,
            "file_total_100": file_amounts.get("total_100") if file_amounts else None,
            "file_currency": file_amounts.get("currency") if file_amounts else None,
            "amount_status": amount_status,
            "amount_diffs": amount_diffs,
            "extractions": all_extractions,
            "cross_file_ok": cross_file_ok,
        })

    orphan_files = [{"ref_no": r, "company": file_index[r][0]["company"], "claim_type": file_index[r][0]["claim_type"],
                     "date": file_index[r][0]["date"], "file_count": sum(len(e["files"]) for e in file_index[r])}
                    for r in file_only_refs]

    return {
        "total_claims_checked": len(claims_by_ref),
        "matched": len(matched), "no_file": len(no_file), "orphan_files": len(orphan_files),
        "total_file_refs": len(file_index),
        "cache": cache_result,
        "matched_details": sorted(matched, key=lambda x: -abs(x["total_krw"])),
        "no_file_details": sorted(no_file, key=lambda x: -abs(x["total_krw"])),
        "orphan_file_details": orphan_files,
    }
