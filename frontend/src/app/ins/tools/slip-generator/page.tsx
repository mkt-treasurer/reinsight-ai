"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import SlipDocument, {
  SlipType,
  BordereauClaim,
  BordereauColumn,
  DEFAULT_BORDEREAU_COLUMNS,
} from "@/components/SlipDocument";
import RecentUpdatesBanner from "@/components/RecentUpdatesBanner";
import EmailComposeModal from "@/components/EmailComposeModal";
import { buildSlipEmailDraft } from "@/lib/slipEmail";
import { extractEmails } from "@/lib/emailRecipients";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

// Human-readable document names for the delivery-email subject/body.
const SOC_DOC_LABEL: Record<SlipType, string> = {
  SOC: "Statement of Claims",
  PLA: "Payment / Loss Advice",
  "Bordereau SOC": "Bordereau Statement of Claims",
  "Bordereau PLA": "Bordereau Payment Advice",
};

const SOC_DOC_LABEL_KO: Record<SlipType, string> = {
  SOC: "클레임 명세서",
  PLA: "보험금 지급 통지서",
  "Bordereau SOC": "보더로 클레임 명세서",
  "Bordereau PLA": "보더로 보험금 지급 통지서",
};

// Claims-track broker identity, mirrored from the slip signature block.
const SOC_BROKER = {
  name: "INS Corp.",
  signerName: "S. H. Lee",
  signerTitle: "REINSURANCE / MANAGING DIRECTOR (TEAM LEADER)",
  contact: "TEL: +82-2-2088-2727 | FAX: +82-2-2088-2740 | claim@dwins.co.kr",
};

// Recommended Reply-To for outgoing claims mail — the broker claims mailbox
// printed on the SOC slip. Editable per-email in the compose modal.
const SOC_REPLY_TO = "claim@dwins.co.kr";

interface CodeTableReinsurer {
  no: number | null;
  name: string;
  code: string;
  is_foreign: boolean;
}
interface CodeTableLine {
  no: number;
  name_kr: string;
  code: string;
  category: string;
}
interface CodeTable {
  lines: CodeTableLine[];
  insurers: { no: number | null; name: string; code: string }[];
  reinsurers: CodeTableReinsurer[];
  currencies: string[];
}

function useCodeTable(): CodeTable | null {
  const [table, setTable] = useState<CodeTable | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/tools/code-table`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setTable(data as CodeTable);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return table;
}

function lookupReinsurer(table: CodeTable | null, query: string): CodeTableReinsurer | null {
  if (!table || !query) return null;
  const q = query.trim().toLowerCase();
  for (const r of table.reinsurers) {
    if (r.code.toLowerCase() === q || r.name.toLowerCase() === q) return r;
  }
  for (const r of table.reinsurers) {
    if (r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)) return r;
  }
  return null;
}

/** Mirror of backend is_foreign_reinsurer for client-side updates after the
 *  user edits a reinsurer name (the backend tag is set at generation time;
 *  manual edits need to recompute locally). */
function isForeignReinsurerClient(
  table: CodeTable | null,
  nameOrCode: string
): boolean {
  if (!nameOrCode) return false;
  const r = lookupReinsurer(table, nameOrCode);
  if (r) return r.is_foreign;
  if (HANGUL_RE.test(nameOrCode)) return false;
  const s = nameOrCode.toLowerCase();
  if (/\bkorea(n)?\b/.test(s) || /\bseoul\b/.test(s)) return false;
  if (s.endsWith(" kr") || s.endsWith(" korea")) return false;
  return true;
}

function fmt(val: number): string {
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

// Currency-aware amount formatter. KRW renders without decimals (Korean
// won has no fractional unit); every other ISO currency renders with two
// decimal places so USD/EUR/JPY/etc. amounts don't quietly round. Negative
// values are wrapped in parentheses to match the accounting convention
// already used by the slip Settlement table.
function fmtAmt(val: number, currency?: string | null): string {
  const ccy = (currency || "KRW").toString().toUpperCase();
  const decimals = ccy === "KRW" ? 0 : 2;
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return val < 0 ? `(${formatted})` : formatted;
}

function sanitizeFilenamePart(s: string): string {
  // Strip path-unfriendly chars AND collapse runs of internal whitespace
  // (e.g. "Property  Facultative" with double-space from a colon-stripping
  // step) so the resulting filename is tight and predictable.
  return s
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Strip common Korean/English corporate suffixes from an insured name so the
// slip shows the brand only ("Taekwang Industrial Co.,Ltd." → "Taekwang
// Industrial"). Conservative — only removes well-known suffixes, leaves the
// rest of the string untouched. Trailing punctuation/whitespace is trimmed.
/** Build the default body-field row list for a slip given the extracted
 *  data plus this slip's foreign-language flag. Preserves the historical
 *  8-row layout the GT slips use, with "Nature of Loss" only when the
 *  AI extracted one. The returned array is what the user starts editing. */
function buildDefaultBodyFields(
  ext: Record<string, unknown> | undefined,
  wantEn: boolean,
  policyMatch: { cover_note_no: string } | null,
  cedantFullName?: string,
): { id: string; label: string; value: string; kind?: "text" | "textarea" }[] {
  const e = ext as Record<string, unknown> | undefined;
  const reinsured = String(cedantFullName || e?.reinsured || e?.cedant || "N/A");
  const insured = stripCorpSuffix(
    pickSlipText(e, wantEn, "account_name") || String(e?.account_name || "")
  );
  const claimType =
    pickSlipText(e, wantEn, "line") || String(e?.line || "N/A");
  const policyPeriod = formatDateEn(
    String(
      e?.policy_period ||
        (policyMatch ? `Refer to ${policyMatch.cover_note_no}` : "N/A")
    )
  );
  const dol = formatDateEn(String(e?.dol || "TBD"));
  const locationOfLoss =
    pickSlipText(e, wantEn, "location_of_loss") || "-";
  const natureOfLoss = pickSlipText(e, wantEn, "nature_of_loss") || "";
  const particulars = pickSlipText(e, wantEn, "particulars") || "-";
  const remarks = pickSlipText(e, wantEn, "remarks") || "-";

  const rows: { id: string; label: string; value: string; kind?: "text" | "textarea" }[] = [
    { id: "reinsured", label: "Reinsured", value: reinsured },
    { id: "insured", label: "Insured", value: insured },
    { id: "claimType", label: "Type", value: claimType },
    { id: "policyPeriod", label: "Policy Period", value: policyPeriod },
    { id: "dol", label: "Date of Loss", value: dol },
    { id: "locationOfLoss", label: "Location of Loss", value: locationOfLoss },
  ];
  if (natureOfLoss) {
    rows.push({ id: "natureOfLoss", label: "Nature of Loss", value: natureOfLoss });
  }
  rows.push({ id: "particulars", label: "Particulars of Loss", value: particulars, kind: "textarea" });
  rows.push({ id: "remarks", label: "Remarks", value: remarks, kind: "textarea" });
  return rows;
}

function stripCorpSuffix(name: string | undefined | null): string {
  if (!name) return "";
  let out = String(name);
  const suffixes = [
    /\s*Co\.?,?\s*Ltd\.?$/i,
    /\s*Corp(?:oration)?\.?$/i,
    /\s*Inc\.?$/i,
    /\s*Ltd\.?$/i,
    /\s*LLC\.?$/i,
    /\s*PTE\s*LTD\.?$/i,
    /\s*\(?주\)?$/, // 한글 (주) / 주식회사
    /\s*주식회사$/,
    /^주식회사\s*/,
    /^\(주\)\s*/,
  ];
  let prev = "";
  while (prev !== out) {
    prev = out;
    for (const re of suffixes) out = out.replace(re, "").trim();
  }
  return out.replace(/[,\s]+$/, "").trim();
}

function parseYear(s: string | undefined | null): string {
  if (!s) return "";
  const m = String(s).match(/(19|20)\d{2}/);
  return m ? m[0] : "";
}

// ISO date (YYYY-MM-DD) for "today" in the user's local time zone. Used as
// the default for the slip-header Date field, which now represents the
// slip generation date (when the operator opened/regenerated the slip)
// distinct from DOC (the document issue date extracted from the source
// PDF letterhead).
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Keys whose English translation (extracted.text_en[key]) we expose via
// the KR/EN toggle on the Claim Detail card. Mirrors the TextEn shape in
// SlipDocument; kept as a runtime list because we iterate it generically.
// `description` is included here even though the slip body never renders
// it — the customer's KR/EN viewer covers all uploaded-file text and
// description is the AI's one-line Korean summary.
const TEXT_EN_KEYS = [
  "account_name",
  "line",
  "location_of_loss",
  "nature_of_loss",
  "particulars",
  "remarks",
  "description",
] as const;

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Replace every ISO-style date occurrence (YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD)
// with "Month D, YYYY". Range strings like "2024-09-22 ~ 2025-09-22" or
// "2024-09-22 to 2025-09-22" pass through naturally because each side is
// rewritten in place and the separator is preserved. Non-date inputs
// ("Refer to CF250156", "TBD", "N/A") are returned unchanged.
function formatDateEn(input: string | undefined | null): string {
  if (!input) return "";
  return String(input).replace(
    /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g,
    (full, y: string, m: string, d: string) => {
      const month = MONTHS_EN[parseInt(m, 10) - 1];
      if (!month) return full;
      return `${month} ${parseInt(d, 10)}, ${y}`;
    }
  );
}

function parseDolIso(dol: string | undefined | null): string {
  if (!dol) return "";
  const str = String(dol);
  const iso = str.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  };
  const en = str.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (en) {
    const m = months[en[1].toLowerCase()];
    if (m) return `${en[3]}-${m}-${en[2].padStart(2, "0")}`;
  }
  return "";
}

function buildSlipFilename(
  type: SlipType,
  ext: Record<string, unknown> | undefined,
  reinsurer: string
): string {
  const assured = sanitizeFilenamePart(String(ext?.account_name || "untitled"));
  const line = sanitizeFilenamePart(String(ext?.line || ""));
  const dolIso = parseDolIso(ext?.dol as string | undefined);
  const uy =
    parseYear(ext?.policy_period as string | undefined) ||
    (dolIso ? dolIso.slice(0, 4) : "");
  const refNo = sanitizeFilenamePart(String(ext?.ref_no || ""));
  const ri = sanitizeFilenamePart(reinsurer) || "Unknown";
  const isBordereau = type === "Bordereau SOC" || type === "Bordereau PLA";
  // Filename uses an underscore-joined prefix so spaces in "Bordereau SOC"
  // don't bleed into the filename.
  const prefix = isBordereau ? type.replace(" ", "_") : type;
  const assuredPart = isBordereau && !ext?.account_name ? "Multi" : assured;
  const parts = [
    `${prefix}_${assuredPart}`,
    line ? `_${line}` : "",
    uy ? `_UY${uy}` : "",
    dolIso ? `(DOL ${dolIso})` : "",
    refNo && !isBordereau ? `_${refNo}` : "",
    ` (${ri})`,
    ".pdf",
  ];
  return parts.join("");
}

interface Soc {
  reinsurer: string;
  share: number;
  share_pct: string;
  amount: number;
  amount_fmt: string;
  cedant: string;
  confidence?: string;
  reasoning?: string;
  claims?: BordereauClaim[];
  /** Backend-tagged: true when the reinsurer is a foreign (non-Korean)
   *  entity. Drives the slip language rule — foreign slips render the
   *  English-translated text from extracted.text_en. */
  is_foreign?: boolean;
  /** Canonical insurer (cedant) full name resolved from CODE_관리.xlsx.
   *  Populated by the multi-cedant fanout so each per-cedant slip can
   *  show a different Reinsured. Falls back to ext.reinsured otherwise. */
  cedant_full_name?: string;
  /** Per-slip body table override. When set, replaces the auto-derived
   *  Reinsured / Insured / Type / Policy Period / DOL / Location of
   *  Loss / Particulars / Remarks rows with whatever the user
   *  configured (label, value, kind, order). Insurer-specific labels
   *  like "Nature of Loss" or arbitrary new rows live here. */
  body_fields?: { id: string; label: string; value: string; kind?: "text" | "textarea" }[];
  /** Optional per-slip currency override. Set by the multi-currency
   *  fan-out so each per-currency variant carries its own ISO code
   *  (e.g. one slip for USD, another for KRW from the same claim
   *  packet). When unset, callers fall back to the case-level
   *  ``extracted.currency`` for backwards compatibility. */
  currency?: string;
  /** Optional subset of bordereau claims belonging to this slip.
   *  Populated by the multi-currency split so each per-currency slip
   *  only carries claims in its own ISO code. When unset, callers fall
   *  back to ``extracted.claims`` (the full unsplit list). */
  claims_subset?: BordereauClaim[];
}

interface TextEn {
  account_name?: string;
  line?: string;
  location_of_loss?: string;
  nature_of_loss?: string;
  particulars?: string;
  remarks?: string;
}

const HANGUL_RE = /[㄰-㆏가-힯]/;

function containsKorean(s: unknown): boolean {
  return typeof s === "string" && HANGUL_RE.test(s);
}

/** Pick Korean original or English translation based on the operator's
 *  language choice. `wantEn` is driven by the Claim Detail KR/EN toggle
 *  (which defaults to "en" when any SOC is foreign). Falls back to
 *  Korean if translation is missing for that field — caller should also
 *  surface a warning so the operator knows to re-run translation. */
function pickSlipText(
  ext: Record<string, unknown> | undefined,
  wantEn: boolean,
  field: "account_name" | "line" | "location_of_loss" | "nature_of_loss" | "particulars" | "remarks"
): string {
  if (!ext) return "";
  const en = (ext.text_en as TextEn | undefined) || undefined;
  const enVal = en?.[field];
  const koVal = ext[field] as string | undefined;
  if (wantEn && enVal && enVal.trim()) return String(enVal);
  return String(koVal || "");
}
interface PastClaim {
  id: number;
  ref_no: string;
  account_name: string;
  cedant: string | null;
  reinsurer: string | null;
  share: number;
  krw_amount: number;
  dol?: string | null;
  line?: string | null;
  nature_of_loss?: string | null;
  usd_amount?: number | null;
  used?: boolean;
}
interface ContractRow {
  id: number;
  cover_note_no: string;
  assured: string;
  cedant: string | null;
  reinsurer: string | null;
  share: number;
  line: string | null;
  year: number;
  period_from?: string | null;
  period_to?: string | null;
  currency?: string | null;
  gross_prem_100?: number | null;
  ri_prem?: number | null;
  workflow_status?: string | null;
  used?: boolean;
}
interface MultiCedantGroupReinsurer {
  name: string;
  count: number;
  avg_share: number;
  sum_amt: number;
}
interface MultiCedantGroup {
  cedant: string;
  count: number;
  total_krw: number;
  reinsurers: MultiCedantGroupReinsurer[];
}
interface MultiCedant {
  active: boolean;
  cedants: string[];
  groups: MultiCedantGroup[];
}
interface Evidence {
  file_reinsurer?: { name: string; share: number; amount: number };
  past_claims?: { search_method: string; rows: PastClaim[] };
  contracts?: { search_method: string; rows: ContractRow[] };
  policy_match?: {
    id: number;
    cover_note_no: string;
    assured: string;
    score: number;
  } | null;
  multi_cedant?: MultiCedant | null;
}
interface Result {
  source?: string;
  extracted: Record<string, unknown>;
  policy: {
    id: number;
    cover_note_no: string;
    assured: string;
    score: number;
  } | null;
  socs: Soc[];
  thinking?: string[];
  evidence?: Evidence;
  error?: string;
}

// Fan a single-reinsurer SOC list out into per-currency variants when
// the case carries multiple ISO codes. Detection looks at (a) distinct
// currencies on the bordereau claims (most reliable signal) and falls
// back to extracted.currencies when the case is non-bordereau. The
// expansion is a one-shot transform — once each soc has its own
// ``currency`` set, the helper short-circuits so subsequent edits
// don't double-split.
function splitSocsByCurrency(input: Result): Result {
  const ext = input.extracted || {};
  const caseCcy = String((ext as Record<string, unknown>).currency || "KRW").toUpperCase();
  const claims = ((ext as Record<string, unknown>).claims as BordereauClaim[] | undefined) || [];
  // Source-of-truth for "what currencies appear in this case". Bordereau
  // packets get per-row ccy; SOC/PLA cases can declare ext.currencies as
  // a fallback list when the backend extracts multi-ccy at case level.
  const fromClaims = Array.from(
    new Set(claims.map((c) => String(c.currency || caseCcy).toUpperCase()))
  );
  const fromCase = Array.isArray((ext as Record<string, unknown>).currencies)
    ? ((ext as Record<string, unknown>).currencies as string[]).map((c) => String(c).toUpperCase())
    : [];
  const ccys = (fromClaims.length > 1 ? fromClaims : fromCase).filter((c) => !!c);
  if (ccys.length <= 1) return input;
  // Already split — every soc carries its own ccy override.
  if (input.socs.every((s) => typeof s.currency === "string" && s.currency.length > 0)) {
    return input;
  }
  const splitSocs: Soc[] = [];
  for (const soc of input.socs) {
    for (const ccy of ccys) {
      const subset = claims.filter(
        (c) => String(c.currency || caseCcy).toUpperCase() === ccy
      );
      let amount = 0;
      if (subset.length > 0) {
        const total = subset.reduce(
          (a, c) => a + (Number(c.claim_amount_100) || 0) + (Number(c.expense_100) || 0),
          0
        );
        amount = total * soc.share;
      } else {
        // SOC/PLA fallback — no claim items. Currency-level total may be
        // declared on extracted.total_by_currency. Defaults to 0; the
        // operator can fill it in via the inline amount editor.
        const byCcy = (ext as Record<string, unknown>).total_by_currency as
          | Record<string, number>
          | undefined;
        const ccyTotal = byCcy && typeof byCcy[ccy] === "number" ? byCcy[ccy] : 0;
        amount = ccyTotal * soc.share;
      }
      splitSocs.push({
        ...soc,
        currency: ccy,
        claims_subset: subset.length > 0 ? subset.map((c) => ({ ...c })) : undefined,
        claims: subset.length > 0 ? subset.map((c) => ({ ...c })) : soc.claims,
        amount,
        amount_fmt: `${ccy} ${fmtAmt(amount, ccy)}`,
      });
    }
  }
  return { ...input, socs: splitSocs };
}

function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
  emphasis = "default",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** "primary" prepends a 4px black accent bar to signal the section is
   *  the operator's main focus (Slip Documents, References). "default"
   *  is the standard stacked card with no accent. */
  emphasis?: "default" | "primary";
}) {
  const isPrimary = emphasis === "primary";
  return (
    <div
      className={`border border-slate-200 bg-white ${className} ${
        isPrimary ? "shadow-[0_1px_0_rgba(15,23,42,0.04)]" : ""
      }`}
    >
      <div className="border-b border-slate-200 bg-slate-50 flex items-stretch">
        <span
          className={`shrink-0 ${
            isPrimary ? "w-[3px] bg-slate-900" : "w-[3px] bg-slate-200"
          }`}
          aria-hidden
        />
        <div className="flex-1 px-4 py-2.5 flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-800 whitespace-nowrap">
              {title}
            </span>
            {subtitle && (
              <span className="text-[10px] text-slate-400 truncate">
                {subtitle}
              </span>
            )}
          </div>
          {right}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function SocGeneratorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [fileUrls, setFileUrls] = useState<Map<number, string>>(new Map());
  const [pasteText, setPasteText] = useState("");
  const [previewFileIdx, setPreviewFileIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [steps, setSteps] = useState<{ phase: string; message: string }[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [docType, setDocType] = useState<SlipType>("SOC");
  const codeTable = useCodeTable();
  const [draftExt, setDraftExt] = useState<Record<string, unknown> | null>(null);
  const [refExpandedFile, setRefExpandedFile] = useState<number | null>(null);
  // Index of the SOC whose body-row editor is open. null = closed.
  const [rowEditorIdx, setRowEditorIdx] = useState<number | null>(null);
  // SOC index currently being composed into a delivery email (.eml), or null.
  const [emailIdx, setEmailIdx] = useState<number | null>(null);
  // KR/EN toggle for the Claim Detail card AND the slip preview. EN
  // mode displays extracted.text_en values across all translatable
  // fields and renders every slip in English regardless of each SOC's
  // is_foreign flag. KR mode forces Korean everywhere. The default is
  // derived from data: if any SOC is foreign, EN is the natural
  // starting language (backend already produced text_en in-stream).
  const [displayLang, setDisplayLang] = useState<"kr" | "en">("kr");
  // Track whether we've auto-initialized displayLang for the current
  // result. Without this guard, applyDraft (which mutates result)
  // would yank the toggle back to its default mid-session.
  const langInitialized = useRef(false);
  // On-demand translation status. The stream pipeline only produces
  // text_en when at least one SOC is foreign; for domestic-only cases
  // we lazy-translate here when the user first switches to EN.
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Auto-select EN on first load when at least one SOC is foreign —
  // the backend already produced text_en for these cases, so the slip
  // and Claim Detail open in English by default (matching the prior
  // per-SOC is_foreign behavior). Domestic-only cases stay in KR.
  // Guarded by langInitialized.current so applyDraft / SOC mutations
  // don't reset the user's explicit choice mid-session.
  useEffect(() => {
    if (!result?.socs?.length) {
      langInitialized.current = false;
      return;
    }
    if (langInitialized.current) return;
    const anyForeign = result.socs.some((s) => s.is_foreign);
    if (anyForeign) setDisplayLang("en");
    langInitialized.current = true;
  }, [result?.socs]);

  const switchLang = async (lang: "kr" | "en") => {
    setTranslateError(null);
    setDisplayLang(lang);
    if (lang !== "en" || !result?.extracted) return;
    const existing = result.extracted.text_en as
      | Record<string, string>
      | undefined;
    const hasAny =
      existing &&
      TEXT_EN_KEYS.some((k) => {
        const v = existing[k];
        return typeof v === "string" && v.trim() !== "";
      });
    if (hasAny) return;
    setTranslating(true);
    try {
      const e = result.extracted;
      const resp = await fetch(`${API_URL}/api/tools/soc/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_name: e.account_name || "",
          line: e.line || "",
          location_of_loss: e.location_of_loss || "",
          nature_of_loss: e.nature_of_loss || "",
          particulars: e.particulars || "",
          remarks: e.remarks || "",
          description: e.description || "",
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as Record<string, string>;
      setResult((prev) =>
        prev
          ? {
              ...prev,
              extracted: {
                ...prev.extracted,
                // Merge: any pre-existing text_en entries win over the
                // fresh translation (e.g. DB-resolved English company
                // name from the stream pipeline beats LLM output).
                text_en: { ...data, ...((prev.extracted.text_en as object) || {}) },
              },
            }
          : prev
      );
    } catch (err) {
      setTranslateError(
        err instanceof Error ? err.message : "translation failed"
      );
    } finally {
      setTranslating(false);
    }
  };

  // Bordereau column layout. ``null`` ⇒ use the SlipDocument defaults
  // (15 legacy cols + Incident ID / Seq turned off). Customers turn
  // the incident columns on here for KB-style ``001/002/003`` runs;
  // they can also add static-text columns ("Notes", internal codes,
  // etc.). The same array drives both the in-page editor and the
  // rendered SlipDocument so the operator sees WYSIWYG.
  const [columnsConfig, setColumnsConfig] = useState<BordereauColumn[] | null>(
    null
  );
  const [colMgrOpen, setColMgrOpen] = useState(false);
  const effectiveColumns: BordereauColumn[] =
    columnsConfig ?? [...DEFAULT_BORDEREAU_COLUMNS];
  const [hover, setHover] = useState<{
    kind: "claim" | "contract";
    anchorRect: DOMRect;
    data: PastClaim | ContractRow;
    ext: Record<string, unknown>;
    fileReinsurer?: { name: string; share: number; amount: number };
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleNewSlip = () => {
    fileUrls.forEach((url) => URL.revokeObjectURL(url));
    setFiles([]);
    setFileUrls(new Map());
    setPasteText("");
    setPreviewFileIdx(null);
    setLoading(false);
    setResult(null);
    setPreviewIdx(null);
    setSteps([]);
    setThinkingSteps([]);
    setUploadPct(null);
    setDocType("SOC");
    setDraftExt(null);
    setHover(null);
    setRefExpandedFile(null);
    setRowEditorIdx(null);
    if (fileRef.current) fileRef.current.value = "";
    router.push("/ins/tools/slip-generator");
  };

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => {
      const updated = [...prev, ...arr];
      const newUrls = new Map(fileUrls);
      arr.forEach((f, i) => {
        newUrls.set(prev.length + i, URL.createObjectURL(f));
      });
      setFileUrls(newUrls);
      return updated;
    });
  };

  const removeFile = (idx: number) => {
    const url = fileUrls.get(idx);
    if (url) URL.revokeObjectURL(url);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviewFileIdx(null);
  };

  const runStreamAttempt = (): Promise<{
    ok: boolean;
    receivedAny: boolean;
    err?: string;
  }> =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/tools/soc/stream`);
      xhr.responseType = "text";

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          setUploadPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.upload.onload = () => setUploadPct(100);

      let lastIdx = 0;
      let buffer = "";
      let receivedAny = false;

      xhr.onprogress = () => {
        receivedAny = true;
        const chunk = xhr.responseText.slice(lastIdx);
        lastIdx = xhr.responseText.length;
        buffer += chunk;

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (!block.trim()) continue;

          let currentEvent = "";
          let dataRaw = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: "))
              currentEvent = line.slice(7).trim();
            else if (line.startsWith("data: "))
              dataRaw = dataRaw
                ? `${dataRaw}\n${line.slice(6)}`
                : line.slice(6);
          }
          if (!currentEvent || !dataRaw) continue;
          try {
            const data = JSON.parse(dataRaw);
            if (currentEvent === "case") {
              if (data?.id) {
                window.history.replaceState(
                  null,
                  "",
                  `/ins/tools/slip-generator/${data.id}`
                );
              }
            } else if (currentEvent === "step")
              setSteps((prev) => [...prev, data]);
            else if (currentEvent === "thinking")
              setThinkingSteps((prev) => [...prev, data.content]);
            else if (currentEvent === "result")
              setResult(splitSocsByCurrency(data as Result));
            else if (currentEvent === "error")
              setSteps((prev) => [
                ...prev,
                { phase: "error", message: data.message },
              ]);
          } catch {
            /* skip */
          }
        }
      };

      xhr.onload = () =>
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, receivedAny });
      xhr.onerror = () =>
        resolve({ ok: false, receivedAny, err: "network error" });
      xhr.ontimeout = () =>
        resolve({ ok: false, receivedAny, err: "timeout" });
      xhr.onabort = () => resolve({ ok: false, receivedAny, err: "aborted" });

      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      if (pasteText.trim()) fd.append("text", pasteText);
      xhr.send(fd);
    });

  const handleGenerate = async () => {
    if (!files.length && !pasteText.trim()) return;
    setLoading(true);
    setSteps([]);
    setThinkingSteps([]);
    setResult(null);
    setUploadPct(0);

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        const delayMs = 2000 * (attempt - 1);
        setSteps((prev) => [
          ...prev,
          {
            phase: "retry",
            message: `네트워크 재시도 ${attempt - 1}/${MAX_ATTEMPTS - 1} (${
              delayMs / 1000
            }초 후)`,
          },
        ]);
        await new Promise((r) => setTimeout(r, delayMs));
        setUploadPct(0);
      }

      const { ok, receivedAny, err } = await runStreamAttempt();
      if (ok) break;

      if (receivedAny) {
        setSteps((prev) => [
          ...prev,
          {
            phase: "error",
            message: `응답 수신 도중 연결이 끊어졌습니다 (${
              err || "unknown"
            }). 새로고침 후 다시 시도해 주세요.`,
          },
        ]);
        break;
      }
      if (attempt === MAX_ATTEMPTS) {
        setSteps((prev) => [
          ...prev,
          {
            phase: "error",
            message: `네트워크 연결 실패 (${
              err || "unknown"
            }). 인터넷 연결 또는 파일 크기를 확인해 주세요.`,
          },
        ]);
      }
    }

    setLoading(false);
    setUploadPct(null);
  };

  // Render one SOC slip into a jsPDF document and return it with its filename.
  // Shared by the direct PDF download and the email-compose flow (which needs
  // the bytes to attach). Returns null when the slip element is missing.
  const renderSocPdf = async (
    idx: number
  ): Promise<{ pdf: import("jspdf").jsPDF; filename: string } | null> => {
    const el = document.getElementById(`soc-slip-${idx}`);
    if (!el) return null;
    // The slip is always mounted, but its wrapper carries `hidden`
    // (display:none) when the preview panel isn't open. A display:none
    // ancestor leaves the slip unrendered, so html2canvas would capture a
    // 0x0 canvas and toDataURL would emit "data:," — which jsPDF rejects
    // as "wrong PNG signature". Reveal the wrapper offscreen for capture.
    const hiddenAncestor = el.closest<HTMLElement>(".hidden");
    const restoreHidden = hiddenAncestor
      ? (() => {
          const prev = {
            position: hiddenAncestor.style.position,
            left: hiddenAncestor.style.left,
            top: hiddenAncestor.style.top,
            pointerEvents: hiddenAncestor.style.pointerEvents,
          };
          hiddenAncestor.classList.remove("hidden");
          hiddenAncestor.style.position = "absolute";
          hiddenAncestor.style.left = "-99999px";
          hiddenAncestor.style.top = "-99999px";
          hiddenAncestor.style.pointerEvents = "none";
          return () => {
            hiddenAncestor.classList.add("hidden");
            hiddenAncestor.style.position = prev.position;
            hiddenAncestor.style.left = prev.left;
            hiddenAncestor.style.top = prev.top;
            hiddenAncestor.style.pointerEvents = prev.pointerEvents;
          };
        })()
      : null;
    el.style.display = "block";
    // Wait one frame so the just-unhidden element is laid out before capture.
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const pdf = new jsPDF("p", "mm", "a4");
      // A4 = 210 × 297 mm. Reserve a 10 mm margin top/bottom and 10 mm
      // left/right. Letterbox-fit the canvas: scale to whichever axis
      // saturates first so a tall slip never overflows the bottom edge.
      const pageW = 210,
        pageH = 297,
        margin = 10;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const ratio = canvas.width / canvas.height;
      let w = maxW,
        h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      const x = (pageW - w) / 2;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, margin, w, h);
      const soc = result!.socs[idx];
      return { pdf, filename: buildSlipFilename(docType, result!.extracted, soc.reinsurer) };
    } finally {
      el.style.display = "";
      restoreHidden?.();
    }
  };

  const downloadPdf = async (idx: number) => {
    const r = await renderSocPdf(idx);
    if (r) r.pdf.save(r.filename);
  };

  const downloadAll = async () => {
    for (let i = 0; i < (result?.socs.length || 0); i++) {
      await downloadPdf(i);
    }
  };

  const ext = result?.extracted;

  function parseAmount(v: string): number {
    const n = Number(String(v).replace(/[,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  const handleSlipFieldChange = (
    idx: number,
    field: import("@/components/SlipDocument").SlipField,
    value: string
  ) => {
    if (!result) return;

    // Per-slip fields: reinsurer, yourAmount, yourShare
    if (field === "toReinsurer") {
      const socs = [...result.socs];
      socs[idx] = { ...socs[idx], reinsurer: value };
      setResult({ ...result, socs });
      return;
    }
    if (field === "yourAmount") {
      const amount = parseAmount(value);
      // Honour the slip's own currency override before falling back to
      // the case-level extracted currency — multi-currency packets pin
      // each slip to its own ISO code via Soc.currency.
      const ccy = String(
        result.socs[idx]?.currency || result.extracted?.currency || "KRW"
      );
      const socs = [...result.socs];
      socs[idx] = { ...socs[idx], amount, amount_fmt: `${ccy} ${fmtAmt(amount, ccy)}` };
      setResult({ ...result, socs });
      return;
    }

    // Case-level fields → update extracted, recompute all soc amounts if total changes
    const extUpdate: Record<string, unknown> = { ...(result.extracted || {}) };
    const FIELD_MAP: Partial<Record<typeof field, string>> = {
      cedantRef: "ref_no",
      reinsured: "reinsured",
      insured: "account_name",
      claimType: "line",
      policyPeriod: "policy_period",
      dol: "dol",
      locationOfLoss: "location_of_loss",
      natureOfLoss: "nature_of_loss",
      particulars: "particulars",
      remarks: "nature_of_loss",
      currency: "currency",
      claimAmount100: "total_amount",
      total100: "total_amount",
    };
    const key = FIELD_MAP[field];
    if (!key) return;

    if (key === "total_amount") {
      const total = parseAmount(value);
      extUpdate.total_amount = total;
      const caseCcy = String(extUpdate.currency || "KRW");
      const socs = result.socs.map((s) => {
        const ccy = String(s.currency || caseCcy);
        const amount = total * s.share;
        return {
          ...s,
          amount,
          amount_fmt: `${ccy} ${fmtAmt(amount, ccy)}`,
        };
      });
      setResult({ ...result, extracted: extUpdate, socs });
    } else {
      extUpdate[key] = value;
      setResult({ ...result, extracted: extUpdate });
    }
  };

  const phaseLabels: Record<string, string> = {
    upload: "UPLOAD",
    extract: "EXTRACT",
    claims: "CLAIMS",
    contracts: "CONTRACTS",
    policy: "POLICY",
    reasoning: "REASONING",
    fallback: "FALLBACK",
    done: "DONE",
    error: "ERROR",
    retry: "RETRY",
  };
  const phaseAccent = (p: string) =>
    p === "error"
      ? "text-[#b91c1c]"
      : p === "done"
      ? "text-emerald-700"
      : p === "retry" || p === "fallback"
      ? "text-[#b45309]"
      : "text-slate-700";

  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      {/* Masthead — pipeline progress indicator drives the live state visual.
          The 5 phases mirror soc_stream.py: extract → claims → contracts →
          policy → reasoning. Current phase is derived from the most recent
          step event, so the indicator updates without extra plumbing. */}
      {(() => {
        const phases = [
          { key: "extract", label: "Extract" },
          { key: "claims", label: "Claims" },
          { key: "contracts", label: "Contracts" },
          { key: "policy", label: "Policy" },
          { key: "reasoning", label: "Reason" },
        ];
        const lastPhase =
          [...steps].reverse().find((s) =>
            phases.some((p) => p.key === s.phase)
          )?.phase || null;
        const isDone = !!result && !result.error;
        const isError = !!result?.error;
        const idx = lastPhase ? phases.findIndex((p) => p.key === lastPhase) : -1;
        const showPipeline = loading || result || steps.length > 0;
        return (
          <div className="border-b border-slate-900 px-6 py-4 flex items-center gap-6 bg-slate-900 text-white">
            <div className="flex items-baseline gap-3 shrink-0">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase">
                Slip Generator
              </span>
              <span className="text-[10px] text-slate-400 tracking-wider hidden md:inline">
                클레임 파일 → AI 추출 → 재보험사 Slip
              </span>
            </div>
            {showPipeline && (
              <div className="flex-1 flex items-center justify-center min-w-0">
                <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.2em] text-slate-300">
                  {phases.map((p, i) => {
                    const past = isDone || i < idx;
                    const current = !isDone && !isError && i === idx;
                    return (
                      <div key={p.key} className="flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            isError && current
                              ? "bg-red-400"
                              : past
                              ? "bg-emerald-400"
                              : current
                              ? "bg-amber-400 animate-pulse"
                              : "bg-slate-600"
                          }`}
                        />
                        <span
                          className={
                            past
                              ? "text-emerald-300"
                              : current
                              ? "text-white"
                              : "text-slate-500"
                          }
                        >
                          {p.label}
                        </span>
                        {i < phases.length - 1 && (
                          <span className="text-slate-700 mx-0.5">›</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!showPipeline && <div className="flex-1" />}
            <div className="flex items-center gap-5 text-[10px] font-mono tabular-nums text-slate-300 shrink-0">
              <span className="hidden lg:inline">
                <span className="text-slate-500 mr-1">TOOL</span>SLIP/v1
              </span>
              <button
                onClick={handleNewSlip}
                disabled={loading}
                title="모든 입력과 결과를 초기화하고 새 슬립을 생성합니다"
                className="px-3 py-1.5 border border-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] text-white hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white"
              >
                + New Slip
              </button>
            </div>
          </div>
        );
      })()}

      <div className="px-6 py-5 space-y-5">
        <RecentUpdatesBanner area="slip-generator" />
        {/* Live processing */}
        {(loading || steps.length > 0) && !result && (
          <Card
            title="Processing"
            subtitle="처리 로그"
            right={
              uploadPct !== null && uploadPct < 100 ? (
                <span className="text-[10px] font-mono tabular-nums text-slate-500">
                  UPLOAD {uploadPct}%
                </span>
              ) : loading ? (
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  running
                </span>
              ) : null
            }
          >
            <div className="space-y-1.5">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3 text-[11px]">
                  <span
                    className={`font-bold shrink-0 w-20 font-mono uppercase tracking-wider text-[10px] ${phaseAccent(
                      s.phase
                    )}`}
                  >
                    {phaseLabels[s.phase] || s.phase.toUpperCase()}
                  </span>
                  <span className="text-slate-700 flex-1">{s.message}</span>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 bg-slate-900 animate-pulse" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    processing
                  </span>
                </div>
              )}
            </div>
            {thinkingSteps.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-200">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                  AI Reasoning · 추론
                </div>
                {thinkingSteps.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-[11px] mb-1"
                  >
                    <span className="text-slate-400 font-mono tabular-nums shrink-0">
                      [{String(i + 1).padStart(2, "0")}]
                    </span>
                    <span className="text-slate-600">{t}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── INPUT STATE ──────────────────────────────── */}
        {!result && !loading && (
          <>
            <Card title="Files" subtitle="파일 업로드">
              <div
                className="border border-dashed border-slate-300 p-6 text-center cursor-pointer hover:border-slate-900 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("border-slate-900");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("border-slate-900");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-slate-900");
                  addFiles(e.dataTransfer.files);
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.msg,.xlsx,.xls,.doc,.docx"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                  }}
                />
                <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-700">
                  Drag files here · 클릭하여 선택
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  PDF · MSG · XLSX
                </div>
              </div>
              {files.length > 0 && (
                <div className="mt-3 border border-slate-200">
                  {files.map((f, i) => {
                    const isPdf = f.name.toLowerCase().endsWith(".pdf");
                    const url = fileUrls.get(i);
                    const ext = f.name.split(".").pop()?.toUpperCase() || "";
                    return (
                      <div
                        key={i}
                        className="border-b border-slate-200 last:border-b-0"
                      >
                        <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[9px] font-mono font-bold tracking-wider bg-slate-900 text-white px-1.5 py-0.5">
                              {ext}
                            </span>
                            <span className="font-medium text-slate-900 truncate">
                              {f.name}
                            </span>
                            <span className="text-slate-400 font-mono tabular-nums text-[10px]">
                              {(f.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                          <div className="flex gap-3 shrink-0">
                            {isPdf && url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewFileIdx(
                                    previewFileIdx === i ? null : i
                                  );
                                }}
                                className="text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900"
                              >
                                {previewFileIdx === i ? "Close" : "Preview"}
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(i);
                              }}
                              className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        {previewFileIdx === i && url && isPdf && (
                          <iframe
                            src={url}
                            className="w-full border-t border-slate-200"
                            style={{ height: 400 }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Email / Text" subtitle="이메일 · 텍스트 붙여넣기">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="이메일 내용, SOC 상세, 또는 추가 클레임 정보를 붙여넣기..."
                className="w-full h-32 px-3 py-2 border border-slate-300 bg-white text-[12px] focus:outline-none focus:border-slate-900 font-mono"
              />
            </Card>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerate}
                disabled={(!files.length && !pasteText.trim()) || loading}
                className="px-6 py-2.5 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? "Analyzing…" : "Generate Slip"}
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                {files.length} file{files.length !== 1 ? "s" : ""}
                {pasteText.trim() ? " · with text" : ""}
              </span>
            </div>
          </>
        )}

        {/* ── ERROR ────────────────────────────────────── */}
        {result?.error && (
          <Card title="Error" subtitle="처리 실패">
            <div className="text-[12px] text-[#b91c1c] mb-3">{result.error}</div>
            <button
              onClick={() => {
                setResult(null);
                setSteps([]);
                setThinkingSteps([]);
              }}
              className="px-3 py-1.5 border border-slate-300 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50"
            >
              Retry
            </button>
          </Card>
        )}

        {/* ── RESULT STATE ─────────────────────────────── */}
        {result && !result.error && (
          <>
            {/* Allocation summary */}
            {result.socs && result.socs.length > 0 && (
              <Card
                title="Allocation"
                subtitle={`배분 비율 · ${result.socs.length} reinsurers`}
              >
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3">Reinsurer</th>
                      <th className="py-2 pr-3 text-right">Share</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.socs.map((s, i) => {
                      const rowCcy = String(s.currency || ext?.currency || "KRW");
                      return (
                        <tr
                          key={i}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-2 pr-3 font-bold text-slate-900">
                            {s.reinsurer || (
                              <span className="text-slate-300 font-normal">
                                (미입력)
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-700">
                            {(s.share * 100).toFixed(2)}%
                          </td>
                          <td className="py-2 pr-3 text-right font-mono tabular-nums font-bold text-slate-900">
                            {rowCcy} {fmtAmt(s.amount, rowCcy)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      // Group amounts by currency. If every soc shares the
                      // same currency the table renders the legacy single
                      // Total row; multi-currency packets get one Total per
                      // currency so we never auto-sum USD into KRW.
                      const byCcy = new Map<string, number>();
                      for (const x of result.socs) {
                        const c = String(x.currency || ext?.currency || "KRW");
                        byCcy.set(c, (byCcy.get(c) || 0) + x.amount);
                      }
                      const shareSum =
                        result.socs.reduce((a, x) => a + x.share, 0) * 100;
                      const rows = Array.from(byCcy.entries());
                      return rows.map(([ccy, amt], idx) => (
                        <tr
                          key={ccy}
                          className={`bg-slate-50 ${idx === 0 ? "border-t border-slate-300" : ""}`}
                        >
                          <td className="py-2 pr-3 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                            {idx === 0 ? "Total" : ""}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono tabular-nums font-bold text-slate-700">
                            {idx === 0 ? `${shareSum.toFixed(2)}%` : ""}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono tabular-nums font-bold text-slate-900">
                            {ccy} {fmtAmt(amt, ccy)}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tfoot>
                </table>
              </Card>
            )}

            {/* Evidence */}
            {result.evidence && (
              <>
                {(() => {
                  const fr = result.evidence?.file_reinsurer;
                  const isBroker = fr?.name
                    ? [
                        "ins",
                        "ins corp.",
                        "ins corp",
                        "daewoo ins",
                        "daewoo ins corp",
                        "daewoo ins corp.",
                        "daewoo insurance",
                        "dwins",
                        "ns",
                        "ns corp.",
                        "ns corp",
                        "인스보험중개",
                      ].includes(fr.name.toLowerCase())
                    : false;
                  const claimRows = result.evidence?.past_claims?.rows || [];
                  const contractRows = result.evidence?.contracts?.rows || [];
                  const claimMatch =
                    fr && !isBroker
                      ? claimRows.find(
                          (c) => Math.abs(c.share - fr.share) < 0.001
                        )
                      : null;
                  const contractMatch =
                    fr && !isBroker
                      ? contractRows.find(
                          (c) => Math.abs(c.share - fr.share) < 0.001
                        )
                      : null;
                  const claimShareMatch = fr
                    ? claimRows.find(
                        (c) => Math.abs(c.share - fr.share) < 0.001
                      )
                    : null;
                  return (
                    <Card
                      title="Evidence · 01"
                      subtitle="파일 추출 정보"
                      right={
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                          file
                        </span>
                      }
                    >
                      {fr?.name ? (
                        <>
                          <div className="grid grid-cols-3 gap-4">
                            <Field label="Reinsurer / 재보험사">
                              <span>{fr.name}</span>
                              {isBroker && (
                                <span className="ml-2 text-[10px] text-[#b45309]">
                                  ※ 브로커
                                </span>
                              )}
                            </Field>
                            <Field label="Share / 비율" mono>
                              {(fr.share * 100).toFixed(2)}%
                            </Field>
                            <Field label="Amount / 금액" mono>
                              {fmtAmt(fr.amount, ext?.currency as string | null | undefined)}
                            </Field>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5">
                            {claimMatch && !isBroker && (
                              <MatchLine
                                ok
                                label="과거 클레임 일치"
                                detail={`${claimMatch.reinsurer} ${(
                                  claimMatch.share * 100
                                ).toFixed(2)}% · Ref ${claimMatch.ref_no}`}
                              />
                            )}
                            {contractMatch && !isBroker && (
                              <MatchLine
                                ok
                                label="계약 DB 일치"
                                detail={`${contractMatch.reinsurer} ${(
                                  contractMatch.share * 100
                                ).toFixed(2)}% · ${
                                  contractMatch.cover_note_no
                                }`}
                              />
                            )}
                            {isBroker && claimShareMatch && (
                              <MatchLine
                                label="비율 일치 과거 클레임"
                                detail={`${claimShareMatch.reinsurer} ${(
                                  claimShareMatch.share * 100
                                ).toFixed(2)}% · Ref ${
                                  claimShareMatch.ref_no
                                }`}
                              />
                            )}
                            {!claimMatch && !contractMatch && !claimShareMatch && (
                              <div className="text-[11px] text-slate-400">
                                DB에서 일치하는 참조 데이터 없음
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-slate-400">
                          파일에서 재보험사 힌트를 찾지 못했습니다
                        </div>
                      )}
                    </Card>
                  );
                })()}

                <Card
                  title="Evidence · 02"
                  subtitle={`과거 클레임 DB · ${
                    result.evidence.past_claims?.rows.length || 0
                  }건`}
                  right={
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      {result.evidence.past_claims?.search_method || "—"}
                    </span>
                  }
                >
                  {!result.evidence.past_claims?.rows.length ? (
                    <div className="text-[11px] text-slate-400 py-3">
                      매칭되는 과거 클레임 없음
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-4">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <th className="px-2 py-2 w-6" />
                            <th className="px-2 py-2">Ref No</th>
                            <th className="px-2 py-2">Assured</th>
                            <th className="px-2 py-2">DOL</th>
                            <th className="px-2 py-2">Cedant</th>
                            <th className="px-2 py-2">Reinsurer</th>
                            <th className="px-2 py-2 text-right">Share</th>
                            <th className="px-2 py-2 text-right">KRW</th>
                            <th className="px-2 py-2">Line</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.evidence.past_claims.rows.map(
                            (r: PastClaim) => (
                              <tr
                                key={r.id}
                                onMouseEnter={(e) =>
                                  setHover({
                                    kind: "claim",
                                    anchorRect: (e.currentTarget as HTMLTableRowElement).getBoundingClientRect(),
                                    data: r,
                                    ext: result.extracted,
                                    fileReinsurer: result.evidence?.file_reinsurer,
                                  })
                                }
                                onMouseLeave={() => setHover(null)}
                                onClick={() =>
                                  r.ref_no &&
                                  router.push(`/ins/claims/ref/${encodeURIComponent(r.ref_no)}`)
                                }
                                className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                                  r.used ? "bg-slate-900/[0.03]" : ""
                                }`}
                              >
                                <td className="px-2 py-1.5 text-center">
                                  {r.used ? (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-900" />
                                  ) : (
                                    <span className="text-slate-300">·</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 font-mono text-slate-700">
                                  {r.ref_no}
                                </td>
                                <td
                                  className="px-2 py-1.5 text-slate-700 truncate max-w-[160px]"
                                  title={r.account_name}
                                >
                                  {r.account_name}
                                </td>
                                <td className="px-2 py-1.5 text-slate-500 font-mono">
                                  {r.dol || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-600">
                                  {r.cedant || "—"}
                                </td>
                                <td
                                  className={`px-2 py-1.5 font-bold ${
                                    r.used ? "text-slate-900" : "text-slate-700"
                                  }`}
                                >
                                  {r.reinsurer || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-600">
                                  {(r.share * 100).toFixed(2)}%
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-700">
                                  {fmt(r.krw_amount)}
                                </td>
                                <td className="px-2 py-1.5 text-slate-500">
                                  {r.line || "—"}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card
                  title="Evidence · 03"
                  subtitle={`계약 DB · ${
                    result.evidence.contracts?.rows.length || 0
                  }건`}
                  right={
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      {result.evidence.contracts?.search_method || "—"}
                    </span>
                  }
                >
                  {!result.evidence.contracts?.rows.length ? (
                    <div className="text-[11px] text-slate-400 py-3">
                      매칭되는 계약 없음
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-4">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <th className="px-2 py-2 w-6" />
                            <th className="px-2 py-2">Cover Note</th>
                            <th className="px-2 py-2">Assured</th>
                            <th className="px-2 py-2">Year</th>
                            <th className="px-2 py-2">Period</th>
                            <th className="px-2 py-2">Cedant</th>
                            <th className="px-2 py-2">Reinsurer</th>
                            <th className="px-2 py-2 text-right">Share</th>
                            <th className="px-2 py-2">Line</th>
                            <th className="px-2 py-2">Ccy</th>
                            <th className="px-2 py-2 text-right">Gross</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.evidence.contracts.rows.map(
                            (r: ContractRow) => (
                              <tr
                                key={r.id}
                                onMouseEnter={(e) =>
                                  setHover({
                                    kind: "contract",
                                    anchorRect: (e.currentTarget as HTMLTableRowElement).getBoundingClientRect(),
                                    data: r,
                                    ext: result.extracted,
                                    fileReinsurer: result.evidence?.file_reinsurer,
                                  })
                                }
                                onMouseLeave={() => setHover(null)}
                                onClick={() => router.push(`/ins/contracts/${r.id}`)}
                                className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                                  r.used ? "bg-slate-900/[0.03]" : ""
                                }`}
                              >
                                <td className="px-2 py-1.5 text-center">
                                  {r.used ? (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-900" />
                                  ) : (
                                    <span className="text-slate-300">·</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 font-mono text-slate-700">
                                  {r.cover_note_no}
                                </td>
                                <td
                                  className="px-2 py-1.5 text-slate-700 truncate max-w-[140px]"
                                  title={r.assured}
                                >
                                  {r.assured}
                                </td>
                                <td className="px-2 py-1.5 text-slate-600 font-mono tabular-nums">
                                  {r.year}
                                </td>
                                <td className="px-2 py-1.5 text-slate-400 text-[10px] font-mono">
                                  {r.period_from || "—"} ~ {r.period_to || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-600">
                                  {r.cedant || "—"}
                                </td>
                                <td
                                  className={`px-2 py-1.5 font-bold ${
                                    r.used ? "text-slate-900" : "text-slate-700"
                                  }`}
                                >
                                  {r.reinsurer || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-600">
                                  {(r.share * 100).toFixed(2)}%
                                </td>
                                <td className="px-2 py-1.5 text-slate-500">
                                  {r.line || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-500 font-mono">
                                  {r.currency || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-700">
                                  {r.gross_prem_100
                                    ? fmt(r.gross_prem_100)
                                    : "—"}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card
                  title="Evidence · 04"
                  subtitle="폴리시 매칭"
                  right={
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      policy
                    </span>
                  }
                >
                  {result.evidence.policy_match ? (
                    <div className="grid grid-cols-4 gap-4">
                      <Field label="Cover Note" mono>
                        {result.evidence.policy_match.cover_note_no}
                      </Field>
                      <Field label="Assured">
                        {result.evidence.policy_match.assured}
                      </Field>
                      <Field label="Match Score" mono>
                        {result.evidence.policy_match.score}
                      </Field>
                      <div className="flex items-end">
                        <a
                          href={`/ins/policies/${result.evidence.policy_match.id}`}
                          className="text-[10px] font-bold uppercase tracking-wider text-slate-900 hover:underline underline-offset-4"
                        >
                          View Policy →
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      매칭되는 폴리시 없음
                    </div>
                  )}
                </Card>

                <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-900" />
                  표시된 행 = AI가 실제 배분에 참조한 근거
                </div>
              </>
            )}

            {/* Thinking */}
            {(result?.thinking?.length || thinkingSteps.length) > 0 && (
              <Card title="AI Reasoning" subtitle={`${(result?.thinking || thinkingSteps).length} 단계`}>
                <div className="space-y-2">
                  {(result?.thinking || thinkingSteps).map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 text-[12px] leading-relaxed"
                    >
                      <span className="text-slate-400 font-mono tabular-nums shrink-0">
                        [{String(i + 1).padStart(2, "0")}]
                      </span>
                      <span className="text-slate-700">{step}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Extracted info */}
            {(() => {
              const effective = draftExt ?? ext ?? {};
              const isDirty = !!draftExt;
              const changedKeys = draftExt
                ? Object.keys(draftExt).filter((k) => {
                    const a = draftExt[k];
                    const b = (ext || {})[k];
                    return (a ?? "") !== (b ?? "");
                  })
                : [];
              const applyDraft = () => {
                if (!result || !draftExt) return;
                const extUpdate = { ...(result.extracted || {}), ...draftExt };
                const totalChanged = changedKeys.includes("total_amount");
                // Cedent / Reinsured edits in Claim Detail drive the
                // slip rendering: "Cedent" (key `reinsured`, the cedant
                // full name) flows to the slip body's "1. Reinsured"
                // row; "Reinsured" (synthetic key `to_reinsurer`) flows
                // to the slip header's "To." line. We force-propagate
                // to every SOC so the wiring matches the customer's
                // mental model even for multi-reinsurer cases. Per-SOC
                // reinsurer can still be edited afterward on the slip
                // preview itself.
                const cedentChanged = "reinsured" in draftExt;
                const reinsurerChanged = "to_reinsurer" in draftExt;
                let socs = result.socs;
                if (totalChanged || cedentChanged || reinsurerChanged) {
                  const total = Number(extUpdate.total_amount || 0);
                  const caseCcy = String(extUpdate.currency || "KRW");
                  const newCedent =
                    cedentChanged ? String(extUpdate.reinsured || "") : null;
                  const newReinsurer =
                    reinsurerChanged
                      ? String(extUpdate.to_reinsurer || "")
                      : null;
                  socs = result.socs.map((s) => {
                    const next: typeof s = { ...s };
                    if (totalChanged) {
                      const ccy = String(s.currency || caseCcy);
                      next.amount = total * s.share;
                      next.amount_fmt = `${ccy} ${fmtAmt(total * s.share, ccy)}`;
                    }
                    if (newCedent !== null) {
                      next.cedant_full_name = newCedent;
                      // body_fields may have been customised earlier (row
                      // editor was opened and labels tweaked). Drop the
                      // override so the next render rebuilds defaults
                      // with the propagated Cedent value — otherwise a
                      // stale "Reinsured" row shadows the change.
                      next.body_fields = undefined;
                    }
                    if (newReinsurer !== null) {
                      next.reinsurer = newReinsurer;
                      next.body_fields = undefined;
                    }
                    return next;
                  });
                }
                setResult({ ...result, extracted: extUpdate, socs });
                setDraftExt(null);
              };

              return (
                <Card
                  title="Claim Detail"
                  subtitle={
                    isDirty
                      ? `클레임 상세 · ${changedKeys.length}건 변경 (미적용)`
                      : "클레임 상세 · 클릭해서 수정 → Apply"
                  }
                  right={
                    <div className="flex items-center gap-3">
                      {/* KR/EN toggle — flips translatable fields between
                          Korean original and extracted.text_en. Doesn't
                          touch the slip preview (still driven by
                          is_foreign per SOC). Read-only in EN mode for
                          fields backed by a translation. Domestic-only
                          cases trigger an on-demand /translate call on
                          first EN click. */}
                      <div className="flex items-center gap-2">
                        {translateError && (
                          <span
                            className="text-[9px] text-[#b91c1c] font-mono uppercase tracking-wider"
                            title={translateError}
                          >
                            번역 실패
                          </span>
                        )}
                        <div className="flex items-center border border-slate-300 text-[9px] font-bold uppercase tracking-[0.15em]">
                          <button
                            onClick={() => switchLang("kr")}
                            disabled={translating}
                            className={`px-2 py-0.5 disabled:opacity-50 ${
                              displayLang === "kr"
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            KR
                          </button>
                          <button
                            onClick={() => switchLang("en")}
                            disabled={translating}
                            className={`px-2 py-0.5 disabled:opacity-50 ${
                              displayLang === "en"
                                ? "bg-slate-900 text-white"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                            title={
                              translating
                                ? "번역 중..."
                                : "영문 보기 (한→영 번역)"
                            }
                          >
                            {translating ? "···" : "EN"}
                          </button>
                        </div>
                      </div>
                      {isDirty && (
                        <>
                          <button
                            onClick={() => setDraftExt(null)}
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
                          >
                            Discard
                          </button>
                          <button
                            onClick={applyDraft}
                            className="px-3 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black"
                          >
                            Apply
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setResult(null);
                          setDraftExt(null);
                          setSteps([]);
                          setThinkingSteps([]);
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] hover:underline"
                      >
                        Reset
                      </button>
                    </div>
                  }
                >
                  <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                    {(
                      [
                        ["Assured · 피보험자", "account_name", "text"],
                        // "Cedent · 원수사" — the cedant company; bound to
                        // ext.reinsured (which holds the cedant full name
                        // from AI extraction). Edits propagate to every
                        // SOC's cedant_full_name on Apply so the slip
                        // body's "1. Reinsured" row picks up the change.
                        ["Cedent · 원수사 (→ Reinsured)", "reinsured", "text"],
                        // "Reinsured · 재보험사" — the reinsurer (slip
                        // "To." target). Bound to the synthetic
                        // to_reinsurer key — displays each SOC's
                        // reinsurer and propagates the user's value to
                        // every SOC on Apply so the slip header updates.
                        ["Reinsured · 재보험사 (→ To.)", "to_reinsurer", "text"],
                        ["Line · 종목", "line", "text"],
                        ["Ref No", "ref_no", "text"],
                        ["DOL · 사고일", "dol", "text"],
                        // DOC = document issue date from the PDF letterhead.
                        ["DOC · 문서일자", "doc_date", "text"],
                        // Date = slip generation date (today by default).
                        // Independent from DOC per customer request.
                        ["Date · 발송일자", "slip_date", "text"],
                        ["Policy Period", "policy_period", "text"],
                        ["Currency", "currency", "text"],
                        ["Amount · 금액 (100%)", "total_amount", "number"],
                        ["Location of Loss", "location_of_loss", "text"],
                        ["Nature of Loss", "nature_of_loss", "textarea"],
                        ["Particulars", "particulars", "textarea"],
                        ["Description", "description", "textarea"],
                      ] as const
                    ).map(([label, key, kind]) => {
                      const span =
                        kind === "textarea" ? "col-span-2" : "col-span-1";
                      const textEn =
                        ((effective as Record<string, unknown>).text_en as
                          | Record<string, string>
                          | undefined) || undefined;
                      const enValue =
                        displayLang === "en" &&
                        (TEXT_EN_KEYS as readonly string[]).includes(key)
                          ? textEn?.[key]
                          : undefined;
                      const enReadOnly = !!enValue;
                      const rawOrig = (effective as Record<string, unknown>)[
                        key
                      ];
                      // Synthetic key: "to_reinsurer" mirrors the slip's
                      // actual To. line (first SOC's reinsurer) until
                      // the user edits it; their value then propagates
                      // to every SOC on Apply.
                      const firstSocReinsurer =
                        result?.socs?.[0]?.reinsurer || "";
                      const raw =
                        key === "slip_date" &&
                        (rawOrig == null || rawOrig === "")
                          ? todayIso()
                          : key === "to_reinsurer" &&
                            (rawOrig == null || rawOrig === "")
                          ? firstSocReinsurer
                          : rawOrig;
                      const origRaw = ext ? ext[key] : undefined;
                      const changed =
                        isDirty && changedKeys.includes(key);
                      // "Description" is insurer-specific; show "-" when
                      // empty rather than the generic "—" placeholder.
                      const emptyPlaceholder = key === "description" ? "-" : "—";
                      const display = enValue
                        ? enValue
                        : kind === "number" && raw
                        ? fmt(Number(raw))
                        : raw != null && raw !== ""
                        ? String(raw)
                        : emptyPlaceholder;
                      return (
                        <div key={key} className={span}>
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            {label}
                            {changed && (
                              <span className="text-[8px] text-[#b45309] border border-[#b45309] px-1 tracking-widest">
                                edited
                              </span>
                            )}
                            {enReadOnly && (
                              <span className="text-[8px] text-slate-400 border border-slate-200 px-1 tracking-widest">
                                EN
                              </span>
                            )}
                          </div>
                          <div
                            key={`${key}-${displayLang}`}
                            className={`slip-edit mt-0.5 text-[12px] font-semibold ${
                              changed ? "text-[#b45309]" : "text-slate-900"
                            } ${
                              kind === "number" ? "font-mono tabular-nums" : ""
                            } ${kind === "textarea" ? "whitespace-pre-wrap" : ""} ${
                              enReadOnly ? "opacity-80" : ""
                            }`}
                            contentEditable={!enReadOnly}
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              if (enReadOnly) return;
                              const v = e.currentTarget.textContent || "";
                              const cur =
                                kind === "number"
                                  ? String(parseAmount(v))
                                  : v;
                              // Phantom-edit guards. Each "derived" field
                              // (slip_date → today, to_reinsurer → first
                              // SOC reinsurer) needs orig to match raw
                              // when the user merely tabs through; else
                              // the diff comparison fires and the row
                              // is incorrectly marked as edited.
                              const orig =
                                key === "slip_date" &&
                                (origRaw == null || origRaw === "")
                                  ? todayIso()
                                  : key === "to_reinsurer" &&
                                    (origRaw == null || origRaw === "")
                                  ? firstSocReinsurer
                                  : kind === "number" && origRaw
                                  ? String(Number(origRaw))
                                  : origRaw != null
                                  ? String(origRaw)
                                  : "";
                              setDraftExt((prev) => {
                                const base = prev || {};
                                if (cur === orig) {
                                  const { [key]: _, ...rest } = base;
                                  return Object.keys(rest).length
                                    ? rest
                                    : null;
                                }
                                return {
                                  ...base,
                                  [key]:
                                    kind === "number"
                                      ? parseAmount(v)
                                      : v === "—" || v === "-"
                                      ? null
                                      : v,
                                };
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && kind !== "textarea") {
                                e.preventDefault();
                                (e.currentTarget as HTMLElement).blur();
                              }
                            }}
                          >
                            {display}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isDirty && (
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] text-[#b45309] uppercase tracking-wider font-mono">
                        {changedKeys.length}건 수정됨 · Apply를 눌러야 아래 Slip 문서에 반영됩니다
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDraftExt(null)}
                          className="px-3 py-1 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                        >
                          Discard
                        </button>
                        <button
                          onClick={applyDraft}
                          className="px-4 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black"
                        >
                          Apply Changes
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })()}

            {/* Bordereau Column Manager — visibility / order / custom-text columns. */}
            {(docType === "Bordereau SOC" || docType === "Bordereau PLA") && result && (() => {
              const moveCol = (idx: number, delta: number) => {
                const j = idx + delta;
                if (j < 0 || j >= effectiveColumns.length) return;
                const next = [...effectiveColumns];
                [next[idx], next[j]] = [next[j], next[idx]];
                setColumnsConfig(next);
              };
              const toggleVisible = (idx: number) => {
                const next = effectiveColumns.map((c, i) =>
                  i === idx ? { ...c, visible: c.visible === false ? true : false } : c
                );
                setColumnsConfig(next);
              };
              const renameCol = (idx: number, label: string) => {
                const next = effectiveColumns.map((c, i) =>
                  i === idx ? { ...c, label } : c
                );
                setColumnsConfig(next);
              };
              const removeCol = (idx: number) => {
                const c = effectiveColumns[idx];
                // Built-in columns are kept but hidden — re-removing
                // would lose layout information that may matter later.
                // Only user-added (``static`` / ``custom``) cols can be
                // hard-deleted; everything else hides via the toggle.
                if (c.source.kind !== "static" && c.source.kind !== "custom") {
                  toggleVisible(idx);
                  return;
                }
                const next = effectiveColumns.filter((_, i) => i !== idx);
                setColumnsConfig(next);
              };
              const addCustomCol = () => {
                const id = `custom_${Date.now().toString(36)}`;
                const next: BordereauColumn[] = [
                  ...effectiveColumns,
                  {
                    key: id,
                    label: "새 컬럼",
                    align: "left",
                    visible: true,
                    source: { kind: "custom", valuesByRowIdx: {} },
                  },
                ];
                setColumnsConfig(next);
              };
              const resetCols = () => setColumnsConfig(null);
              const sourceLabel = (c: BordereauColumn): string => {
                switch (c.source.kind) {
                  case "index": return "auto";
                  case "field": return `field:${c.source.field}`;
                  case "computed": return `computed:${c.source.computed}`;
                  case "static": return "static text";
                  case "custom": return "per-row text";
                }
              };
              return (
                <Card
                  title="Bordereau Columns"
                  subtitle={`${effectiveColumns.filter((c) => c.visible !== false).length}/${effectiveColumns.length} 표시 · 표 컬럼 구성`}
                  right={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addCustomCol}
                        className="px-2.5 py-1 border border-slate-300 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50"
                      >
                        + 사용자 컬럼
                      </button>
                      <button
                        onClick={resetCols}
                        className="px-2.5 py-1 border border-slate-300 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50"
                      >
                        기본값 복원
                      </button>
                      <button
                        onClick={() => setColMgrOpen((v) => !v)}
                        className="px-2.5 py-1 border border-slate-300 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50"
                      >
                        {colMgrOpen ? "Hide" : "Manage"}
                      </button>
                    </div>
                  }
                >
                  {colMgrOpen && (
                    <div className="overflow-x-auto -mx-4">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <th className="px-2 py-2 w-8">표시</th>
                            <th className="px-2 py-2 w-10">#</th>
                            <th className="px-2 py-2">라벨</th>
                            <th className="px-2 py-2">소스</th>
                            <th className="px-2 py-2 w-32">정렬·이동</th>
                            <th className="px-2 py-2 w-16" />
                          </tr>
                        </thead>
                        <tbody>
                          {effectiveColumns.map((c, i) => (
                            <tr key={c.key} className="border-b border-slate-100">
                              <td className="px-2 py-1 text-center">
                                <input
                                  type="checkbox"
                                  checked={c.visible !== false}
                                  onChange={() => toggleVisible(i)}
                                />
                              </td>
                              <td className="px-2 py-1 text-slate-400 font-mono tabular-nums text-[10px]">
                                {String(i + 1).padStart(2, "0")}
                              </td>
                              <td className="px-2 py-1">
                                <input
                                  type="text"
                                  value={c.label}
                                  onChange={(e) => renameCol(i, e.target.value)}
                                  className="w-full px-1 py-0.5 text-[11px] border border-transparent hover:border-slate-300 focus:border-slate-900 outline-none"
                                />
                              </td>
                              <td className="px-2 py-1 text-[10px] text-slate-500 font-mono">
                                {sourceLabel(c)}
                              </td>
                              <td className="px-2 py-1">
                                <button
                                  onClick={() => moveCol(i, -1)}
                                  disabled={i === 0}
                                  className="px-1.5 py-0.5 text-[10px] hover:bg-slate-100 disabled:opacity-30"
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={() => moveCol(i, 1)}
                                  disabled={i === effectiveColumns.length - 1}
                                  className="px-1.5 py-0.5 text-[10px] hover:bg-slate-100 disabled:opacity-30"
                                >
                                  ▼
                                </button>
                              </td>
                              <td className="px-2 py-1">
                                <button
                                  onClick={() => removeCol(i)}
                                  className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] hover:underline"
                                >
                                  {c.source.kind === "static" || c.source.kind === "custom"
                                    ? "Delete"
                                    : "Hide"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-2 pt-2 text-[10px] text-slate-500">
                        • Incident ID / Seq 컬럼: KB 보더루에서 동일 사고 ↔ 차수(001/002/003) 식별용. 켜면 자동으로 ref_no에서 계산된 값이 들어갑니다.<br />
                        • 사용자 컬럼: 라벨과 행별 값을 자유롭게 편집. 표 안에서 셀을 직접 클릭해 입력하세요.
                      </div>
                    </div>
                  )}
                </Card>
              );
            })()}

            {/* Bordereau Claims editor */}
            {(docType === "Bordereau SOC" || docType === "Bordereau PLA") && result && (() => {
              const claims = (ext?.claims as BordereauClaim[] | undefined) || [];
              const caseCcy = String(ext?.currency || "KRW");
              // Distinct currencies present across the claim rows. When the
              // packet mixes USD + KRW (or any other combination) we keep
              // each currency's totals separate instead of auto-summing.
              const distinctCurrencies = Array.from(
                new Set(claims.map((c) => String(c.currency || caseCcy).toUpperCase()))
              );
              const isMultiCcy = distinctCurrencies.length > 1;
              const updateClaims = (next: BordereauClaim[]) => {
                if (!result) return;
                const extUpdate: Record<string, unknown> = {
                  ...(result.extracted || {}),
                  claims: next,
                };
                // ``total_amount`` is the case-level scalar consumed by
                // single-currency code paths (Settlement table, SOC amount
                // calc). For multi-currency packets we set it to 0 so a
                // stale sum across currencies never leaks into a slip; the
                // per-currency totals live on each Soc.claims_subset.
                const ccysAfter = Array.from(
                  new Set(next.map((c) => String(c.currency || caseCcy).toUpperCase()))
                );
                const totalsByCcy = new Map<string, number>();
                for (const c of next) {
                  const ccy = String(c.currency || caseCcy).toUpperCase();
                  totalsByCcy.set(
                    ccy,
                    (totalsByCcy.get(ccy) || 0) +
                      (Number(c.claim_amount_100) || 0) +
                      (Number(c.expense_100) || 0)
                  );
                }
                const newTotal =
                  ccysAfter.length === 1
                    ? Array.from(totalsByCcy.values())[0] || 0
                    : 0;
                extUpdate.total_amount = newTotal;
                const socs = result.socs.map((s) => {
                  // For per-currency slip variants we restrict the claim
                  // list and the headline amount to the slip's own ccy.
                  const socCcy = s.currency
                    ? String(s.currency).toUpperCase()
                    : null;
                  const subset = socCcy
                    ? next.filter(
                        (c) => String(c.currency || caseCcy).toUpperCase() === socCcy
                      )
                    : next;
                  const total = subset.reduce(
                    (acc, c) =>
                      acc +
                      (Number(c.claim_amount_100) || 0) +
                      (Number(c.expense_100) || 0),
                    0
                  );
                  const ccyForLabel = socCcy || (ccysAfter.length === 1 ? ccysAfter[0] : caseCcy);
                  const amount = total * s.share;
                  return {
                    ...s,
                    claims: subset.map((c) => ({ ...c })),
                    claims_subset: socCcy ? subset.map((c) => ({ ...c })) : undefined,
                    amount,
                    amount_fmt: `${ccyForLabel} ${fmtAmt(amount, ccyForLabel)}`,
                  };
                });
                setResult({ ...result, extracted: extUpdate, socs });
              };
              const updateCell = (idx: number, key: keyof BordereauClaim, value: string) => {
                const next = claims.map((c, i) => {
                  if (i !== idx) return c;
                  if (key === "claim_amount_100" || key === "expense_100") {
                    return { ...c, [key]: parseAmount(value) };
                  }
                  return { ...c, [key]: value };
                });
                updateClaims(next);
              };
              const addRow = () => {
                const tpl: BordereauClaim = {
                  insured: String(ext?.account_name || ""),
                  policy_period: String(ext?.policy_period || ""),
                  uy: String(ext?.policy_period || "").slice(0, 4),
                  facility: String(ext?.cedant || ""),
                  dol: String(ext?.dol || ""),
                  doc: "",
                  currency: caseCcy,
                  claim_amount_100: 0,
                  expense_100: 0,
                  cedant: String(ext?.cedant || ""),
                  cedant_ref_no: String(ext?.ref_no || ""),
                };
                updateClaims([...claims, tpl]);
              };
              const removeRow = (idx: number) => {
                updateClaims(claims.filter((_, i) => i !== idx));
              };
              return (
                <Card
                  title="Bordereau Claims"
                  subtitle={`${claims.length} row${claims.length !== 1 ? "s" : ""} · 클릭해서 수정`}
                  right={
                    <button
                      onClick={addRow}
                      className="px-2.5 py-1 border border-slate-300 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50"
                    >
                      + Add Row
                    </button>
                  }
                >
                  <div className="overflow-x-auto -mx-4">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <th className="px-2 py-2">#</th>
                          <th className="px-2 py-2">Insured</th>
                          <th className="px-2 py-2">Policy Period</th>
                          <th className="px-2 py-2">UY</th>
                          <th className="px-2 py-2">Facility</th>
                          <th className="px-2 py-2">DOL</th>
                          <th className="px-2 py-2">DOC</th>
                          <th className="px-2 py-2">Ccy</th>
                          <th className="px-2 py-2 text-right">Claim 100%</th>
                          <th className="px-2 py-2 text-right">Expense 100%</th>
                          <th className="px-2 py-2">Cedant</th>
                          <th className="px-2 py-2">Ref No.</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {claims.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="px-2 py-6 text-center text-[11px] text-slate-400">
                              클레임 없음 — Add Row로 추가
                            </td>
                          </tr>
                        ) : (
                          claims.map((c, i) => {
                            // Each bordereau row carries its own ISO ccy
                            // (different rows in the same packet may use
                            // USD/JPY/KRW — see multi-currency handling in
                            // updateClaims). Numeric cells thread that ccy
                            // through fmtAmt so non-KRW rows render at 2dp.
                            const rowCcy = String(c.currency || caseCcy);
                            const cell = (k: keyof BordereauClaim, isNum = false) => (
                              <td className="px-1 py-1 align-top">
                                <div
                                  contentEditable
                                  suppressContentEditableWarning
                                  className={`slip-edit px-1 py-0.5 text-[11px] ${
                                    isNum ? "font-mono tabular-nums text-right" : ""
                                  }`}
                                  onBlur={(e) => {
                                    const v = e.currentTarget.textContent || "";
                                    updateCell(i, k, v);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      (e.currentTarget as HTMLElement).blur();
                                    }
                                  }}
                                >
                                  {isNum
                                    ? fmtAmt(Number(c[k]) || 0, rowCcy)
                                    : String(c[k] ?? "")}
                                </div>
                              </td>
                            );
                            return (
                              <tr key={i} className="border-b border-slate-100">
                                <td className="px-2 py-1 text-slate-400 font-mono tabular-nums text-[10px]">
                                  {String(i + 1).padStart(2, "0")}
                                </td>
                                {cell("insured")}
                                {cell("policy_period")}
                                {cell("uy")}
                                {cell("facility")}
                                {cell("dol")}
                                {cell("doc")}
                                {cell("currency")}
                                {cell("claim_amount_100", true)}
                                {cell("expense_100", true)}
                                {cell("cedant")}
                                {cell("cedant_ref_no")}
                                <td className="px-2 py-1">
                                  <button
                                    onClick={() => removeRow(i)}
                                    className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] hover:underline"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        {(() => {
                          // Build per-currency subtotals. Mixed-currency
                          // packets get one footer row per ISO code so we
                          // never auto-sum USD into KRW. Single-currency
                          // packets keep the legacy single Total row.
                          const sums = new Map<string, { claim: number; expense: number }>();
                          for (const c of claims) {
                            const ccy = String(c.currency || caseCcy).toUpperCase();
                            const cur = sums.get(ccy) || { claim: 0, expense: 0 };
                            cur.claim += Number(c.claim_amount_100) || 0;
                            cur.expense += Number(c.expense_100) || 0;
                            sums.set(ccy, cur);
                          }
                          const rows = Array.from(sums.entries());
                          if (rows.length === 0) {
                            return (
                              <tr className="bg-slate-50 border-t border-slate-300">
                                <td colSpan={8} className="px-2 py-2 font-bold uppercase tracking-wider text-[10px] text-slate-500 text-right">
                                  Total (100%)
                                </td>
                                <td colSpan={5} />
                              </tr>
                            );
                          }
                          return rows.map(([ccy, { claim, expense }], idx) => (
                            <tr
                              key={ccy}
                              className={`bg-slate-50 ${idx === 0 ? "border-t border-slate-300" : ""}`}
                            >
                              <td colSpan={7} className="px-2 py-2 font-bold uppercase tracking-wider text-[10px] text-slate-500 text-right">
                                {idx === 0 ? "Total (100%)" : ""}
                              </td>
                              <td className="px-2 py-2 font-bold uppercase tracking-wider text-[10px] text-slate-700">
                                {ccy}
                              </td>
                              <td className="px-2 py-2 text-right font-mono tabular-nums font-bold">
                                {fmtAmt(claim, ccy)}
                              </td>
                              <td className="px-2 py-2 text-right font-mono tabular-nums font-bold">
                                {fmtAmt(expense, ccy)}
                              </td>
                              <td colSpan={3} />
                            </tr>
                          ));
                        })()}
                      </tfoot>
                    </table>
                  </div>
                </Card>
              );
            })()}

            {/* SOC list */}
            {result && (
              <Card
                emphasis="primary"
                title="Slip Documents"
                subtitle={`${result.socs.length} reinsurers · ${docType}`}
                right={
                  <div className="flex items-center gap-3">
                    <div className="flex border border-slate-300">
                      {(["SOC", "PLA", "Bordereau SOC", "Bordereau PLA"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setDocType(t)}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border-r border-slate-300 last:border-r-0 whitespace-nowrap ${
                            docType === t
                              ? "bg-slate-900 text-white"
                              : "bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const ccy = String(ext?.currency || "KRW");
                        const newSoc: Soc = {
                          reinsurer: "",
                          share: 0,
                          share_pct: "0%",
                          amount: 0,
                          amount_fmt: `${ccy} ${fmtAmt(0, ccy)}`,
                          cedant: String(ext?.cedant || ""),
                        };
                        setResult({
                          ...result,
                          socs: [...result.socs, newSoc],
                        });
                      }}
                      className="px-2.5 py-1 border border-slate-300 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50"
                    >
                      + Add
                    </button>
                    {result.socs.length > 0 && (
                      <button
                        onClick={downloadAll}
                        className="px-3 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-black"
                      >
                        Download All PDF
                      </button>
                    )}
                  </div>
                }
              >
                {result.socs.some((s: Soc) => s.confidence === "POLICY") && (
                  <div className="text-[10px] text-[#b45309] font-mono uppercase tracking-wider mb-3">
                    ※ Policy-based allocation — please verify before sending.
                  </div>
                )}
                {result.evidence?.multi_cedant?.active && (
                  <div className="mb-4 border-l-4 border-amber-500 bg-amber-50 px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-900 mb-1.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                      Co-insurance · Multi-Cedant Fan-out
                    </div>
                    <div className="text-[11px] text-slate-700 leading-relaxed">
                      이 피보험자의 과거 클레임이{" "}
                      <span className="font-bold">
                        {result.evidence.multi_cedant.cedants.length}개 cedant
                      </span>
                      ({result.evidence.multi_cedant.cedants.join(" · ")})에 분산되어 있어,{" "}
                      각 cedant별로 PLA를 분리 생성했습니다. AI reasoning은 우회되고{" "}
                      과거 정산 이력의 우세 재보험사가 자동 선택됩니다 — 검토 후 수정/삭제하세요.
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {result.evidence.multi_cedant.groups.map((g) => {
                        const top = [...g.reinsurers].sort(
                          (a, b) => b.sum_amt - a.sum_amt
                        )[0];
                        return (
                          <div
                            key={g.cedant}
                            className="border border-amber-200 bg-white px-2 py-1.5"
                          >
                            <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
                              {g.cedant} · {g.count} past claim
                              {g.count !== 1 ? "s" : ""}
                            </div>
                            {top && (
                              <div className="text-[11px] mt-0.5 flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-900 truncate">
                                  → {top.name}
                                </span>
                                <span className="font-mono tabular-nums text-slate-700 shrink-0">
                                  {(top.avg_share * 100).toFixed(2)}%
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {codeTable && (
                  <datalist id="reinsurer-list">
                    {codeTable.reinsurers.map((r) => (
                      <option key={`${r.code}-${r.name}`} value={r.name}>
                        {r.code} · {r.is_foreign ? "Foreign" : "Domestic"}
                      </option>
                    ))}
                  </datalist>
                )}
                <div className="border border-slate-200">
                  {result.socs.map((soc, idx) => (
                    <div
                      key={idx}
                      className="border-b border-slate-200 last:border-b-0"
                    >
                      <div className="flex items-center justify-between px-3 py-2 gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-[12px] flex-1 min-w-0">
                          <span className="text-[9px] font-mono tabular-nums text-slate-400 w-6">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <input
                            value={soc.reinsurer}
                            placeholder="재보험사명"
                            list="reinsurer-list"
                            onChange={(e) => {
                              const next = e.target.value;
                              const socs = [...result.socs];
                              socs[idx] = {
                                ...socs[idx],
                                reinsurer: next,
                                is_foreign: isForeignReinsurerClient(codeTable, next),
                              };
                              setResult({ ...result, socs });
                            }}
                            className="font-bold text-slate-900 px-2 py-0.5 border border-slate-300 text-[12px] focus:outline-none focus:border-slate-900 min-w-[160px]"
                          />
                          {soc.is_foreign !== undefined && (
                            <span
                              className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 ${
                                soc.is_foreign
                                  ? "bg-slate-900 text-white"
                                  : "border border-slate-300 text-slate-700"
                              }`}
                              title={
                                soc.is_foreign
                                  ? "Foreign reinsurer — slip body must be English-only"
                                  : "Domestic / Korean entity — Korean text is OK"
                              }
                            >
                              {soc.is_foreign ? "Foreign" : "Domestic"}
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={Number((soc.share * 100).toFixed(4))}
                              onChange={(e) => {
                                const pct = Number(e.target.value) || 0;
                                const share = pct / 100;
                                const total = Number(ext?.total_amount || 0);
                                const amount = total * share;
                                const ccy = String(soc.currency || ext?.currency || "KRW");
                                const socs = [...result.socs];
                                socs[idx] = {
                                  ...socs[idx],
                                  share,
                                  share_pct: `${pct}%`,
                                  amount,
                                  amount_fmt: `${ccy} ${fmtAmt(amount, ccy)}`,
                                };
                                setResult({ ...result, socs });
                              }}
                              className="w-16 px-1.5 py-0.5 border border-slate-300 text-[11px] text-right font-mono tabular-nums focus:outline-none focus:border-slate-900"
                            />
                            <span className="text-slate-400 text-[10px]">%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-[10px] font-mono">
                              {String(soc.currency || ext?.currency || "KRW")}
                            </span>
                            <input
                              type="number"
                              step={String(soc.currency || ext?.currency || "KRW").toUpperCase() === "KRW" ? 1 : 0.01}
                              value={
                                String(soc.currency || ext?.currency || "KRW").toUpperCase() === "KRW"
                                  ? Math.round(soc.amount)
                                  : Number(soc.amount.toFixed(2))
                              }
                              onChange={(e) => {
                                const amount = Number(e.target.value) || 0;
                                const ccy = String(soc.currency || ext?.currency || "KRW");
                                const socs = [...result.socs];
                                socs[idx] = {
                                  ...socs[idx],
                                  amount,
                                  amount_fmt: `${ccy} ${fmtAmt(amount, ccy)}`,
                                };
                                setResult({ ...result, socs });
                              }}
                              className="w-32 px-1.5 py-0.5 border border-slate-300 text-[11px] text-right font-mono tabular-nums font-bold focus:outline-none focus:border-slate-900"
                            />
                          </div>
                          {soc.confidence && (
                            <span className="text-[9px] font-mono uppercase tracking-wider border border-slate-300 px-1.5 py-0.5 text-slate-700">
                              {soc.confidence}
                            </span>
                          )}
                          {soc.reasoning && (
                            <span
                              className="text-[10px] text-slate-500 truncate max-w-[240px]"
                              title={soc.reasoning}
                            >
                              {soc.reasoning}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3 shrink-0">
                          <button
                            onClick={() =>
                              setRowEditorIdx(rowEditorIdx === idx ? null : idx)
                            }
                            className={`text-[10px] font-bold uppercase tracking-wider hover:text-slate-900 ${
                              rowEditorIdx === idx
                                ? "text-slate-900"
                                : "text-slate-700"
                            }`}
                            title="슬립 본문 행 추가/삭제/이름변경"
                          >
                            {rowEditorIdx === idx ? "▾ Rows" : "▸ Rows"}
                          </button>
                          <button
                            onClick={() =>
                              setPreviewIdx(previewIdx === idx ? null : idx)
                            }
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900"
                          >
                            {previewIdx === idx ? "Close" : "Preview"}
                          </button>
                          <button
                            onClick={() => downloadPdf(idx)}
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-900 hover:underline"
                          >
                            PDF
                          </button>
                          <button
                            onClick={() => setEmailIdx(idx)}
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-900 hover:underline"
                          >
                            Email
                          </button>
                          <button
                            onClick={() => {
                              setResult({
                                ...result,
                                socs: result.socs.filter((_, j) => j !== idx),
                              });
                              if (previewIdx === idx) setPreviewIdx(null);
                            }}
                            className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {displayLang === "en" && (() => {
                        const fields = ["line", "location_of_loss", "nature_of_loss", "particulars", "remarks"] as const;
                        const offending = fields.filter((f) =>
                          containsKorean(pickSlipText(ext, true, f))
                        );
                        if (offending.length === 0) return null;
                        return (
                          <div className="px-3 py-1.5 bg-[#fff7ed] border-t border-[#fed7aa] text-[10px] text-[#9a3412] font-mono uppercase tracking-wider">
                            ⚠ EN mode — Korean characters still present in: {offending.join(", ")}. Edit the slip directly or re-run translation.
                          </div>
                        );
                      })()}

                      {/* ── Row editor (per-SOC) ─────────────────────
                          Lets the user reshape the slip body table
                          row-by-row: rename labels (insurer-specific
                          terminology), add new rows (e.g. "Nature of
                          Loss" only for some cedants), reorder, or
                          delete. The current row list lives on
                          soc.body_fields; if absent, the default 8-row
                          layout is used as the editing baseline. */}
                      {rowEditorIdx === idx && (() => {
                        const currentRows =
                          soc.body_fields ||
                          buildDefaultBodyFields(
                            ext,
                            displayLang === "en",
                            result?.policy || null,
                            soc.cedant_full_name
                          );
                        const setRows = (
                          next: { id: string; label: string; value: string; kind?: "text" | "textarea" }[]
                        ) => {
                          const socs = [...result.socs];
                          socs[idx] = { ...socs[idx], body_fields: next };
                          setResult({ ...result, socs });
                        };
                        const move = (i: number, dir: -1 | 1) => {
                          const j = i + dir;
                          if (j < 0 || j >= currentRows.length) return;
                          const next = [...currentRows];
                          [next[i], next[j]] = [next[j], next[i]];
                          setRows(next);
                        };
                        const remove = (i: number) =>
                          setRows(currentRows.filter((_, j) => j !== i));
                        const addRow = () =>
                          setRows([
                            ...currentRows,
                            {
                              id: `custom_${Date.now()}`,
                              label: "New Row",
                              value: "",
                              kind: "text",
                            },
                          ]);
                        const reset = () => {
                          const socs = [...result.socs];
                          const { body_fields: _ignore, ...rest } = socs[idx];
                          socs[idx] = rest;
                          setResult({ ...result, socs });
                        };
                        const updateRow = (
                          i: number,
                          patch: Partial<{ label: string; value: string; kind: "text" | "textarea" }>
                        ) => {
                          const next = [...currentRows];
                          next[i] = { ...next[i], ...patch };
                          setRows(next);
                        };
                        const isCustomized = !!soc.body_fields;
                        const presetSuggestions = [
                          "Nature of Loss",
                          "Claimant",
                          "Sub-line",
                          "Class of Loss",
                          "Cause of Loss",
                          "Coverage",
                          "Sum Insured",
                          "Deductible",
                          "Reserve",
                        ];
                        return (
                          <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">
                            <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
                              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 flex items-baseline gap-2">
                                Slip Body Rows
                                <span className="font-mono normal-case tracking-normal text-slate-400">
                                  {currentRows.length}
                                </span>
                                {isCustomized && (
                                  <span className="text-[9px] tracking-wider text-amber-700 border border-amber-300 px-1 py-px">
                                    customized
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {isCustomized && (
                                  <button
                                    onClick={reset}
                                    className="text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900"
                                  >
                                    Reset to defaults
                                  </button>
                                )}
                                <button
                                  onClick={addRow}
                                  className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black"
                                >
                                  + Add Row
                                </button>
                              </div>
                            </div>
                            <datalist id={`row-label-suggestions-${idx}`}>
                              {presetSuggestions.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                            <div className="border border-slate-200 bg-white">
                              {currentRows.map((r, i) => (
                                <div
                                  key={r.id}
                                  className="flex items-start gap-1.5 px-2 py-1.5 border-b border-slate-100 last:border-b-0"
                                >
                                  <span className="text-[9px] font-mono tabular-nums text-slate-400 w-5 shrink-0 pt-1.5">
                                    {String(i + 1).padStart(2, "0")}
                                  </span>
                                  <div className="flex flex-col shrink-0">
                                    <button
                                      onClick={() => move(i, -1)}
                                      disabled={i === 0}
                                      className="text-[9px] text-slate-500 hover:text-slate-900 disabled:opacity-30 leading-none px-1"
                                      title="위로"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      onClick={() => move(i, 1)}
                                      disabled={i === currentRows.length - 1}
                                      className="text-[9px] text-slate-500 hover:text-slate-900 disabled:opacity-30 leading-none px-1"
                                      title="아래로"
                                    >
                                      ▼
                                    </button>
                                  </div>
                                  <input
                                    value={r.label}
                                    list={`row-label-suggestions-${idx}`}
                                    onChange={(e) =>
                                      updateRow(i, { label: e.target.value })
                                    }
                                    className="w-44 px-1.5 py-1 border border-slate-300 text-[11px] font-bold focus:outline-none focus:border-slate-900"
                                    placeholder="Label"
                                  />
                                  <span className="text-slate-400 pt-1.5">:</span>
                                  {r.kind === "textarea" ? (
                                    <textarea
                                      value={r.value}
                                      rows={2}
                                      onChange={(e) =>
                                        updateRow(i, { value: e.target.value })
                                      }
                                      className="flex-1 min-w-0 px-1.5 py-1 border border-slate-300 text-[11px] focus:outline-none focus:border-slate-900 resize-y"
                                    />
                                  ) : (
                                    <input
                                      value={r.value}
                                      onChange={(e) =>
                                        updateRow(i, { value: e.target.value })
                                      }
                                      className="flex-1 min-w-0 px-1.5 py-1 border border-slate-300 text-[11px] focus:outline-none focus:border-slate-900"
                                    />
                                  )}
                                  <select
                                    value={r.kind || "text"}
                                    onChange={(e) =>
                                      updateRow(i, {
                                        kind: e.target.value as "text" | "textarea",
                                      })
                                    }
                                    className="px-1 py-1 border border-slate-300 text-[10px] font-mono uppercase tracking-wider focus:outline-none focus:border-slate-900 shrink-0"
                                    title="입력 종류"
                                  >
                                    <option value="text">text</option>
                                    <option value="textarea">multi</option>
                                  </select>
                                  <button
                                    onClick={() => remove(i)}
                                    className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] hover:underline px-1 shrink-0 pt-1.5"
                                    title="이 행 삭제"
                                  >
                                    ✖
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-2">
                              라벨/값 자유 편집. 보험사별 명칭 차이는 라벨을 직접 수정하세요.
                              순서 변경은 ▲▼, 삭제는 ✖. PDF 출력에 그대로 반영됩니다.
                            </div>
                          </div>
                        );
                      })()}
                      {/* Always mount so PDF download can capture the slip
                          even before the user opens the preview panel. */}
                      <div
                        className={`border-t border-slate-200 bg-[radial-gradient(ellipse_at_top,_rgba(15,23,42,0.06),_transparent_60%)] bg-slate-100 px-6 py-8 flex justify-center overflow-x-auto ${
                          previewIdx === idx ? "" : "hidden"
                        }`}
                      >
                        <div className="border border-slate-300 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.18),0_1px_2px_rgba(15,23,42,0.04)]">
                          <SlipDocument
                              id={`soc-slip-${idx}`}
                              type={docType}
                              toReinsurer={soc.reinsurer}
                              date={formatDateEn(
                                String(
                                  // Slip header Date is the slip generation
                                  // date — falls back to today when the
                                  // operator hasn't set one. DOC (doc_date)
                                  // is now a separate Claim Detail field.
                                  ext?.slip_date || todayIso()
                                )
                              )}
                              subTitle={
                                ext?.title_subline ? String(ext.title_subline) : undefined
                              }
                              cedantRef={String(ext?.ref_no || "Refer to the list")}
                              reinsured={String(
                                soc.cedant_full_name ||
                                  ext?.reinsured ||
                                  ext?.cedant ||
                                  soc.cedant ||
                                  "N/A"
                              )}
                              insured={stripCorpSuffix(
                                pickSlipText(
                                  ext,
                                  displayLang === "en",
                                  "account_name"
                                ) || String(ext?.account_name || "")
                              )}
                              claimType={
                                pickSlipText(ext, displayLang === "en", "line") ||
                                String(ext?.line || "N/A")
                              }
                              policyPeriod={formatDateEn(
                                String(
                                  ext?.policy_period ||
                                    (result?.policy
                                      ? `Refer to ${result?.policy.cover_note_no}`
                                      : "N/A")
                                )
                              )}
                              dol={formatDateEn(String(ext?.dol || "TBD"))}
                              locationOfLoss={
                                pickSlipText(ext, displayLang === "en", "location_of_loss") || "-"
                              }
                              natureOfLoss={
                                pickSlipText(ext, displayLang === "en", "nature_of_loss") || undefined
                              }
                              particulars={
                                pickSlipText(ext, displayLang === "en", "particulars") || "-"
                              }
                              remarks={pickSlipText(ext, displayLang === "en", "remarks") || "-"}
                              currency={String(soc.currency || ext?.currency || "KRW")}
                              {...(() => {
                                // AI returns total_amount = the document's "Total"
                                // cell (already includes any Expenses Reserve column).
                                // claim = total - expense; expense from separate column.
                                // For per-currency slip variants we derive the
                                // headline figures from the slip's own claim
                                // subset so each variant only carries its own
                                // ISO totals (never auto-summed across ccys).
                                if (soc.claims_subset && soc.claims_subset.length > 0) {
                                  const claimSum = soc.claims_subset.reduce(
                                    (a, c) => a + (Number(c.claim_amount_100) || 0),
                                    0
                                  );
                                  const expSum = soc.claims_subset.reduce(
                                    (a, c) => a + (Number(c.expense_100) || 0),
                                    0
                                  );
                                  return {
                                    claimAmount100: claimSum,
                                    expense100: expSum,
                                    total100: claimSum + expSum,
                                  };
                                }
                                const totalAmt = Number(ext?.total_amount || 0);
                                const expensesAmt = Number(ext?.expenses_reserve || 0);
                                const claimAmt = totalAmt - expensesAmt;
                                return {
                                  claimAmount100: claimAmt,
                                  expense100: expensesAmt,
                                  total100: totalAmt,
                                };
                              })()}
                              yourShare={soc.share}
                              yourAmount={soc.amount}
                              editable
                              onFieldChange={(field, value) =>
                                handleSlipFieldChange(idx, field, value)
                              }
                              bodyFields={
                                soc.body_fields ||
                                buildDefaultBodyFields(
                                  ext,
                                  displayLang === "en",
                                  result?.policy || null,
                                  soc.cedant_full_name
                                )
                              }
                              onBodyFieldChange={(rowId, value) => {
                                if (!result) return;
                                const current =
                                  soc.body_fields ||
                                  buildDefaultBodyFields(
                                    ext,
                                    displayLang === "en",
                                    result?.policy || null,
                                    soc.cedant_full_name
                                  );
                                const next = current.map((r) =>
                                  r.id === rowId ? { ...r, value } : r
                                );
                                const socs = [...result.socs];
                                socs[idx] = { ...socs[idx], body_fields: next };
                                setResult({ ...result, socs });
                              }}
                              claims={
                                soc.claims ||
                                (ext?.claims as BordereauClaim[] | undefined)
                              }
                              columns={effectiveColumns}
                              onClaimCellChange={(rowIdx, columnKey, value) => {
                                if (!result) return;
                                // Custom-column edit: store the value
                                // on the column itself, not the claim.
                                const col = effectiveColumns.find((c) => c.key === columnKey);
                                if (!col) return;
                                if (col.source.kind === "custom") {
                                  const next = effectiveColumns.map((c) =>
                                    c.key === columnKey && c.source.kind === "custom"
                                      ? {
                                          ...c,
                                          source: {
                                            ...c.source,
                                            valuesByRowIdx: {
                                              ...c.source.valuesByRowIdx,
                                              [rowIdx]: value,
                                            },
                                          },
                                        }
                                      : c
                                  );
                                  setColumnsConfig(next);
                                  return;
                                }
                                if (col.source.kind !== "field") return;
                                // Field edit: coerce numerics back to
                                // number, leave everything else as
                                // string, and push back through the
                                // claims-array update path used by the
                                // in-page editor.
                                const field = col.source.field;
                                const baseClaims =
                                  (soc.claims ||
                                    (ext?.claims as BordereauClaim[] | undefined) ||
                                    []) as BordereauClaim[];
                                const nextClaims = baseClaims.map((c, i) => {
                                  if (i !== rowIdx) return c;
                                  if (field === "claim_amount_100" || field === "expense_100") {
                                    return { ...c, [field]: parseAmount(value) };
                                  }
                                  if (field === "claim_seq") {
                                    const n = parseInt(value, 10);
                                    return { ...c, claim_seq: Number.isFinite(n) ? n : null };
                                  }
                                  return { ...c, [field]: value };
                                });
                                // Propagate identically to the in-page
                                // editor's update path so totals stay
                                // consistent across all reinsurer slips.
                                const extUpdate: Record<string, unknown> = {
                                  ...(result.extracted || {}),
                                  claims: nextClaims,
                                };
                                const newTotal = nextClaims.reduce(
                                  (s, c) =>
                                    s +
                                    (Number(c.claim_amount_100) || 0) +
                                    (Number(c.expense_100) || 0),
                                  0
                                );
                                extUpdate.total_amount = newTotal;
                                const caseCcy = String(ext?.currency || "KRW");
                                const socs = result.socs.map((s) => {
                                  const ccy = String(s.currency || caseCcy);
                                  const amount = newTotal * s.share;
                                  return {
                                    ...s,
                                    claims: nextClaims.map((c) => ({ ...c })),
                                    amount,
                                    amount_fmt: `${ccy} ${fmtAmt(amount, ccy)}`,
                                  };
                                });
                                setResult({ ...result, extracted: extUpdate, socs });
                              }}
                            />
                          </div>
                        </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 px-3 py-2 bg-slate-50 border border-slate-200 text-[11px]">
                  {(() => {
                    // Group totals by per-slip currency so a multi-currency
                    // packet shows one Total per ISO code instead of a
                    // misleading single sum.
                    const byCcy = new Map<string, number>();
                    for (const x of result.socs) {
                      const c = String(x.currency || ext?.currency || "KRW");
                      byCcy.set(c, (byCcy.get(c) || 0) + x.amount);
                    }
                    const rows = Array.from(byCcy.entries());
                    return rows.map(([ccy, amt], i) => (
                      <div key={ccy} className="flex justify-between">
                        <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                          {i === 0 ? "Total" : ""}
                        </span>
                        <span className="font-mono tabular-nums font-bold">
                          {ccy} {fmtAmt(amt, ccy)}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </Card>
            )}

            {/* ─── References ──────────────────────────────────
                Sources used to derive the slip values: original
                uploaded files (with inline PDF preview), DB rows
                actually consumed by the reasoning step (used=true),
                and the AI chain-of-thought + per-SOC justifications. */}
            {result.socs && result.socs.length > 0 &&
              (files.length > 0 || result.evidence || (result.thinking && result.thinking.length > 0)) && (
                <Card emphasis="primary" title="References" subtitle="슬립 값과 출처 자료 매핑">
                  <div className="space-y-6">
                    {/* ── Provenance Map ──────────────────────────────
                        Direct value→source mapping so a reader can trace
                        each slip field back to its origin without
                        scrolling through evidence/reasoning blocks. */}
                    {(() => {
                      type ProvKind = "file" | "ai" | "computed";
                      interface ProvRow {
                        kind: ProvKind;
                        field: string;
                        value: string;
                        detail?: string;
                      }
                      const e = ext as Record<string, unknown>;
                      const fileLabel =
                        files.length === 0
                          ? "(no source files)"
                          : files.length === 1
                          ? files[0].name
                          : `${files.length} uploaded files`;

                      const truncate = (s: string, n: number) =>
                        s.length > n ? `${s.slice(0, n)}…` : s;

                      const commonRows: ProvRow[] = [];
                      const pushFile = (
                        field: string,
                        value: string,
                        detail?: string
                      ) => {
                        if (!value || value === "-" || value === "—") return;
                        commonRows.push({ kind: "file", field, value, detail });
                      };

                      if (e.account_name) {
                        const raw = String(e.account_name);
                        const stripped = stripCorpSuffix(raw);
                        pushFile(
                          "Insured",
                          stripped || raw,
                          stripped !== raw
                            ? `extracted "${raw}" → corp suffix stripped`
                            : `from PDF body · ${fileLabel}`
                        );
                      }
                      if (e.reinsured)
                        pushFile(
                          "Reinsured",
                          String(e.reinsured),
                          `from "From:" / sender · ${fileLabel}`
                        );
                      if (e.line)
                        pushFile(
                          "Type",
                          String(e.line),
                          `from PDF Type field · LoB prefix preserved`
                        );
                      if (e.policy_period) {
                        const raw = String(e.policy_period);
                        const formatted = formatDateEn(raw);
                        pushFile(
                          "Policy Period",
                          formatted,
                          formatted !== raw ? `extracted "${raw}"` : `from PDF`
                        );
                      }
                      if (e.dol) {
                        const raw = String(e.dol);
                        const formatted = formatDateEn(raw);
                        pushFile(
                          "Date of Loss",
                          formatted,
                          formatted !== raw ? `extracted "${raw}"` : `from PDF`
                        );
                      }
                      if (e.location_of_loss)
                        pushFile(
                          "Location of Loss",
                          String(e.location_of_loss),
                          `from PDF · Korean spacing preserved`
                        );
                      if (e.nature_of_loss)
                        pushFile(
                          "Nature of Loss",
                          String(e.nature_of_loss),
                          `from PDF body`
                        );
                      if (e.particulars)
                        pushFile(
                          "Particulars",
                          truncate(String(e.particulars), 80),
                          `from PDF Particulars of Loss`
                        );
                      if (e.ref_no)
                        pushFile(
                          "Cedant's Ref",
                          String(e.ref_no),
                          `from PDF body and/or filename`
                        );
                      if (e.currency)
                        pushFile(
                          "Currency",
                          String(e.currency),
                          `from PDF Settlement table`
                        );
                      const totalAmt = Number(e.total_amount || 0);
                      const expensesAmt = Number(e.expenses_reserve || 0);
                      const claimAmt = totalAmt - expensesAmt;
                      const provCcy = String(e.currency || "KRW");
                      if (totalAmt)
                        pushFile(
                          "Total (100%)",
                          fmtAmt(totalAmt, provCcy),
                          `from PDF Settlement total`
                        );
                      if (expensesAmt)
                        pushFile(
                          "Expenses Reserve",
                          fmtAmt(expensesAmt, provCcy),
                          `from PDF separate Expenses column`
                        );
                      if (totalAmt && expensesAmt)
                        commonRows.push({
                          kind: "computed",
                          field: "Claim Amount (100%)",
                          value: fmtAmt(claimAmt, provCcy),
                          detail: `${fmtAmt(totalAmt, provCcy)} − ${fmtAmt(expensesAmt, provCcy)}`,
                        });
                      if (e.title_subline)
                        pushFile(
                          "Title Subline",
                          String(e.title_subline),
                          `from PDF title box · second line`
                        );
                      if (e.doc_date)
                        pushFile(
                          "Document Date",
                          formatDateEn(String(e.doc_date)),
                          `from PDF letterhead · Date field`
                        );

                      const dotCls = (k: ProvKind) =>
                        k === "file"
                          ? "bg-emerald-500"
                          : k === "ai"
                          ? "bg-amber-500"
                          : "bg-slate-300";
                      const kindLabel = (k: ProvKind) =>
                        k === "file"
                          ? "FILE"
                          : k === "ai"
                          ? "AI"
                          : "COMPUTED";

                      const Row = ({ r }: { r: ProvRow }) => (
                        <div className="px-3 py-2 border-b border-slate-100 last:border-b-0 flex items-start gap-3 hover:bg-slate-50/60">
                          <span
                            className={`w-1.5 h-1.5 rounded-full mt-1.5 ${dotCls(
                              r.kind
                            )} shrink-0`}
                            aria-label={kindLabel(r.kind)}
                          />
                          <div className="grid grid-cols-[120px_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 flex-1 text-[11px] items-baseline">
                            <div className="font-mono uppercase tracking-[0.15em] text-slate-500 text-[9.5px] pt-px">
                              {r.field}
                            </div>
                            <div className="font-semibold text-slate-900 tabular-nums break-words">
                              {r.value}
                            </div>
                            <div className="text-slate-500 text-[10.5px] leading-snug">
                              {r.detail || "—"}
                            </div>
                          </div>
                        </div>
                      );

                      const SectionHead = ({
                        children,
                        tone = "files",
                      }: {
                        children: React.ReactNode;
                        tone?: "files" | "soc";
                      }) => (
                        <div
                          className={`px-3 py-1.5 border-b border-slate-200 flex items-center gap-2 ${
                            tone === "files"
                              ? "bg-emerald-50/70 border-l-2 border-l-emerald-500"
                              : "bg-amber-50/70 border-l-2 border-l-amber-500"
                          }`}
                        >
                          <span
                            className={`text-[9px] font-mono uppercase tracking-[0.25em] ${
                              tone === "files" ? "text-emerald-800" : "text-amber-800"
                            }`}
                          >
                            {children}
                          </span>
                        </div>
                      );

                      return (
                        <div>
                          <div className="mb-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 mb-1">
                              How This Slip Was Built
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3 flex-wrap">
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                file
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                AI reasoning
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                computed
                              </span>
                            </div>
                          </div>

                          <div className="border border-slate-200">
                            {commonRows.length > 0 && (
                              <>
                                <SectionHead>◉ From Input Files</SectionHead>
                                {commonRows.map((r, i) => (
                                  <Row key={`c-${i}`} r={r} />
                                ))}
                              </>
                            )}

                            {result.socs.map((soc, si) => {
                              const socRows: ProvRow[] = [
                                {
                                  kind: "ai",
                                  field: "To (Reinsurer)",
                                  value: soc.reinsurer,
                                  detail: `AI reasoning · ${soc.confidence || "?"}`,
                                },
                                {
                                  kind: "ai",
                                  field: "Your Share",
                                  value: soc.share_pct,
                                  detail: soc.reasoning
                                    ? `${soc.confidence || "?"}: ${truncate(
                                        soc.reasoning,
                                        90
                                      )}`
                                    : `via ${soc.confidence || "?"}`,
                                },
                                {
                                  kind: "computed",
                                  field: "Your Amount",
                                  value: fmtAmt(soc.amount, soc.currency || provCcy),
                                  detail: totalAmt
                                    ? `${fmtAmt(totalAmt, provCcy)} × ${soc.share_pct} = ${fmtAmt(
                                        soc.amount,
                                        soc.currency || provCcy
                                      )}`
                                    : `${soc.share_pct} of total`,
                                },
                              ];
                              return (
                                <div key={si}>
                                  <SectionHead tone="soc">
                                    ◇ For Reinsurer · {soc.reinsurer}
                                  </SectionHead>
                                  {socRows.map((r, i) => (
                                    <Row key={`s-${si}-${i}`} r={r} />
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Detail Sources ─────────────────────────── */}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 mb-1">
                        Detail Sources
                      </div>
                      <div className="text-[10px] text-slate-500 mb-3">
                        원자료 미리보기 · DB 매칭 · AI 추론 단계
                      </div>
                    </div>

                    {/* Source Files */}
                    {files.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2">
                          <span>● Source Files</span>
                          <span className="font-mono normal-case tracking-normal text-slate-400">
                            {files.length}
                          </span>
                        </div>
                        <div className="border border-slate-200">
                          {files.map((f, i) => {
                            const isPdf = f.name.toLowerCase().endsWith(".pdf");
                            const url = fileUrls.get(i);
                            const ext_ = f.name.split(".").pop()?.toUpperCase() || "";
                            const expanded = refExpandedFile === i;
                            return (
                              <div key={i} className="border-b border-slate-100 last:border-b-0">
                                <div className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[9px] font-mono uppercase tracking-wider border border-slate-300 px-1.5 py-0.5 text-slate-700 shrink-0">
                                      {ext_}
                                    </span>
                                    <span className="text-[12px] truncate text-slate-700">
                                      {f.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                      {(f.size / 1024).toFixed(1)} KB
                                    </span>
                                  </div>
                                  {isPdf && url && (
                                    <button
                                      onClick={() =>
                                        setRefExpandedFile(expanded ? null : i)
                                      }
                                      className="text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 shrink-0"
                                    >
                                      {expanded ? "Close" : "Preview"}
                                    </button>
                                  )}
                                  {!isPdf && (
                                    <span className="text-[9px] uppercase tracking-wider text-slate-400 shrink-0">
                                      Preview not available
                                    </span>
                                  )}
                                </div>
                                {expanded && url && isPdf && (
                                  <div className="bg-slate-100 p-2 border-t border-slate-200">
                                    <iframe
                                      src={url}
                                      className="w-full h-[640px] border border-slate-300 bg-white"
                                      title={f.name}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Database Evidence — only rows the reasoning step
                        actually consumed (used=true). */}
                    {result.evidence && (
                      <>
                        {(() => {
                          const rows = (result.evidence?.past_claims?.rows || []).filter(
                            (r) => r.used
                          );
                          if (!rows.length) return null;
                          return (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2">
                                <span>▲ Past Claims (used in reasoning)</span>
                                <span className="font-mono normal-case tracking-normal text-slate-400">
                                  {rows.length}
                                </span>
                              </div>
                              <div className="border border-slate-200 overflow-x-auto">
                                <table className="w-full text-[11px]">
                                  <thead className="bg-slate-50">
                                    <tr className="text-left text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                      <th className="px-2 py-1.5">Ref</th>
                                      <th className="px-2 py-1.5">Account</th>
                                      <th className="px-2 py-1.5">Reinsurer</th>
                                      <th className="px-2 py-1.5 text-right">Share</th>
                                      <th className="px-2 py-1.5 text-right">KRW</th>
                                      <th className="px-2 py-1.5">DOL</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((r) => (
                                      <tr
                                        key={r.id}
                                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                                        onClick={() =>
                                          router.push(
                                            `/ins/claims/ref/${encodeURIComponent(r.ref_no)}`
                                          )
                                        }
                                      >
                                        <td className="px-2 py-1.5 font-mono text-slate-700">
                                          {r.ref_no}
                                        </td>
                                        <td className="px-2 py-1.5 truncate max-w-[180px]">
                                          {r.account_name}
                                        </td>
                                        <td className="px-2 py-1.5">{r.reinsurer || "—"}</td>
                                        <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                                          {(r.share * 100).toFixed(2)}%
                                        </td>
                                        <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                                          {r.krw_amount ? fmt(r.krw_amount) : "—"}
                                        </td>
                                        <td className="px-2 py-1.5 text-slate-500">
                                          {r.dol || "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}

                        {(() => {
                          const rows = (result.evidence?.contracts?.rows || []).filter(
                            (r) => r.used
                          );
                          if (!rows.length) return null;
                          return (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2">
                                <span>▲ Contracts (used in reasoning)</span>
                                <span className="font-mono normal-case tracking-normal text-slate-400">
                                  {rows.length}
                                </span>
                              </div>
                              <div className="border border-slate-200 overflow-x-auto">
                                <table className="w-full text-[11px]">
                                  <thead className="bg-slate-50">
                                    <tr className="text-left text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                      <th className="px-2 py-1.5">Cover Note</th>
                                      <th className="px-2 py-1.5">Assured</th>
                                      <th className="px-2 py-1.5">Reinsurer</th>
                                      <th className="px-2 py-1.5 text-right">Share</th>
                                      <th className="px-2 py-1.5">Line</th>
                                      <th className="px-2 py-1.5">Period</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((r) => (
                                      <tr
                                        key={r.id}
                                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                                        onClick={() => router.push(`/ins/contracts/${r.id}`)}
                                      >
                                        <td className="px-2 py-1.5 font-mono text-slate-700">
                                          {r.cover_note_no}
                                        </td>
                                        <td className="px-2 py-1.5 truncate max-w-[180px]">
                                          {r.assured}
                                        </td>
                                        <td className="px-2 py-1.5">{r.reinsurer || "—"}</td>
                                        <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                                          {(r.share * 100).toFixed(2)}%
                                        </td>
                                        <td className="px-2 py-1.5">{r.line || "—"}</td>
                                        <td className="px-2 py-1.5 text-slate-500 text-[10px]">
                                          {r.period_from || "—"} ~ {r.period_to || "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}

                        {result.evidence.policy_match && (
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                              ▲ Policy Match
                            </div>
                            <div
                              className="border border-slate-200 px-3 py-2 flex items-center gap-3 text-[11px] hover:bg-slate-50 cursor-pointer"
                              onClick={() =>
                                router.push(
                                  `/ins/policies/${result.evidence!.policy_match!.id}`
                                )
                              }
                            >
                              <span className="font-mono font-bold">
                                {result.evidence.policy_match.cover_note_no}
                              </span>
                              <span className="text-slate-700">
                                {result.evidence.policy_match.assured}
                              </span>
                              <span className="text-slate-400 text-[10px] ml-auto font-mono">
                                score: {result.evidence.policy_match.score}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* AI Reasoning */}
                    {((result.thinking && result.thinking.length > 0) ||
                      result.socs.some((s) => s.reasoning)) && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                          ◆ AI Reasoning
                        </div>
                        {result.thinking && result.thinking.length > 0 && (
                          <div className="border border-slate-200 px-3 py-2 mb-2">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                              Chain of Thought · {result.thinking.length} steps
                            </div>
                            <ol className="text-[11px] text-slate-700 space-y-1.5 list-decimal list-inside marker:text-slate-400">
                              {result.thinking.map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {result.socs.some((s) => s.reasoning) && (
                          <div className="border border-slate-200">
                            {result.socs
                              .filter((s) => s.reasoning)
                              .map((s, i) => (
                                <div
                                  key={i}
                                  className="border-b border-slate-100 last:border-b-0 px-3 py-2"
                                >
                                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
                                    <span className="font-bold text-slate-700 normal-case tracking-normal">
                                      {s.reinsurer}
                                    </span>
                                    <span>{s.share_pct}</span>
                                    {s.confidence && (
                                      <span className="border border-slate-300 px-1 py-px text-[9px]">
                                        {s.confidence}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-700">{s.reasoning}</div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              )}
          </>
        )}
      </div>

      {hover && <RowHoverCard hover={hover} />}

      {result && emailIdx !== null && result.socs[emailIdx] && (() => {
        const idx = emailIdx;
        const soc = result.socs[idx];
        const ext = (result.extracted || {}) as Record<string, unknown>;
        const filename = buildSlipFilename(docType, ext, soc.reinsurer);
        return (
          <EmailComposeModal
            open
            onClose={() => setEmailIdx(null)}
            replyTo={SOC_REPLY_TO}
            suggestions={extractEmails(pasteText)}
            defaultLang={soc.is_foreign ? "en" : "ko"}
            buildDraft={(lang) =>
              buildSlipEmailDraft({
                kind: "claim",
                lang,
                docTypeLabel: SOC_DOC_LABEL[docType],
                docTypeLabelKo: SOC_DOC_LABEL_KO[docType],
                account: String(ext.account_name || ""),
                reinsured: String(soc.cedant_full_name || ext.reinsured || ""),
                reinsurerName: soc.reinsurer,
                line: String(ext.line || ""),
                policyPeriod: String(ext.policy_period || ""),
                reference: String(ext.ref_no || ""),
                attachmentName: filename,
                broker: SOC_BROKER,
              })
            }
            attachmentFilename={filename}
            buildAttachment={async () => {
              const r = await renderSocPdf(idx);
              return r ? r.pdf.output("arraybuffer") : null;
            }}
          />
        );
      })()}
    </div>
  );
}

function parseDolDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const iso = String(s).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`);
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  };
  const en = String(s).match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (en) {
    const m = months[en[1].toLowerCase()];
    if (m) return new Date(`${en[3]}-${m}-${en[2].padStart(2, "0")}`);
  }
  return null;
}

function RowHoverCard({
  hover,
}: {
  hover: {
    kind: "claim" | "contract";
    anchorRect: DOMRect;
    data: PastClaim | ContractRow;
    ext: Record<string, unknown>;
    fileReinsurer?: { name: string; share: number; amount: number };
  };
}) {
  const POPOVER_W = 380;
  const gap = 12;
  let left = hover.anchorRect.right + gap;
  if (left + POPOVER_W > window.innerWidth) {
    left = Math.max(8, hover.anchorRect.left - POPOVER_W - gap);
  }
  const top = Math.max(8, Math.min(hover.anchorRect.top, window.innerHeight - 320));

  const ext = hover.ext;
  const fileRi = hover.fileReinsurer;
  const signals: { label: string; tone: "match" | "warn" | "info" }[] = [];
  let summary = "";
  let extras: [string, string][] = [];

  if (hover.kind === "claim") {
    const c = hover.data as PastClaim;
    summary = c.account_name || "";

    // Match signals
    if (ext.ref_no && c.ref_no && String(c.ref_no).includes(String(ext.ref_no))) {
      signals.push({ label: "REF 완전일치", tone: "match" });
    }
    if (fileRi && Math.abs(c.share - fileRi.share) < 0.001) {
      signals.push({ label: `파일 SHARE 동일 (${(c.share * 100).toFixed(2)}%)`, tone: "match" });
    }
    if (fileRi?.name && c.reinsurer && c.reinsurer.toLowerCase().includes(fileRi.name.toLowerCase())) {
      signals.push({ label: "파일 재보험사 동일", tone: "match" });
    }
    const curDol = parseDolDate(ext.dol as string | undefined);
    const rowDol = parseDolDate(c.dol);
    if (curDol && rowDol) {
      const d = Math.round((curDol.getTime() - rowDol.getTime()) / 86400000);
      signals.push({
        label: `DOL ${d === 0 ? "동일" : `${d > 0 ? "+" : ""}${d}일`}`,
        tone: Math.abs(d) <= 7 ? "match" : "info",
      });
    }
    const curAmt = Number(ext.total_amount || 0);
    if (curAmt && c.krw_amount) {
      const ratio = c.krw_amount / curAmt;
      if (Math.abs(ratio - 1) < 0.05)
        signals.push({ label: "금액 ±5% 내 일치", tone: "match" });
      else if (ratio > 0)
        signals.push({ label: `금액 ${(ratio * 100).toFixed(0)}% of 현재`, tone: "info" });
    }
    if (c.used) signals.push({ label: "AI 참조됨", tone: "match" });

    // Extras not in row
    if (c.nature_of_loss) extras.push(["Nature of Loss", c.nature_of_loss]);
    if (c.usd_amount) extras.push(["Amount (USD)", fmtAmt(c.usd_amount, "USD")]);
  } else {
    const c = hover.data as ContractRow;
    summary = c.assured || "";

    if (fileRi && Math.abs(c.share - fileRi.share) < 0.001) {
      signals.push({ label: `파일 SHARE 동일 (${(c.share * 100).toFixed(2)}%)`, tone: "match" });
    }
    if (fileRi?.name && c.reinsurer && c.reinsurer.toLowerCase().includes(fileRi.name.toLowerCase())) {
      signals.push({ label: "파일 재보험사 동일", tone: "match" });
    }
    const curDol = parseDolDate(ext.dol as string | undefined);
    const pFrom = parseDolDate(c.period_from);
    const pTo = parseDolDate(c.period_to);
    if (curDol && pFrom && pTo) {
      if (curDol >= pFrom && curDol <= pTo)
        signals.push({ label: "DOL 보험기간 내", tone: "match" });
      else
        signals.push({ label: "DOL 보험기간 밖", tone: "warn" });
    }
    if (ext.line && c.line && String(ext.line).toLowerCase() === c.line.toLowerCase()) {
      signals.push({ label: "종목 일치", tone: "match" });
    }
    if (c.used) signals.push({ label: "AI 참조됨", tone: "match" });

    if (c.ri_prem) extras.push(["RI Prem", fmt(c.ri_prem)]);
    if (c.workflow_status) extras.push(["Status", c.workflow_status]);
    if (c.gross_prem_100) extras.push(["Gross Prem (100%)", fmt(c.gross_prem_100)]);
    extras.push(["Full Period", `${c.period_from || "—"} ~ ${c.period_to || "—"}`]);
  }

  const toneClass = (t: "match" | "warn" | "info") =>
    t === "match"
      ? "bg-emerald-50 border-emerald-600 text-emerald-800"
      : t === "warn"
      ? "bg-amber-50 border-amber-600 text-amber-800"
      : "bg-slate-50 border-slate-400 text-slate-700";

  return (
    <div
      className="fixed z-50 bg-white border border-slate-900 shadow-lg pointer-events-none"
      style={{ top, left, width: POPOVER_W }}
    >
      <div className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-between">
        <span>{hover.kind === "claim" ? "Past Claim" : "Contract"} · Detail</span>
        <span className="text-slate-400 text-[9px] font-mono normal-case tracking-normal">
          click → open
        </span>
      </div>
      {summary && (
        <div className="px-3 pt-2.5 pb-1.5 border-b border-slate-100">
          <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">
            Assured
          </div>
          <div className="text-[12px] font-semibold text-slate-900 break-words leading-snug">
            {summary}
          </div>
        </div>
      )}

      {signals.length > 0 && (
        <div className="px-3 pt-2 pb-2 border-b border-slate-100">
          <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1.5">
            Match Signals
          </div>
          <div className="flex flex-wrap gap-1">
            {signals.map((s, i) => (
              <span
                key={i}
                className={`text-[10px] px-1.5 py-0.5 border-l-2 ${toneClass(s.tone)}`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {extras.length > 0 && (
        <div className="px-3 pt-2 pb-2">
          <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1">
            Extra
          </div>
          <table className="w-full">
            <tbody>
              {extras.map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 pr-2 text-[10px] uppercase tracking-wider text-slate-500 align-top w-[40%]">
                    {k}
                  </td>
                  <td className="py-0.5 text-[11px] text-slate-900 font-mono break-words">
                    {v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {signals.length === 0 && extras.length === 0 && (
        <div className="px-3 py-3 text-[11px] text-slate-400 italic">
          추가 매칭 정보 없음 — 클릭해서 상세 페이지 열기
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`text-[12px] text-slate-900 font-semibold mt-0.5 ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function MatchLine({
  ok,
  label,
  detail,
}: {
  ok?: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          ok ? "bg-emerald-700" : "bg-slate-900"
        }`}
      />
      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-700">
        {label}
      </span>
      <span className="text-slate-500">— {detail}</span>
    </div>
  );
}
