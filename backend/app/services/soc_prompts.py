"""Prompt strings for the SOC generator / stream pipelines.

Kept separate from router code so edits don't force you to scroll past
300 lines of FastAPI plumbing. Every prompt here is behavior-preserving
relative to the inlined version it replaced.
"""

from __future__ import annotations


# Simple single-file extractor (used by soc_generator._extract_from_file
# for .pdf / .msg single-shot extraction).
EXTRACT_SIMPLE = '''Extract reinsurance claim info. IMPORTANT:
- "account_name" = the INSURED (피보험자), NOT the reinsured/cedant
- "cedant" = original insurer code (KR, HW, SS, DB, HM, KB, MZ, HK)
- Include location_of_loss, nature_of_loss, particulars if found
Return JSON: {"account_name": "", "cedant": "", "line": "type of insurance (e.g. Commercial General Liability: Facultative Reinsurance)", "ref_no": "", "dol": "", "currency": "KRW", "total_amount": number, "description": "", "reinsured": "", "location_of_loss": "", "nature_of_loss": "nature/category in Korean if available (e.g. 일반배상책임(대물), 화재)", "particulars": "", "policy_period": ""}
Only JSON.'''


# Multi-file extraction used by /parse (non-streaming route). Single-claim
# shape; no bordereau multi-row logic.
EXTRACT_CLAIM = '''Analyze ALL uploaded files. These are reinsurance claim documents from a cedant sent to broker INS Corp.

Extract claim information. Return JSON:
{
  "account_name": "the INSURED (피보험자)",
  "reinsured": "the cedant/original insurer",
  "cedant_code": "2-letter code (KR=Korean Re, SS=Samsung Fire, HW=Hanwha, DB=DB, HM=Hyundai Marine, HK=Heungkuk, KB=KB, MZ=Meritz)",
  "line": "type of insurance (e.g. Commercial General Liability: Facultative Reinsurance)",
  "ref_no": "reference number",
  "dol": "date of loss (YYYY-MM-DD)",
  "currency": "KRW or USD",
  "total_amount_100": "total at 100% (number)",
  "location_of_loss": "location",
  "nature_of_loss": "nature/category of loss in Korean if available (e.g. 일반배상책임(대물), 화재) - empty if not found",
  "particulars": "what happened",
  "policy_period": "from ~ to",
  "description": "1 sentence Korean summary",
  "file_reinsurer_name": "reinsurer name shown in document (may be broker name like Ins Corp.)",
  "file_share": "share percentage as decimal (e.g. 0.05)",
  "file_amount": "reinsurer share amount (number)"
}
Only JSON.'''


# Full extraction with bordereau multi-row logic — used by /stream (SSE).
# Distinct from EXTRACT_CLAIM because the streaming UI surfaces multi-row
# bordereau claims (KB Settlement with multiple 접수번호 rows etc).
EXTRACT_CLAIM_BORDEREAU = '''Analyze ALL uploaded files. Extract claim info. Return JSON:
{"account_name": "the INSURED (피보험자) - the company that bought the insurance. PRESERVE masking exactly as written (e.g. '신****인' stays '신****인'). NEVER guess the unmasked form.", "claimant": "the CLAIMANT entity name as shown in a 'Claimant:' field on KB-style SOCs. Often the unmasked / canonical version of an asterisk-masked Assured (e.g. Assured='신****인' + Claimant='신한회계법인'). Empty string if no separate Claimant row.", "reinsured": "the FULL NAME of the cedant/original insurer company (e.g. Hanwha General Insurance Co.,Ltd, Samsung Fire & Marine Insurance, Korean Reinsurance Company) - NOT a code", "cedant_code": "2-letter code only (KR/SS/HW/DB/HM/HK/KB/MZ)", "policy_no": "the policy number as written on the source document, e.g. '2011-1636207'. Empty string if not visible.", "line": "type of insurance with line-of-business PREFIX preserved exactly as written in the source PDF (e.g. 'Property : Facultative Reinsurance', 'Commercial General Liability : Facultative Reinsurance', 'Casualty : Facultative Reinsurance'). Do NOT drop the prefix before the colon.", "ref_no": "claim reference number", "dol": "YYYY-MM-DD - the DATE OF LOSS (when the loss event occurred)", "doc_date": "YYYY-MM-DD - the DOCUMENT ISSUE/SEND DATE shown in the PDF header (often labeled 'Date:', appears next to From:/To:). Distinct from dol. Empty string if not visible.", "title_subline": "subtitle text shown on a SECOND LINE inside the document title box, in parentheses (e.g. '(2nd Revised)', '(Final)', '(Revised)', '(3rd Revised)'). Empty string if the title is a single line.", "currency": "KRW or USD", "total_amount_100": "number - the total claim at 100%", "expenses_reserve_100": "number - the 'Expenses Reserve' / '손해조사비예치금' amount shown as a separate column in the document Settlement/PLA table at 100%. Use 0 if no separate Expenses column exists.", "location_of_loss": "address string EXACTLY as written in the PDF, preserving Korean spacing (e.g. '울산광역시 남구 선암동' — keep the spaces between 시/구/동 segments; do NOT concatenate)", "nature_of_loss": "nature/category of loss in Korean if available (e.g. 일반배상책임(대물), 화재, 풍수재 etc.) - leave empty if not found", "particulars": "what happened — preserve original Korean spacing exactly as in the PDF", "policy_period": "from ~ to", "description": "1 sentence Korean summary", "file_reinsurer_name": "reinsurer name if shown in file", "file_share": 0.05, "file_amount": 0,
 "claims": [{"insured": "피보험자명", "policy_period": "2023-05-26 ~ 2024-05-25", "uy": "2022 or 2023", "facility": "KB/SS/HW/... (cedant code)", "dol": "YYYY-MM-DD", "doc": "YYYY-MM-DD date of claim", "currency": "KRW or USD", "claim_amount_100": 20000000, "expense_100": 1488700, "cedant": "KB/SS/HW/... (2-letter cedant code)", "cedant_ref_no": "2024-1105009358 001"}]}
IMPORTANT:
- "reinsured" must be the FULL company name of the **CEDANT** (the company that PROVIDED this document — i.e. the original insurer / data sender). NEVER the reinsurer being addressed. Example: a SOC sent BY KB Insurance to broker INS Corp → reinsured = "KB Insurance Co., Ltd." — NOT "Zurich Singapore" (Zurich is the To/recipient). Look for "From:" / sender / letterhead of the source document. NOT a 2-letter code.
- **KOREAN SPACING (매우 중요)**: For ALL Korean-language fields (location_of_loss, particulars, nature_of_loss, description), preserve the original whitespace EXACTLY as it appears in the source PDF. Do not collapse spaces between 광역시/시/구/군/동/면/리/공장/단지 etc. PDF text extraction sometimes flattens these — when in doubt, INSERT conventional spacing:
    * between administrative units (시 / 구 / 동 / 면 / 리)
    * between organisation name and qualifier (e.g. "대상 후포공장" not "대상후포공장")
    * between clauses joined by a verb (e.g. "강풍으로 인한 ... 파손" not "강풍으로인한...파손")
    * around 어미 like "～으로 인한", "～에 따른", "～가 발생함"
  Examples (FROM → TO):
    "대상후포공장//강풍으로인한ㄱㅈㄷ옥상함석지붕파손" → "대상 후포공장 // 강풍으로 인한 ㄱㅈㄷ 옥상 함석 지붕 파손"
    "울산광역시남구선암동" → "울산광역시 남구 선암동"
    "전북진안군부귀면황금리산113-1번지" → "전북 진안군 부귀면 황금리 산 113-1번지"
  This MATTERS because the slip is a legal document seen by reinsurers; concatenated Korean is unreadable.
- **TITLE SUBLINE**: Look at the document title box. If the box has TWO lines (main title on top, parenthesized qualifier below — e.g. "Preliminary Loss Advice" / "(2nd Revised)"), put the second line into title_subline INCLUDING the parentheses. If only one line, title_subline = "".
- **DOC_DATE vs DOL (매우 중요)**: doc_date is ONLY the date shown in the PDF LETTERHEAD next to the literal label "Date:" — typically appears in the upper-right under "From:". It is the day the document was sent. Do NOT use:
    * the date of loss / 사고일 / DOL (that goes into dol)
    * a notification or report date inside the body
    * a payment due date or claim filing date
    * any date inferred from elsewhere in the document
  If the letterhead has no "Date:" label, return "" — DO NOT guess or pull a date from the body.
  Format YYYY-MM-DD. dol is the date the actual loss occurred. They are DIFFERENT fields — never copy one into the other.
- **LINE PREFIX**: The PDF Type field is typically formatted "<Line of Business> : <Reinsurance Type>" (e.g. "Property : Facultative Reinsurance"). Preserve the full string with the colon and prefix; do not return only the right-hand side.
- **EXPENSES RESERVE**: If the Settlement/PLA table has a separate column labeled "Expenses Reserve" / "Expense (100%)" / "손해조사비예치금" with a non-zero number, populate expenses_reserve_100. If no such column exists OR the value is blank/zero, return 0.
- "claims" is an array. If the input is a bordereau-style SOC with multiple rows (e.g. KB Settlement of Claim with several 접수번호 / 배상청구일자 rows), extract EACH row as a separate claim. If single claim, return a single-element array. Treat indemnity vs. expense as separate rows when shown that way.
- claim_amount_100 = 원수보험금 (Paid Loss Indemnity+Others) at 100%. expense_100 = 원수손해조사비 (Paid Expense) at 100%. Use 0 when a row has no value for that column.
- **cedant_ref_no resolution**: First look for an explicit "Cedant's Ref No" / "Cedant Ref" / "Ref No" / "재보험사 Ref" column. If that is empty / missing, build it from the source file as "{Our Claim No} ({Order})" — i.e. the cedant's internal claim number followed by the order/sequence number in parentheses, separated by a single space. Examples: Our Claim No "20240220-51163-01" + Order "28" → "20240220-51163-01 (28)". Our Claim No "2024-1105009358" + Order "001" → "2024-1105009358 (001)". Do NOT leave cedant_ref_no empty if either field exists.
- **NEGATIVE VALUES (매우 중요)**: Korean SOC documents use " - " (dash + space before number) to indicate negative amounts (환수/조정/reversal). Examples: "- 5,000,000" = -5000000, "(5,000,000)" = -5000000, "△5,000,000" = -5000000. You MUST preserve the minus sign — return as a negative number. Dropping the sign will break the total.
- PDF text extraction often splits " - 5,000,000 " into two tokens: "-" and "5,000,000". In Korean SOC tables a "-" token IMMEDIATELY BEFORE a number token (not in an empty cell position) means that number is negative. Compare with neighboring rows: if row 1 has 7 value-tokens and row 2 has 9 value-tokens, the extra "-" tokens in row 2 are sign markers, not empty-cell placeholders.
- **VERIFICATION STEP (mandatory)**: After extracting all claims, compute sum of (claim_amount_100 + expense_100) across rows. Compare against the "Total" / "합계" row amount in the source document. If they DO NOT match, you have missed minus signs — flip signs on adjustment/reversal rows until the sum matches. **Do not return a result whose row-sum disagrees with the document's Total row.**
- Concrete example — KB Settlement of Claim (FEBRUARY 2026), (주)비코스마일투어, ref 2024-1105009358:
    Row 001: 원수보험금 20,000,000 / 원수손해조사비 1,488,700 → claim_amount_100=20000000, expense_100=1488700
    Row 002: 원수보험금_기타 "- 5,000,000" (REVERSAL) / 원수손해조사비 empty → claim_amount_100=**-5000000**, expense_100=0
    Document 원수 Total: 16,488,700 = 20,000,000 + 1,488,700 + (-5,000,000). Document 출재 Total: 4,946,610 = 6,000,000 + 446,610 + (-1,500,000). The negative is real, do not drop it.
- total_amount_100 must equal the sum of all claim_amount_100 + expense_100 across rows (respecting signs).
Only JSON.'''


# Used by soc_generator._ai_search_keywords to turn an insured's full name
# into a list of DB-search ILIKE tokens.
AI_SEARCH_KEYWORDS = (
    "다음 피보험자명을 DB에서 검색하기 위한 키워드를 생성하세요. "
    "DB에는 한국어/영어/혼합 표기가 섞여 있습니다. 각 키워드는 SQL ILIKE 부분 일치로 쓰입니다.\n"
    "피보험자명: {name}\n\n"
    "규칙:\n"
    "- 법인 접두사(의료법인/주식회사/㈜/(주)/CO.,LTD 등) 제외\n"
    "- 브랜드명·고유명사 위주로 3~6개\n"
    "- 한국어·영어 양쪽 모두 포함 (예: '현대유비스병원' → ['현대유비스병원', 'UVIS HOSPITAL', 'UVIS', '유비스'])\n"
    "- JSON 배열로만 반환"
)


# PDF-only reinsurer split extractor used by
# soc_generator._extract_reinsurers_from_file.
REINSURER_SPLITS_FROM_PDF = '''Extract reinsurer participation splits ONLY if this document contains a "Settlement" table with reinsurer names and share percentages.
If this is a loss advice or notification from a cedant (e.g. "PRELIMINARY LOSS ADVICE", original insurer notification), return empty array [].
Do NOT include brokers (INS Corp, INS, NS Corp, NS, DAEWOO INS, Daewoo Insurance, DWINS — all our own broker name; "NS" is an OCR variant of "INS", DAEWOO INS/DWINS is the legacy name) or cedants (Korean Re, Samsung Fire, Hanwha) as reinsurers.
Reinsurers are companies like QBE, ACE, Zurich, MSIG, Berkley, AWAC, etc.
Return JSON array: [{"name": "reinsurer name", "share": 0.05, "amount": number}]. Only JSON array.'''


# Reasoning prompt used by /parse (non-streaming). The stream route uses an
# abbreviated variant (REINSURER_REASONING_SHORT) that takes less whitespace
# on screen during SSE rendering.
REINSURER_REASONING_FULL = """당신은 재보험 정산 전문가입니다. 아래 증거를 바탕으로 이 클레임의 재보험사 배분을 결정하세요.
모든 thinking과 reasoning은 반드시 한국어로 작성하세요.

클레임 정보 (업로드 파일 기반):
- 피보험자: {insured_name}
- 종목: {line}
- Ref: {ref_no}
- 파일 내용: "{file_ri_name}" 지분 {file_share_pct:.1f}% 금액 {file_amount}
- 참고: "Ins Corp." / "INS Corp" / "INS" / "NS Corp" / "NS" / "DAEWOO INS" / "Daewoo Insurance" / "DWINS" = 우리(브로커) 이름이며, 재보험사가 아님 (OCR/전사 과정에서 I가 빠져 NS로 표기될 수 있음. DAEWOO INS / DWINS는 legacy 표기)

DB 증거:

과거 클레임 (동일 ref/계정):
{past_claims_block}

계약 (동일 피보험자):
{contracts_block}

JSON으로 반환:
{{
  "thinking": [
    "1단계: 파일에서 확인한 내용...",
    "2단계: 과거 클레임과 대조...",
    "3단계: 계약 확인...",
    "4단계: 결론"
  ],
  "reinsurers": [
    {{"name": "재보험사명", "share": 0.30, "amount": 1234, "source": "CLAIMS/POLICY/FILE", "reasoning": "한국어로 이유 설명"}}
  ]
}}

규칙:
- **중요**: 과거 클레임의 "재보험사(reinsurer)" 필드가 바로 배분 대상입니다. "원수사(cedant)"는 한국 원보험사(KB, SS, HW, KR, HM, DB, MZ, HK 등) — 재보험 배분 대상이 아님
- 과거 클레임에서 동일 ref의 "재보험사(reinsurer)" 값이 존재하면 → 그것을 그대로 사용 (source: CLAIMS). 원수사(cedant)와 혼동하지 마세요
- 파일에 재보험사명이 "Ins Corp." / "INS CORP" / "NS Corp" / "NS" / "DAEWOO INS" / "DWINS" / 원수사 이름(KB/SS/HW 등)으로 잘못 표시되면 → 무시하고 DB의 "재보험사(reinsurer)" 필드를 사용
- 파일에 정보가 없으면 → 계약 배분 사용 (source: POLICY)
- 각 재보험사에 대해 한국어로 이유를 설명
JSON만 반환."""


# Foreign-reinsurer slip language rule. SOC/PLA slips going to foreign
# reinsurers must be English-only — Korean characters anywhere in the rendered
# slip body (particulars, location, nature, remarks, line label) is a
# downstream compliance issue. Korean cedant/branches keep Korean text.
SLIP_FOREIGN_RULE = (
    "다음 SOC/PLA 슬립의 수신 재보험사는 외국 (non-Korean) entity 입니다. "
    "본문 텍스트(particulars, location_of_loss, nature_of_loss, remarks, line)는 "
    "**반드시 영어로만** 작성되어야 합니다. 한글 문자는 단 한 글자라도 들어가면 안 됩니다."
)


# Korean → English slip-text translator. Used per-SOC after extraction whenever
# the assigned reinsurer is foreign. Returns the same shape with English-only
# strings; never copies Korean back. We translate only the human-readable text
# fields — numeric fields, codes, currency, dates remain untouched.
SLIP_TRANSLATE_TO_ENGLISH = '''You are translating Korean reinsurance-claim text fields into ENGLISH for a SOC/PLA slip going to a FOREIGN reinsurer.

RULE: The output must contain ZERO Korean characters. Translate proper nouns to their commonly-used English form (e.g. 울산광역시 남구 → "Nam-gu, Ulsan", 일반배상책임 → "Commercial General Liability", 화재 → "Fire"). Preserve numbers, dates, currency codes, and reference numbers exactly as-is.

For `account_name` (the Insured company): if the input is already English or bilingual, return only the English part. If the input is Korean-only and you are not certain of the company's official English name, return an empty string "" — do NOT invent or guess a romanization, the system will fall back to other sources.

Input fields (Korean or mixed):
- account_name: {account_name}
- line: {line}
- location_of_loss: {location_of_loss}
- nature_of_loss: {nature_of_loss}
- particulars: {particulars}
- remarks: {remarks}
- description: {description}

Return JSON only:
{{
  "account_name": "<official English company name, or empty string if unknown>",
  "line": "<English>",
  "location_of_loss": "<English>",
  "nature_of_loss": "<English>",
  "particulars": "<English, full sentence(s) describing what happened>",
  "remarks": "<English>",
  "description": "<English, one-sentence summary mirroring the Korean description>"
}}
If a field is empty or "-", return it unchanged. Only JSON.'''


REINSURER_REASONING_SHORT = """당신은 재보험 정산 전문가입니다. 아래 증거를 바탕으로 재보험사 배분을 결정하세요.
모든 thinking과 reasoning은 반드시 한국어로 작성하세요.

클레임 정보: {insured_name}, 종목: {line}, Ref: {ref_no}
파일 내용: "{file_ri_name}" 지분 {file_share_pct:.1f}% 금액 {file_amount}
참고: "Ins Corp." / "INS Corp" / "INS" / "NS Corp" / "NS" / "DAEWOO INS" / "Daewoo Insurance" / "DWINS" = 우리(브로커) 이름이며, 재보험사가 아님. (OCR/전사 과정에서 I가 빠져 "NS"로 표기될 수 있음. DAEWOO INS / DWINS는 legacy 표기)

과거 클레임:
{past_claims_block}

계약:
{contracts_block}

JSON으로 반환:
{{"thinking": ["1단계: 파일에서 확인한 내용...", "2단계: 과거 클레임과 대조...", "3단계: 계약 확인...", "4단계: 결론"],
  "reinsurers": [{{"name": "재보험사명", "share": 0.30, "amount": 1234, "source": "CLAIMS/POLICY/FILE", "reasoning": "한국어로 이유 설명"}}]}}
JSON만 반환."""
