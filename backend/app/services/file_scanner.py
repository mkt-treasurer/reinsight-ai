"""Scan Actual data folders and match files to policies using AI."""

import re
import json
import logging
from pathlib import Path
from collections import defaultdict

import google.generativeai as genai
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.policy import Policy, PolicyDocument

logger = logging.getLogger(__name__)

DATA_DIR = Path("/app/data")
ACTUAL_DIR = DATA_DIR / "보험료" / "Actual2026 3월 자료"

# Map file extensions/names to document types
DOC_TYPE_PATTERNS = [
    (r"(?i)closing", "closing"),
    (r"(?i)^STMT", "stmt"),
    (r"(?i)CD\s*Note|CN_|DN_", "cd_note"),
    (r"(?i)cover\s*page|파일링", "cover_page"),
    (r"(?i)slip|출재슬립", "slip"),
    (r"(?i)endorse|배서", "endorsement"),
    (r"(?i)signed|\[SIGNED\]", "signed"),
    (r"(?i)service\s*fee|invoice", "invoice"),
]

SKIP_EXTENSIONS = {".db", ".txt", ".hwp", ".zip"}


def _classify_doc(filename: str) -> str:
    for pattern, doc_type in DOC_TYPE_PATTERNS:
        if re.search(pattern, filename):
            return doc_type
    ext = Path(filename).suffix.lower()
    if ext in (".pdf",):
        return "pdf"
    if ext in (".doc", ".docx"):
        return "document"
    if ext in (".xlsx", ".xls"):
        return "spreadsheet"
    if ext in (".msg",):
        return "email"
    return "other"


def _normalize_for_match(s: str) -> str:
    """Normalize text for fuzzy matching."""
    s = s.lower().strip()
    s = re.sub(r'[_\-\s]+', ' ', s)
    s = re.sub(r'\([^)]*\)', '', s)
    return s.strip()


async def scan_and_match(db: AsyncSession) -> dict:
    """Scan Actual folder, match files to policies, save as PolicyDocuments."""
    if not ACTUAL_DIR.exists():
        logger.warning(f"Actual dir not found: {ACTUAL_DIR}")
        return {"error": "Actual directory not found"}

    # Clear old documents
    await db.execute(text("DELETE FROM policy_documents"))
    await db.commit()

    # Load all policies for matching
    policies = (await db.execute(select(Policy))).scalars().all()

    # Build match index: normalized assured → policy
    policy_index: dict[str, list[Policy]] = defaultdict(list)
    for p in policies:
        if p.assured:
            norm = _normalize_for_match(p.assured)
            policy_index[norm].append(p)
            # Also index individual words
            for word in norm.split():
                if len(word) > 2:
                    policy_index[word].append(p)

    # Collect all deal folders
    deals = []
    for line_dir in ACTUAL_DIR.iterdir():
        if not line_dir.is_dir():
            continue
        for deal_dir in line_dir.iterdir():
            if not deal_dir.is_dir():
                continue
            deals.append({"name": deal_dir.name, "line": line_dir.name, "path": deal_dir})

    # AI batch matching: ask Gemini to match folder names to policy assured names
    deal_to_policy = await _ai_match_deals(deals, policies)

    # Scan files
    total_files = 0
    matched_files = 0
    unmatched_deals_set = set()

    for deal in deals:
        policy = deal_to_policy.get(deal["name"])

        for file_path in deal["path"].rglob("*"):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() in SKIP_EXTENSIONS:
                continue

            total_files += 1
            doc_type = _classify_doc(file_path.name)
            rel_path = str(file_path.relative_to(DATA_DIR))

            if policy:
                db.add(PolicyDocument(
                    policy_id=policy.id,
                    doc_type=doc_type,
                    file_name=file_path.name,
                    file_path=rel_path,
                ))
                matched_files += 1
            else:
                unmatched_deals_set.add(deal["name"])

    await db.commit()
    logger.info(f"Scanned {total_files} files, matched {matched_files}, unmatched deals: {len(unmatched_deals_set)}")

    return {
        "total_files": total_files,
        "matched_files": matched_files,
        "unmatched_files": total_files - matched_files,
        "unmatched_deals": list(unmatched_deals_set),
    }


async def _ai_match_deals(deals: list[dict], policies: list[Policy]) -> dict[str, Policy]:
    """Use Gemini to match Korean folder names to English policy assured names."""
    # Deduplicate assured names
    assured_map: dict[str, int] = {}
    for p in policies:
        if p.assured and p.assured not in assured_map:
            assured_map[p.assured] = p.id

    assured_list = "\n".join([f"  {pid}: {name}" for name, pid in list(assured_map.items())[:150]])
    deal_list = "\n".join([f"  - {d['name']} ({d['line']})" for d in deals])
    logger.info(f"Sending {len(assured_map)} assured names, {len(deals)} deals to Gemini")

    prompt = f"""당신은 재보험 전문가입니다. 아래 폴더명(한글/영어 혼합)을 보험계약 피보험자명과 매칭해주세요.

폴더명:
{deal_list}

피보험자 목록 (ID: 이름):
{assured_list}

예시 매칭:
- "삼성SDS 2025" → Samsung SDS CO., Ltd
- "대상 (메인)" → Daesang Corp.
- "현대 자동차 배서#25" → HYUNDAI MOTOR COMPANY
- "아성다이소" → 아성다이소 (직접 매칭)
- "천안 물류 PKG, GL" → Cheonan Logistics (비슷한 이름)

JSON 배열로 응답: [{{"folder": "폴더명", "policy_id": ID}}]
매칭 못하면 policy_id를 null로. JSON만 반환하세요."""

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-3.1-flash-lite")

    result_map: dict[str, Policy] = {}
    policy_by_id = {p.id: p for p in policies}

    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
        logger.info(f"Gemini raw response length: {len(raw)}")
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        parsed = json.loads(raw)
        # Build folder name → deal name mapping for fuzzy match
        deal_names = {d["name"] for d in deals}
        for item in parsed:
            folder = item.get("folder")
            pid = item.get("policy_id")
            if not folder or not pid or pid not in policy_by_id:
                continue
            # Exact match
            if folder in deal_names:
                result_map[folder] = policy_by_id[pid]
            else:
                # Try to find matching deal by substring
                for dn in deal_names:
                    if folder in dn or dn in folder or folder.replace(" ", "") == dn.replace(" ", ""):
                        result_map[dn] = policy_by_id[pid]
                        break
        logger.info(f"AI matched {len(result_map)}/{len(deals)} deal folders to policies")
    except Exception as e:
        logger.error(f"AI deal matching failed: {e}")
        import traceback
        logger.error(traceback.format_exc())

    return result_map


def _find_policy_for_deal(deal_name: str, line_name: str, policies: list[Policy], policy_index: dict) -> Policy | None:
    """Find the best matching policy for a deal folder name."""
    norm_deal = _normalize_for_match(deal_name)

    best_score = 0
    best_policy = None

    # Try exact substring match first
    for p in policies:
        if not p.assured:
            continue
        norm_assured = _normalize_for_match(p.assured)
        score = 0

        # Deal name contains assured or vice versa
        if norm_assured in norm_deal or norm_deal in norm_assured:
            score = 80
        else:
            # Token overlap
            deal_tokens = set(norm_deal.split())
            assured_tokens = set(norm_assured.split())
            if deal_tokens and assured_tokens:
                overlap = len(deal_tokens & assured_tokens)
                if overlap > 0:
                    score = min(overlap * 25, 70)

        # Line match bonus
        if p.line and line_name:
            p_line = p.line.lower()
            l_name = line_name.lower()
            if p_line in l_name or l_name in p_line or p_line[:3] == l_name[:3]:
                score += 10

        if score > best_score:
            best_score = score
            best_policy = p

    return best_policy if best_score >= 30 else None
