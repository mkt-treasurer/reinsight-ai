"""Standalone SOC generator: upload file → parse → find policy → generate SOC per reinsurer."""

import tempfile
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import google.generativeai as genai

from app.database import get_db
from app.config import settings
from app.models.contract import Contract
from app.models.policy import Policy
from app.services.reinsurer_names import resolve_full_name
from app.services.soc_prompts import (
    EXTRACT_SIMPLE as EXTRACT_PROMPT,
    EXTRACT_CLAIM,
    AI_SEARCH_KEYWORDS,
    REINSURER_SPLITS_FROM_PDF,
    REINSURER_REASONING_FULL,
)
from app.services.soc_utils import (
    BROKER_ALIASES,
    CEDANT_FULL_TO_CODE,
    parse_json as _parse_json,
    fmt_amount as _fmt_amount,
    is_low_quality as _is_low_quality,
    is_broker_name,
    strip_corp_suffix,
    claim_to_dict as _claim_to_dict,
    contract_to_dict as _contract_to_dict,
    fmt_claim as _fmt_claim,
    fmt_contract as _fmt_contract,
)

router = APIRouter(prefix="/api/tools/soc", tags=["soc_generator"])
logger = logging.getLogger(__name__)


async def _extract_from_file(tmp_path: str, filename: str) -> dict | None:
    """Extract claim info from any file type."""
    suffix = Path(filename).suffix.lower()

    if suffix == ".xlsx":
        try:
            import openpyxl
            wb = openpyxl.load_workbook(tmp_path, read_only=True, data_only=True)
            ws = wb[wb.sheetnames[0]]
            rows = list(ws.iter_rows(max_row=30, values_only=True))
            wb.close()
            extracted = {}
            for row in rows:
                vals = [v for v in row if v is not None]
                if not vals: continue
                s = str(vals[0]).strip()
                if s == "Insured" and len(vals) > 1: extracted["account_name"] = str(vals[1]).strip()
                elif s == "Reinsured" and len(vals) > 1: extracted["reinsured"] = str(vals[1]).strip()
                elif s == "Currency" and len(vals) > 1: extracted["currency"] = str(vals[1]).strip()
                elif "Total (100%)" in s and len(vals) > 1 and isinstance(vals[1], (int, float)): extracted["total_amount"] = float(vals[1])
                elif "Date of Loss" in s and len(vals) > 1: extracted["dol"] = str(vals[1])
                elif "Cedant" in s and "Ref" in s and len(vals) > 1: extracted["ref_no"] = str(vals[1]).strip()
                elif s == "Type" and len(vals) > 1: extracted["line"] = str(vals[1]).strip()
                elif "Location" in s and len(vals) > 1: extracted["location_of_loss"] = str(vals[1]).strip()
                elif "Particulars" in s and len(vals) > 1: extracted["particulars"] = str(vals[1]).strip()
                elif "Policy Period" in s and len(vals) > 1: extracted["policy_period"] = str(vals[1]).strip()
            return extracted if extracted else None
        except:
            return None

    if suffix == ".pdf":
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel("gemini-3.1-flash-lite")
            uploaded = genai.upload_file(tmp_path)
            resp = model.generate_content([uploaded, f"File: {filename}\n{EXTRACT_PROMPT}"])
            return _parse_json(resp.text)

        except:
            return None

    if suffix == ".msg":
        try:
            import extract_msg
            msg = extract_msg.Message(tmp_path)
            text = "\n".join(filter(None, [msg.subject, msg.body[:3000] if msg.body else None]))
            msg.close()
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel("gemini-3.1-flash-lite")
            resp = model.generate_content(f"{EXTRACT_PROMPT}\n\nContent:\n{text}")
            return _parse_json(resp.text)
        except:
            return None

    return None


def _merge_extracted(base: dict, extra) -> dict:
    """Merge two extracted dicts — prefer longer/better quality values."""
    if not isinstance(extra, dict):
        return base
    merged = {**base}
    for k, v in extra.items():
        if _is_low_quality(v):
            continue
        existing = merged.get(k)
        if _is_low_quality(existing):
            merged[k] = v
        elif isinstance(v, str) and isinstance(existing, str) and len(v) > len(existing):
            # Prefer longer string (more detailed)
            merged[k] = v
    return merged


@router.post("/parse")
async def parse_uploaded_file(
    files: list[UploadFile] = File(default=[]),
    text: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Parse multiple files + text. Merges info from all sources."""

    extracted = {}
    tmp_paths = []
    xlsx_path = None
    best_ri_path = None  # best file for reinsurer splits

    # Process all uploaded files
    for file in files:
        data = await file.read()
        suffix = Path(file.filename or "").suffix.lower()
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(data)
            f.flush()
            tmp_paths.append((f.name, file.filename, suffix))

        if suffix == ".xlsx":
            xlsx_path = f.name
            best_ri_path = f.name
        elif suffix == ".pdf" and not xlsx_path:
            best_ri_path = f.name

    # Upload ALL files to Gemini at once + text, ask one comprehensive question
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-3.1-flash-lite")

    def _ingest_file(path: str, label: str, parts_out: list, depth: int = 0):
        """Convert a file into parts the Gemini SDK can consume.

        - .msg  → extracted text (Gemini rejects msg uploads)
        - .xls  → extracted text via xlrd (Gemini rejects xls uploads)
        - .zip  → recurse into each inner file (depth-limited)
        - .pdf / .xlsx / other → upload as-is to Gemini
        """
        if depth > 2:
            return
        suf = Path(path).suffix.lower()
        try:
            if suf == ".msg":
                import extract_msg
                m = extract_msg.Message(path)
                parts_out.append(f"[{label}]\nSubject: {m.subject or ''}\n\n{(m.body or '')[:4000]}")
                m.close()
                return
            if suf == ".xls":
                import xlrd
                bk = xlrd.open_workbook(path)
                lines = [f"[{label}]"]
                for sh in bk.sheets()[:3]:
                    lines.append(f"Sheet: {sh.name}")
                    for ri in range(min(sh.nrows, 40)):
                        vs = [str(sh.cell_value(ri, ci)) for ci in range(min(sh.ncols, 20))]
                        row = " | ".join(v for v in vs if v and v != "0.0")
                        if row.strip():
                            lines.append(row)
                parts_out.append("\n".join(lines)[:5000])
                return
            if suf == ".zip":
                import zipfile, tempfile as _tf
                with zipfile.ZipFile(path) as zf:
                    for name in zf.namelist()[:10]:
                        inner_suf = Path(name).suffix.lower()
                        if inner_suf not in {".pdf", ".msg", ".xlsx", ".xls", ".txt", ".zip"}:
                            continue
                        with _tf.NamedTemporaryFile(suffix=inner_suf, delete=False) as nf:
                            nf.write(zf.read(name))
                            inner_path = nf.name
                        _ingest_file(inner_path, f"{label}/{name}", parts_out, depth + 1)
                return
            # .pdf / .xlsx / others — upload as-is
            up = genai.upload_file(path)
            parts_out.append(up)
            parts_out.append(f"[{label}]")
        except Exception as e:
            logger.warning(f"Ingest failed ({label}, {suf}): {e}")

    parts: list = []
    for tmp_path, filename, suffix in tmp_paths:
        _ingest_file(tmp_path, filename, parts)

    if text and text.strip():
        parts.append(f"[Additional text]:\n{text[:3000]}")

    # Get policy context — will be filled after first pass extraction
    policy_context = ""

    # Get claims context for this ref_no (if found in files)
    claims_context = ""

    # Get contract context
    contracts_context = ""

    # PASS 1: Extract claim details from all files
    parts.append(EXTRACT_CLAIM)

    try:
        resp = model.generate_content(parts)
        ai_result = _parse_json(resp.text)
    except Exception as e:
        logger.error(f"AI extraction failed: {e}")
        return {"error": f"AI extraction failed: {e}"}

    if not ai_result:
        return {"error": "AI returned empty response"}
    if isinstance(ai_result, list):
        ai_result = ai_result[0] if ai_result else {}
    if not isinstance(ai_result, dict):
        return {"error": f"AI returned unexpected type: {type(ai_result)}"}

    # PASS 2: Gather all evidence from DB, then ask AI to reason about reinsurer selection
    file_ri_name = ai_result.get("file_reinsurer_name", "")
    file_share = float(str(ai_result.get("file_share") or 0).replace(",", ""))
    file_amount = float(str(ai_result.get("file_amount") or 0).replace(",", ""))
    insured_name = ai_result.get("account_name", "")
    ref_no = ai_result.get("ref_no", "")
    line = ai_result.get("line", "")

    # Extract ref_no from filenames — more reliable than AI for structured filenames.
    # Patterns: "RefNo(C2020023652109-1-20)" or "C2020023652109-1-20" in filename.
    import re as _re
    for _, fname, _ in tmp_paths:
        if not fname:
            continue
        # Explicit RefNo(...) pattern (most reliable)
        m = _re.search(r'RefNo\(([^)]+)\)', fname)
        if m:
            ref_no = m.group(1).strip()
            break
        # Cedant-style ref like C2020023652109-1-20
        m = _re.search(r'(C\d{6,}[\d\-]+)', fname)
        if m and len(m.group(1)) > len(ref_no or ""):
            ref_no = m.group(1).strip()

    # Also extract potential English insured names from filenames.
    # e.g. "KB_SOC_202603_JUNGHWA MEDICAL FOUNDATION_2024..." → "JUNGHWA MEDICAL FOUNDATION"
    filename_names: list[str] = []
    for _, fname, _ in tmp_paths:
        if not fname:
            continue
        for m in _re.finditer(r'(?:SOC[_ ]?\d*[_ ]?|KB[_ ]SOC[_ ]\d+[_ ])([\w\s.,()]+?)(?:[_ ]\d{4,}|$)', fname):
            candidate = m.group(1).strip().strip("_").strip()
            if len(candidate) > 3 and not candidate.replace(" ", "").isdigit():
                filename_names.append(candidate)
        # Also try: between first _ and ref-like pattern
        parts = fname.replace(".", "_").split("_")
        for p in parts:
            p = p.strip()
            if len(p) > 5 and p[0].isalpha() and not p.isdigit() and not p.lower().startswith(("kb", "soc", "settlement", "korean", "re-fac", "인스")):
                filename_names.append(p)

    # Evidence 1: Past claims with same/similar ref_no or account
    from app.models.claim import Claim as ClaimModel

    # Evidence containers — kept as structured dicts so we can return them for UI display
    past_claims_data: list[dict] = []
    claims_search_method = ""  # "ref" | "ai-keywords" | "direct-name"

    if ref_no:
        # Extract base ref (before last dash segment)
        import re
        # Strip only short trailing segments like "-1-43", not long ones like "-0712022183"
        base_ref = re.sub(r'-\d{1,4}$', '', ref_no)
        found = (await db.execute(
            select(ClaimModel).where(ClaimModel.ref_no.ilike(f"%{base_ref}%")).limit(20)
        )).scalars().all()
        if found:
            claims_search_method = f"ref ILIKE %{base_ref}%"
            past_claims_data = [_claim_to_dict(cl) for cl in found]

    # Ask AI to generate DB-search keywords for the insured. This handles cases
    # where the extracted name ("의료법인담우의료재단 현대유비스병원") differs
    # from how the DB stored it ("UVIS HOSPITAL(현대유비스병원)").
    async def _ai_search_keywords(name: str) -> list[str]:
        if not name:
            return []
        try:
            kw_model = genai.GenerativeModel("gemini-3.1-flash-lite")
            prompt = AI_SEARCH_KEYWORDS.format(name=name)
            resp = kw_model.generate_content(prompt)
            out = _parse_json(resp.text) or []
            if isinstance(out, list):
                return [str(k).strip() for k in out if str(k).strip() and len(str(k).strip()) >= 2][:8]
        except Exception as e:
            logger.warning(f"AI keyword gen failed: {e}")
        return []

    async def _search_one(table, name_col, extra_where, name: str, limit: int = 20):
        """Try ILIKE on full name, then filename-derived names, then AI keywords.

        Returns: (rows, method_string)
        """
        q = select(table).where(name_col.ilike(f"%{name}%"), *extra_where).limit(limit)
        rows = (await db.execute(q)).scalars().all()
        if rows:
            return rows, f"ILIKE %{name}%"
        # Try name with legal suffix stripped — DB often stores short form ("POSCO DX")
        stripped = strip_corp_suffix(name)
        if stripped and stripped != name:
            q = select(table).where(name_col.ilike(f"%{stripped}%"), *extra_where).limit(limit)
            rows = (await db.execute(q)).scalars().all()
            if rows:
                return rows, f"ILIKE %{stripped}% (corp-suffix stripped)"
        # Try filename-derived English names before calling AI
        for fn in filename_names:
            q = select(table).where(name_col.ilike(f"%{fn}%"), *extra_where).limit(limit)
            rows = (await db.execute(q)).scalars().all()
            if rows:
                return rows, f"filename ILIKE %{fn}%"
        for kw in await _ai_search_keywords(name):
            q = select(table).where(name_col.ilike(f"%{kw}%"), *extra_where).limit(limit)
            rows = (await db.execute(q)).scalars().all()
            if rows:
                return rows, f"AI keyword ILIKE %{kw}%"
        return [], "no match"

    # Past-claims search by insured name (AI-assisted) — only if ref search failed
    if not past_claims_data and insured_name:
        rows, method = await _search_one(ClaimModel, ClaimModel.account_name, [], insured_name)
        claims_search_method = method
        past_claims_data = [_claim_to_dict(cl) for cl in rows]

    # Evidence 2: Contracts with same insured (AI-assisted search)
    contracts_data: list[dict] = []
    contracts_search_method = ""
    if insured_name:
        rows, method = await _search_one(Contract, Contract.assured, [Contract.share > 0], insured_name)
        contracts_search_method = method
        contracts_data = [_contract_to_dict(c) for c in rows]

    # Stringified forms for the prompt
    past_claims = [_fmt_claim(d) for d in past_claims_data]
    matching_contracts = [_fmt_contract(d) for d in contracts_data]

    # PASS 2: AI reasoning — decide reinsurer splits with chain of thought
    reasoning_prompt = REINSURER_REASONING_FULL.format(
        insured_name=insured_name,
        line=line,
        ref_no=ref_no,
        file_ri_name=file_ri_name,
        file_share_pct=file_share * 100,
        file_amount=file_amount,
        past_claims_block=chr(10).join(past_claims[:15]) if past_claims else "(없음)",
        contracts_block=chr(10).join(matching_contracts[:15]) if matching_contracts else "(없음)",
    )

    genai.configure(api_key=settings.gemini_api_key)
    model2 = genai.GenerativeModel("gemini-3.1-flash-lite")
    try:
        resp2 = model2.generate_content(reasoning_prompt)
        reasoning_result = _parse_json(resp2.text)
        if isinstance(reasoning_result, list):
            reasoning_result = reasoning_result[0] if reasoning_result else None
    except Exception as e:
        logger.error(f"AI reasoning failed: {e}")
        reasoning_result = None

    logger.info(f"SOC resolve: file_ri={file_ri_name}, reasoning={bool(reasoning_result)}")

    # Build extracted dict
    extracted = {
        "account_name": ai_result.get("account_name"),
        "reinsured": ai_result.get("reinsured"),
        "cedant": ai_result.get("cedant_code"),
        "line": ai_result.get("line"),
        "ref_no": ai_result.get("ref_no"),
        "dol": ai_result.get("dol"),
        "currency": ai_result.get("currency"),
        "total_amount": ai_result.get("total_amount_100"),
        "location_of_loss": ai_result.get("location_of_loss"),
        "nature_of_loss": ai_result.get("nature_of_loss"),
        "particulars": ai_result.get("particulars"),
        "policy_period": ai_result.get("policy_period"),
        "description": ai_result.get("description"),
    }

    # Build SOCs from AI reasoning
    ccy = extracted.get("currency", "KRW")
    try:
        total = float(str(extracted.get("total_amount") or 0).replace(",", ""))
    except:
        total = 0
    extracted["total_amount"] = total
    socs = []
    thinking = []

    if reasoning_result and isinstance(reasoning_result, dict):
        thinking = reasoning_result.get("thinking", [])
        for ri in (reasoning_result.get("reinsurers") or []):
            name = ri.get("name", "")
            if not name or is_broker_name(name):
                continue
            share = float(str(ri.get("share") or 0).replace(",", ""))
            # Amount: use file_amount if available (most accurate), otherwise calculate from total
            if file_amount and len(reasoning_result.get("reinsurers", [])) == 1:
                amount = file_amount  # file already has exact amount
            else:
                amount = total * share  # calculate from total
            socs.append({
                "reinsurer": resolve_full_name(name), "share": share,
                "share_pct": f"{share * 100:.2f}%",
                "amount": amount, "amount_fmt": _fmt_amount(ccy, amount),
                "cedant": extracted.get("cedant", ""),
                "confidence": ri.get("source", "AI"),
                "reasoning": ri.get("reasoning", ""),
            })

    # Find policy for verification
    policy_data = await _find_policy_for_claim(extracted, db)

    # If AI couldn't find reinsurers, fallback to policy
    if not socs and policy_data:
        contracts = (await db.execute(
            select(Contract).where(Contract.cover_note_no == policy_data["cover_note_no"], Contract.share > 0)
        )).scalars().all()
        for c in contracts:
            share = float(c.share or 0)
            amount = total * share
            socs.append({
                "reinsurer": resolve_full_name(c.reinsurer), "share": share,
                "share_pct": f"{share * 100:.2f}%",
                "amount": amount, "amount_fmt": _fmt_amount(ccy, amount),
                "cedant": c.cedant or "", "confidence": "POLICY",
            })

    # Mark evidence as "used" when their reinsurer appears in the final SOCs.
    # Use the same canonical normalization as the test suite so e.g. "MR KR" = "Munich Re Korea".
    from app.routers.soc_test_suite import _norm_reinsurer
    used_reinsurers = {_norm_reinsurer(s["reinsurer"]) for s in socs if s.get("reinsurer")}
    for d in past_claims_data:
        d["used"] = bool(d.get("reinsurer")) and _norm_reinsurer(d["reinsurer"]) in used_reinsurers
    for d in contracts_data:
        d["used"] = bool(d.get("reinsurer")) and _norm_reinsurer(d["reinsurer"]) in used_reinsurers

    logger.info(f"SOC: {len(tmp_paths)} files, extracted={extracted.get('account_name')}, socs={len(socs)}")

    return {
        "source": f"{len(files)} files" if files else "text",
        "extracted": extracted,
        "policy": policy_data,
        "socs": socs,
        "thinking": thinking,
        "files_processed": len(tmp_paths),
        "evidence": {
            "file_reinsurer": {"name": file_ri_name, "share": file_share, "amount": file_amount},
            "past_claims": {
                "search_method": claims_search_method,
                "rows": past_claims_data,
            },
            "contracts": {
                "search_method": contracts_search_method,
                "rows": contracts_data,
            },
            "policy_match": policy_data,
        },
    }


@router.post("/generate")
async def generate_from_data(
    account_name: str = Form(...),
    cedant: str = Form(""),
    line: str = Form(""),
    ref_no: str = Form(""),
    dol: str = Form(""),
    currency: str = Form("KRW"),
    total_amount: float = Form(0),
    reinsured: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """Generate SOC data from manual input."""
    extracted = {
        "account_name": account_name, "cedant": cedant, "line": line,
        "ref_no": ref_no, "dol": dol, "currency": currency,
        "total_amount": total_amount, "reinsured": reinsured,
    }
    policy_data = await _find_policy_for_claim(extracted, db)
    socs = await _generate_soc_data(extracted, policy_data, db)
    return {"extracted": extracted, "policy": policy_data, "socs": socs}


async def _find_policy_for_claim(extracted: dict, db: AsyncSession) -> dict | None:
    """Find matching policy. Falls back to AI if rule-based fails."""
    import re
    def _norm(s): return re.sub(r'\([^)]*\)', '', (s or "").strip().lower().replace("co.,ltd", "").replace("co., ltd", "").replace("inc.", "").replace("corp.", "").replace("ltd.", "")).strip()

    from app.services.soc_utils import normalize_cedant
    raw_cedant = (extracted.get("cedant") or "").strip()
    norm_cedant = normalize_cedant(raw_cedant)

    policies = (await db.execute(select(Policy))).scalars().all()
    name = _norm(extracted.get("account_name", ""))
    best, best_score = None, 0

    for p in policies:
        score = 0
        pn = _norm(p.assured)
        if pn and name:
            if pn == name: score += 40
            elif pn in name or name in pn: score += 30
            else:
                ta, tb = set(pn.split()), set(name.split())
                if ta and tb and len(ta & tb) > 0:
                    score += int(len(ta & tb) / len(ta | tb) * 25)
        if p.cedant and (p.cedant == norm_cedant or p.cedant == raw_cedant):
            score += 20
        has_valid = (await db.execute(
            select(Contract.id).where(Contract.cover_note_no == p.cover_note_no, Contract.share > 0).limit(1)
        )).scalar_one_or_none()
        if not has_valid:
            continue
        if score > best_score:
            best_score = score
            best = p

    if best and best_score >= 30:
        return {"id": best.id, "cover_note_no": best.cover_note_no, "assured": best.assured, "cedant": best.cedant, "score": best_score}

    # AI fallback: ask Gemini to find the right policy
    if name:
        try:
            top_policies = sorted(policies, key=lambda p: 0, reverse=True)[:50]
            policy_list = "\n".join([f"ID={p.id} | {p.assured} | {p.cedant} | {p.cover_note_no}" for p in top_policies if p.assured])
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel("gemini-3.1-flash-lite")
            resp = model.generate_content(f"Which policy matches this claim? Account: {extracted.get('account_name')}, Cedant: {raw_cedant}, Line: {extracted.get('line')}\n\nPolicies:\n{policy_list}\n\nReturn only the policy ID number, or 'none'.")
            pid_text = resp.text.strip()
            if pid_text.isdigit():
                pid = int(pid_text)
                match = next((p for p in policies if p.id == pid), None)
                if match:
                    return {"id": match.id, "cover_note_no": match.cover_note_no, "assured": match.assured, "cedant": match.cedant, "score": 25}
        except Exception as e:
            logger.warning(f"AI policy match failed: {e}")

    return None


async def _extract_reinsurers_from_file(file_path: str) -> list[dict] | None:
    """Try to extract reinsurer splits directly from uploaded file."""
    p = Path(file_path)
    if not p.exists():
        return None

    if p.suffix.lower() == ".xlsx":
        try:
            import openpyxl
            wb = openpyxl.load_workbook(str(p), read_only=True, data_only=True)
            ws = wb[wb.sheetnames[0]]
            rows = list(ws.iter_rows(max_row=30, values_only=True))
            wb.close()
            reinsurers = []
            for row in rows:
                vals = [v for v in row if v is not None]
                if isinstance(vals[0] if vals else None, (int, float)) and 1 <= vals[0] <= 20 and len(vals) >= 4:
                    name = str(vals[1]).strip() if vals[1] else None
                    share = float(vals[2]) if isinstance(vals[2], (int, float)) else None
                    amount = float(vals[3]) if isinstance(vals[3], (int, float)) else None
                    if name and name != "0" and not name.lower().startswith("name") and len(name) > 1 and (amount or share):
                        reinsurers.append({"name": name, "share": share, "amount": amount})
            return reinsurers if reinsurers else None
        except:
            return None

    if p.suffix.lower() == ".pdf":
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel("gemini-3.1-flash-lite")
            uploaded = genai.upload_file(str(p))
            resp = model.generate_content([uploaded, REINSURER_SPLITS_FROM_PDF])
            result = _parse_json(resp.text)
            # Keep all results — even broker names (will be resolved later)
            return result if isinstance(result, list) and result else None
        except:
            return None

    return None


async def _generate_soc_data(extracted: dict, policy_data: dict | None, db: AsyncSession, uploaded_file_path: str | None = None) -> list[dict]:
    """Generate SOC entries. Priority: file > policy > manual."""
    ccy = extracted.get("currency", "KRW")
    total = float(extracted.get("total_amount") or 0)
    socs = []

    # 1. Try extracting from uploaded file first
    if uploaded_file_path:
        file_reinsurers = await _extract_reinsurers_from_file(uploaded_file_path)
        if file_reinsurers:
            for ri in file_reinsurers:
                share = float(ri.get("share") or 0)
                amount = float(ri.get("amount") or (total * share))
                if ri["name"] and (amount != 0 or share != 0):
                    socs.append({
                        "reinsurer": resolve_full_name(ri["name"]), "share": share,
                        "share_pct": f"{share * 100:.2f}%",
                        "amount": amount, "amount_fmt": _fmt_amount(ccy, amount),
                        "cedant": extracted.get("cedant", ""),
                        "confidence": "FILE",
                    })
            if socs:
                return socs

    # 2. Fallback to policy splits
    if policy_data:
        contracts = (await db.execute(
            select(Contract).where(Contract.cover_note_no == policy_data["cover_note_no"], Contract.share > 0)
        )).scalars().all()

        for c in contracts:
            share = float(c.share or 0)
            amount = total * share
            socs.append({
                "reinsurer": resolve_full_name(c.reinsurer), "share": share,
                "share_pct": f"{share * 100:.2f}%",
                "amount": amount, "amount_fmt": _fmt_amount(ccy, amount),
                "cedant": c.cedant or extracted.get("cedant", ""),
                "confidence": "POLICY",
            })

    return socs
