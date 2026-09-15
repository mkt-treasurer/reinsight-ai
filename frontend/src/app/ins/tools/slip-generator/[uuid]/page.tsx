"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import SlipDocument, { SlipType } from "@/components/SlipDocument";
import { fetchApi } from "@/lib/api";

// Capture the rendered slip element to a single-page A4 PDF using the same
// html2canvas → jsPDF pipeline as the main slip-generator page. Element is
// always mounted (even when its panel wrapper is hidden) so we restore it
// off-screen for capture, then put it back. Mirrors page.tsx:downloadPdf.
async function capturePdf(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
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
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  try {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const pdf = new jsPDF("p", "mm", "a4");
    // A4 = 210 × 297 mm. Letterbox-fit so a tall slip doesn't overflow.
    const pageW = 210,
      pageH = 297,
      margin = 10;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = canvas.width / canvas.height;
    let imgWidth = maxW,
      imgHeight = imgWidth / ratio;
    if (imgHeight > maxH) {
      imgHeight = maxH;
      imgWidth = imgHeight * ratio;
    }
    const x = (pageW - imgWidth) / 2;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, margin, imgWidth, imgHeight);
    pdf.save(filename);
  } finally {
    el.style.display = "";
    restoreHidden?.();
  }
}

function fmt(val: number): string {
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

// Currency-aware amount formatter. Mirrors the helper on the main slip-
// generator page so detail-view amounts honour the same KRW=0dp / others=2dp
// rule. Kept inline rather than imported because the detail page already
// keeps its own small set of formatting helpers.
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

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

// ISO date (YYYY-MM-DD) for "today" in the user's local time zone. Used
// as the default for the slip-header Date field, separate from DOC
// (the document issue date extracted from the source PDF letterhead).
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Keys whose extracted.text_en[key] translation is exposed via the
// Claim Detail KR/EN toggle. `description` is included even though the
// slip body never renders it — the customer's KR/EN viewer covers all
// uploaded-file text, of which description is the AI's one-line summary.
const TEXT_EN_KEYS = [
  "account_name",
  "line",
  "location_of_loss",
  "nature_of_loss",
  "particulars",
  "remarks",
  "description",
] as const;

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
    /\s*\(?주\)?$/,
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

// Multi-currency fan-out for the saved-case view. Mirrors the helper in
// the main slip-generator page so a stored case that holds USD + KRW
// bordereau rows is auto-split into per-currency slip variants when the
// detail page first loads. Re-running is a no-op once each soc has a
// ``currency`` set.
function splitCaseSocsByCurrency(input: SlipCaseData): SlipCaseData {
  if (!input?.socs || input.socs.length === 0) return input;
  const ext = (input.extracted || {}) as Record<string, unknown>;
  const caseCcy = String(ext.currency || "KRW").toUpperCase();
  const claims = (ext.claims as BordereauClaimLite[] | undefined) || [];
  const fromClaims = Array.from(
    new Set(claims.map((c) => String(c.currency || caseCcy).toUpperCase()))
  );
  const fromCase = Array.isArray(ext.currencies)
    ? (ext.currencies as string[]).map((c) => String(c).toUpperCase())
    : [];
  const ccys = (fromClaims.length > 1 ? fromClaims : fromCase).filter((c) => !!c);
  if (ccys.length <= 1) return input;
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
        const byCcy = ext.total_by_currency as Record<string, number> | undefined;
        const ccyTotal = byCcy && typeof byCcy[ccy] === "number" ? byCcy[ccy] : 0;
        amount = ccyTotal * soc.share;
      }
      splitSocs.push({
        ...soc,
        currency: ccy,
        claims_subset: subset.length > 0 ? subset.map((c) => ({ ...c })) : undefined,
        amount,
        amount_fmt: `${ccy} ${fmtAmt(amount, ccy)}`,
      });
    }
  }
  return { ...input, socs: splitSocs };
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
  is_foreign?: boolean;
  /** Per-slip currency override populated by the multi-currency
   *  fan-out — each variant of a reinsurer pins to its own ISO code. */
  currency?: string;
  /** Subset of bordereau claims belonging to this currency variant.
   *  Lets the slip preview show only the rows for its own ISO code. */
  claims_subset?: BordereauClaimLite[];
}

// Lightweight bordereau claim shape used by the detail page. The full
// shape lives in SlipDocument; we only need the per-row currency + the
// two amount columns for currency-split calculations.
interface BordereauClaimLite {
  currency?: string;
  claim_amount_100?: number;
  expense_100?: number;
  [k: string]: unknown;
}

interface TextEn {
  account_name?: string;
  line?: string;
  location_of_loss?: string;
  nature_of_loss?: string;
  particulars?: string;
  remarks?: string;
}

/** Pick Korean original or English translation based on the operator's
 *  language choice (driven by the Claim Detail KR/EN toggle). Falls
 *  back to Korean when the English translation is missing. */
function pickSlipText(
  ext: Record<string, unknown> | null,
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

interface SlipCaseData {
  id: string;
  doc_type: SlipType;
  status: "processing" | "done" | "error";
  extracted: Record<string, unknown> | null;
  evidence: {
    file_reinsurer?: { name: string; share: number; amount: number };
    past_claims?: { search_method: string; rows: Record<string, unknown>[] };
    contracts?: { search_method: string; rows: Record<string, unknown>[] };
    policy_match?: { id: number; cover_note_no: string; assured: string; score: number } | null;
  } | null;
  thinking: string[] | null;
  policy_match: { id: number; cover_note_no: string; assured: string; score: number } | null;
  socs: Soc[] | null;
  edited_socs: Soc[] | null;
  error_message: string | null;
  last_edited_at: string | null;
  edit_count: number;
  reviewed_at: string | null;
  verdict: "correct" | "needs_fix" | "wrong" | null;
  created_at: string;
  updated_at: string;
}

function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-slate-200 bg-white ${className}`}>
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700 whitespace-nowrap">
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] text-slate-400 truncate">{subtitle}</span>
          )}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function SlipCasePage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);
  const [data, setData] = useState<SlipCaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // In-progress Claim Detail edits — applied to local data on Apply, mirrors
  // the main slip-generator page behavior (no backend persist on this page yet).
  const [draftExt, setDraftExt] = useState<Record<string, unknown> | null>(null);
  // KR/EN toggle drives both the Claim Detail card AND the slip
  // preview. EN mode renders every slip in English (uses text_en);
  // KR mode forces Korean everywhere. Defaults to EN when any SOC is
  // foreign — see langInitialized effect below.
  const [displayLang, setDisplayLang] = useState<"kr" | "en">("kr");
  const langInitialized = useRef(false);
  // On-demand translation status. Mirrors the main slip-generator
  // page's behavior: domestic-only cases don't have text_en yet, so
  // we lazy-translate via POST /api/tools/soc/translate on first EN.
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // Auto-select EN once per case load when any SOC is foreign — the
  // stream pipeline already wrote text_en for these cases, so the
  // slip and Claim Detail should open in English by default.
  useEffect(() => {
    if (!data?.socs?.length) {
      langInitialized.current = false;
      return;
    }
    if (langInitialized.current) return;
    const anyForeign = data.socs.some((s) => s.is_foreign);
    if (anyForeign) setDisplayLang("en");
    langInitialized.current = true;
  }, [data?.socs]);

  const switchLang = async (lang: "kr" | "en") => {
    setTranslateError(null);
    setDisplayLang(lang);
    if (lang !== "en" || !data?.extracted) return;
    const existing = data.extracted.text_en as
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
      const e = data.extracted;
      const translated = await fetchApi<Record<string, string>>(
        "/api/tools/soc/translate",
        {
          method: "POST",
          body: JSON.stringify({
            account_name: e.account_name || "",
            line: e.line || "",
            location_of_loss: e.location_of_loss || "",
            nature_of_loss: e.nature_of_loss || "",
            particulars: e.particulars || "",
            remarks: e.remarks || "",
            description: e.description || "",
          }),
        }
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              extracted: prev.extracted
                ? {
                    ...prev.extracted,
                    text_en: {
                      ...translated,
                      ...((prev.extracted.text_en as object) || {}),
                    },
                  }
                : prev.extracted,
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

  useEffect(() => {
    fetchApi<SlipCaseData>(`/api/tools/soc/case/${uuid}`)
      .then((d) => setData(splitCaseSocsByCurrency(d)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [uuid]);

  function parseAmount(v: string): number {
    const n = Number(String(v).replace(/[,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  if (loading) {
    return (
      <div className="-m-5 bg-white text-slate-900 min-h-screen">
        <div className="border-b border-slate-900 px-6 py-4 bg-slate-900 text-white text-[11px] font-bold tracking-[0.2em] uppercase">
          Loading case · {uuid.slice(0, 8)}…
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="-m-5 bg-white text-slate-900 min-h-screen">
        <div className="border-b border-slate-900 px-6 py-4 bg-slate-900 text-white text-[11px] font-bold tracking-[0.2em] uppercase">
          Slip Case · not found
        </div>
        <div className="px-6 py-5 text-[12px] text-[#b91c1c]">
          {error || "case not found"}{" "}
          <Link href="/ins/tools/slip-generator" className="underline">
            ← back
          </Link>
        </div>
      </div>
    );
  }

  const ext = data.extracted || {};
  const socs = data.edited_socs || data.socs || [];
  const evidence = data.evidence;

  const createdAt = new Date(data.created_at);
  const docType: SlipType = data.doc_type || "SOC";

  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      {/* Masthead */}
      <div className="border-b border-slate-900 px-6 py-4 flex items-center gap-6 bg-slate-900 text-white">
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase">
            Slip Case
          </span>
          <span className="text-[10px] text-slate-400 tracking-wider">
            {docType} · {String(ext.account_name || "—")}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-5 text-[10px] font-mono tabular-nums text-slate-300">
          <span>
            <span className="text-slate-500 mr-1">ID</span>
            {data.id.slice(0, 8)}
          </span>
          <span>
            <span className="text-slate-500 mr-1">CREATED</span>
            {createdAt.toLocaleString("ko-KR", { hour12: false })}
          </span>
          <span
            className={`uppercase tracking-wider ${
              data.status === "done"
                ? "text-emerald-400"
                : data.status === "error"
                ? "text-red-400"
                : "text-amber-400"
            }`}
          >
            {data.status}
          </span>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {data.status === "error" && (
          <Card title="Error" subtitle="처리 실패">
            <div className="text-[12px] text-[#b91c1c]">{data.error_message}</div>
          </Card>
        )}

        {/* Allocation summary */}
        {socs.length > 0 && (
          <Card
            title="Allocation"
            subtitle={`배분 비율 · ${socs.length} reinsurers`}
          >
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Reinsurer</th>
                  <th className="py-2 pr-3 text-right">Share</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {socs.map((s, i) => {
                  // Each soc may carry its own currency in multi-currency
                  // packets; fall back to the case-level ccy otherwise so
                  // the legacy single-currency layout stays unchanged.
                  const socAny = s as { currency?: string };
                  const rowCcy = String(socAny.currency || ext.currency || "KRW");
                  return (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-bold text-slate-900">
                        {s.reinsurer || (
                          <span className="text-slate-300 font-normal">(미입력)</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-700">
                        {(s.share * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {rowCcy} {fmtAmt(s.amount, rowCcy)}
                      </td>
                      <td className="py-2 pr-3 text-[10px] uppercase tracking-wider text-slate-500">
                        {s.confidence || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  // Aggregate by currency so a multi-ccy packet shows
                  // separate totals instead of an auto-summed misleading
                  // figure.
                  const byCcy = new Map<string, number>();
                  for (const x of socs) {
                    const c = String(
                      (x as { currency?: string }).currency || ext.currency || "KRW"
                    );
                    byCcy.set(c, (byCcy.get(c) || 0) + x.amount);
                  }
                  const shareSum = (socs.reduce((a, x) => a + x.share, 0) * 100).toFixed(2);
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
                        {idx === 0 ? `${shareSum}%` : ""}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {ccy} {fmtAmt(amt, ccy)}
                      </td>
                      <td />
                    </tr>
                  ));
                })()}
              </tfoot>
            </table>
          </Card>
        )}

        {/* Claim Detail — editable, mirrors main slip-generator behavior.
            Edits accumulate in draftExt; Apply commits to local data state
            (and re-renders all slips below); Discard reverts. Persistence
            to backend is not wired yet — refreshing the page resets edits. */}
        {(() => {
          const effective = (draftExt ?? ext) as Record<string, unknown>;
          const isDirty = !!draftExt;
          const changedKeys = draftExt
            ? Object.keys(draftExt).filter((k) => {
                const a = draftExt[k];
                const b = (ext || {})[k];
                return (a ?? "") !== (b ?? "");
              })
            : [];
          const applyDraft = () => {
            if (!data || !draftExt) return;
            const extUpdate = { ...(data.extracted || {}), ...draftExt };
            const totalChanged = changedKeys.includes("total_amount");
            // "Reinsured" (synthetic `to_reinsurer`) propagates to every
            // SOC's reinsurer field so the slip "To." line updates.
            // The uuid page's slip body reads ext.reinsured directly,
            // so Cedent edits (key `reinsured`) need no SOC propagation
            // — the ext merge above is enough.
            const reinsurerChanged = "to_reinsurer" in draftExt;
            let nextSocs = data.socs || [];
            if ((totalChanged || reinsurerChanged) && nextSocs.length > 0) {
              const total = Number(extUpdate.total_amount || 0);
              const caseCcy = String(extUpdate.currency || "KRW");
              const newReinsurer = reinsurerChanged
                ? String(extUpdate.to_reinsurer || "")
                : null;
              nextSocs = nextSocs.map((s) => {
                const next: typeof s = { ...s };
                if (totalChanged) {
                  const ccy = String(
                    (s as { currency?: string }).currency || caseCcy
                  );
                  next.amount = total * s.share;
                  next.amount_fmt = `${ccy} ${fmtAmt(total * s.share, ccy)}`;
                }
                if (newReinsurer !== null) {
                  next.reinsurer = newReinsurer;
                }
                return next;
              });
            }
            setData({ ...data, extracted: extUpdate, socs: nextSocs });
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
                      Korean original and extracted.text_en. Domestic-
                      only cases trigger an on-demand /translate call
                      on first EN click. */}
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
                </div>
              }
            >
              <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                {(
                  [
                    ["Assured · 피보험자", "account_name", "text"],
                    // "Cedent · 원수사" — cedant company name; bound to
                    // ext.reinsured (cedant full name from AI). Edits
                    // flow to the slip body's "1. Reinsured" row (slip
                    // body uses ext.reinsured directly here).
                    ["Cedent · 원수사 (→ Reinsured)", "reinsured", "text"],
                    // "Reinsured · 재보험사" — slip-header "To." target;
                    // synthetic key, propagates to every SOC on Apply.
                    ["Reinsured · 재보험사 (→ To.)", "to_reinsurer", "text"],
                    ["Line · 종목", "line", "text"],
                    ["Ref No", "ref_no", "text"],
                    ["DOL · 사고일", "dol", "text"],
                    // DOC = document issue date from the PDF letterhead.
                    ["DOC · 문서일자", "doc_date", "text"],
                    // Date = slip generation date (today by default).
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
                    (effective.text_en as Record<string, string> | undefined) ||
                    undefined;
                  const enValue =
                    displayLang === "en" &&
                    (TEXT_EN_KEYS as readonly string[]).includes(key)
                      ? textEn?.[key]
                      : undefined;
                  const enReadOnly = !!enValue;
                  const rawOrig = effective[key];
                  // Synthetic "to_reinsurer" mirrors the first SOC's
                  // reinsurer until the user edits — their value then
                  // propagates to every SOC on Apply.
                  const firstSocReinsurer =
                    (data?.socs && data.socs[0]?.reinsurer) || "";
                  const raw =
                    key === "slip_date" && (rawOrig == null || rawOrig === "")
                      ? todayIso()
                      : key === "to_reinsurer" &&
                        (rawOrig == null || rawOrig === "")
                      ? firstSocReinsurer
                      : rawOrig;
                  const origRaw = ext ? ext[key] : undefined;
                  const changed = isDirty && changedKeys.includes(key);
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
                        } ${kind === "number" ? "font-mono tabular-nums" : ""} ${
                          kind === "textarea" ? "whitespace-pre-wrap" : ""
                        } ${enReadOnly ? "opacity-80" : ""}`}
                        contentEditable={!enReadOnly}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          if (enReadOnly) return;
                          const v = e.currentTarget.textContent || "";
                          const cur =
                            kind === "number"
                              ? String(parseAmount(v))
                              : v;
                          // Phantom-edit guards. Derived fields (slip_date
                          // → today, to_reinsurer → first SOC reinsurer)
                          // need orig to match raw when the user merely
                          // tabs through; else the diff comparison
                          // fires and the row is marked edited.
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
                              return Object.keys(rest).length ? rest : null;
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
            </Card>
          );
        })()}

        {/* References — Provenance Map + Detail Sources */}
        <ReferencesCard
          ext={ext}
          socs={socs}
          evidence={evidence}
          thinking={data.thinking || []}
          inputFiles={
            ((data as unknown as { input_files?: { name: string; suffix: string }[] })
              .input_files) || []
          }
        />

        {/* Slip previews */}
        {socs.length > 0 && (
          <Card title="Slip Documents" subtitle={`${socs.length} · ${docType}`}>
            <div className="space-y-4">
              {socs.map((soc, idx) => (
                <div key={idx} className="border border-slate-300">
                  <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3 text-[11px] min-w-0">
                      <span className="text-[9px] font-mono tabular-nums text-slate-400 shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="font-bold text-slate-900 truncate">
                        {soc.reinsurer || "—"}
                      </span>
                      <span className="font-mono tabular-nums text-slate-600 shrink-0">
                        {soc.share_pct}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                        {soc.amount_fmt || `${fmt(soc.amount)}`}
                      </span>
                      {soc.confidence && (
                        <span className="text-[9px] font-mono uppercase tracking-wider border border-slate-300 px-1.5 py-0.5 text-slate-700 shrink-0">
                          {soc.confidence}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        capturePdf(
                          `slip-${idx}`,
                          `${docType}_${(soc.reinsurer || "Unknown").replace(
                            /[\/\\:*?"<>|\s]+/g,
                            "_"
                          )}.pdf`
                        )
                      }
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-900 hover:underline shrink-0"
                    >
                      Download PDF
                    </button>
                  </div>
                  <SlipDocument
                    id={`slip-${idx}`}
                    type={docType}
                    toReinsurer={soc.reinsurer}
                    date={formatDateEn(
                      // Slip header Date is the slip generation date —
                      // defaults to today when not set. DOC (doc_date) is
                      // shown as a separate Claim Detail field.
                      String(ext.slip_date || todayIso())
                    )}
                    subTitle={ext.title_subline ? String(ext.title_subline) : undefined}
                    cedantRef={String(ext.ref_no || "Refer to the list")}
                    reinsured={String(ext.reinsured || ext.cedant || soc.cedant || "N/A")}
                    insured={stripCorpSuffix(
                      pickSlipText(ext, displayLang === "en", "account_name") ||
                        String(ext.account_name || "")
                    )}
                    claimType={
                      pickSlipText(ext, displayLang === "en", "line") ||
                      String(ext.line || "N/A")
                    }
                    policyPeriod={formatDateEn(String(ext.policy_period || "N/A"))}
                    dol={formatDateEn(String(ext.dol || "TBD"))}
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
                    currency={String(
                      (soc as { currency?: string }).currency || ext.currency || "KRW"
                    )}
                    {...(() => {
                      // Per-currency slip variants narrow the headline
                      // figures down to the variant's own claim subset
                      // (set during multi-currency split).
                      const socAny = soc as {
                        claims_subset?: { claim_amount_100?: number; expense_100?: number }[];
                      };
                      if (socAny.claims_subset && socAny.claims_subset.length > 0) {
                        const claimSum = socAny.claims_subset.reduce(
                          (a, c) => a + (Number(c.claim_amount_100) || 0),
                          0
                        );
                        const expSum = socAny.claims_subset.reduce(
                          (a, c) => a + (Number(c.expense_100) || 0),
                          0
                        );
                        return {
                          claimAmount100: claimSum,
                          expense100: expSum,
                          total100: claimSum + expSum,
                        };
                      }
                      const totalAmt = Number(ext.total_amount || 0);
                      const expensesAmt = Number(ext.expenses_reserve || 0);
                      return {
                        claimAmount100: totalAmt - expensesAmt,
                        expense100: expensesAmt,
                        total100: totalAmt,
                      };
                    })()}
                    yourShare={soc.share}
                    yourAmount={soc.amount}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
          <Link href="/ins/tools/slip-generator" className="hover:text-slate-900">
            ← New case
          </Link>
          <span className="font-mono tabular-nums">
            edits {data.edit_count} · updated{" "}
            {new Date(data.updated_at).toLocaleString("ko-KR", {
              hour12: false,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── ReferencesCard ───────────────────────────────────────────────
   Same provenance map + detail-source layout as the main slip-generator
   page, adapted for the permalink view: original uploaded files are not
   in memory (only their names from data.input_files), so the Source Files
   section lists metadata without a PDF preview. */
function ReferencesCard({
  ext,
  socs,
  evidence,
  thinking,
  inputFiles,
}: {
  ext: Record<string, unknown>;
  socs: Soc[];
  evidence: SlipCaseData["evidence"];
  thinking: string[];
  inputFiles: { name: string; suffix: string }[];
}) {
  const hasAnything =
    socs.length > 0 ||
    inputFiles.length > 0 ||
    evidence ||
    thinking.length > 0;
  if (!hasAnything) return null;

  type ProvKind = "file" | "ai" | "computed";
  interface ProvRow {
    kind: ProvKind;
    field: string;
    value: string;
    detail?: string;
  }
  const fileLabel =
    inputFiles.length === 0
      ? "(no source files recorded)"
      : inputFiles.length === 1
      ? inputFiles[0].name
      : `${inputFiles.length} uploaded files`;

  const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

  const commonRows: ProvRow[] = [];
  const pushFile = (field: string, value: string, detail?: string) => {
    if (!value || value === "-" || value === "—") return;
    commonRows.push({ kind: "file", field, value, detail });
  };

  if (ext.account_name) {
    const raw = String(ext.account_name);
    const stripped = stripCorpSuffix(raw);
    pushFile(
      "Insured",
      stripped || raw,
      stripped !== raw
        ? `extracted "${raw}" → corp suffix stripped`
        : `from PDF body · ${fileLabel}`
    );
  }
  if (ext.reinsured)
    pushFile("Reinsured", String(ext.reinsured), `from "From:" / sender · ${fileLabel}`);
  if (ext.line)
    pushFile("Type", String(ext.line), "from PDF Type field · LoB prefix preserved");
  if (ext.policy_period) {
    const raw = String(ext.policy_period);
    const formatted = formatDateEn(raw);
    pushFile(
      "Policy Period",
      formatted,
      formatted !== raw ? `extracted "${raw}"` : "from PDF"
    );
  }
  if (ext.dol) {
    const raw = String(ext.dol);
    const formatted = formatDateEn(raw);
    pushFile(
      "Date of Loss",
      formatted,
      formatted !== raw ? `extracted "${raw}"` : "from PDF"
    );
  }
  if (ext.location_of_loss)
    pushFile(
      "Location of Loss",
      String(ext.location_of_loss),
      "from PDF · Korean spacing preserved"
    );
  if (ext.nature_of_loss)
    pushFile("Nature of Loss", String(ext.nature_of_loss), "from PDF body");
  if (ext.particulars)
    pushFile(
      "Particulars",
      truncate(String(ext.particulars), 80),
      "from PDF Particulars of Loss"
    );
  if (ext.ref_no)
    pushFile("Cedant's Ref", String(ext.ref_no), "from PDF body and/or filename");
  if (ext.currency)
    pushFile("Currency", String(ext.currency), "from PDF Settlement table");
  const totalAmt = Number(ext.total_amount || 0);
  const expensesAmt = Number(ext.expenses_reserve || 0);
  const claimAmt = totalAmt - expensesAmt;
  if (totalAmt) pushFile("Total (100%)", fmt(totalAmt), "from PDF Settlement total");
  if (expensesAmt)
    pushFile(
      "Expenses Reserve",
      fmt(expensesAmt),
      "from PDF separate Expenses column"
    );
  if (totalAmt && expensesAmt)
    commonRows.push({
      kind: "computed",
      field: "Claim Amount (100%)",
      value: fmt(claimAmt),
      detail: `${fmt(totalAmt)} − ${fmt(expensesAmt)}`,
    });
  if (ext.title_subline)
    pushFile(
      "Title Subline",
      String(ext.title_subline),
      "from PDF title box · second line"
    );
  if (ext.doc_date)
    pushFile(
      "Document Date",
      formatDateEn(String(ext.doc_date)),
      "from PDF letterhead · Date field"
    );

  const dotCls = (k: ProvKind) =>
    k === "file" ? "bg-emerald-500" : k === "ai" ? "bg-amber-500" : "bg-slate-300";

  const Row = ({ r }: { r: ProvRow }) => (
    <div className="px-3 py-2 border-b border-slate-100 last:border-b-0 flex items-start gap-3 hover:bg-slate-50/60">
      <span
        className={`w-1.5 h-1.5 rounded-full mt-1.5 ${dotCls(r.kind)} shrink-0`}
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

  type EvidenceClaim = {
    id: number;
    ref_no: string;
    account_name: string;
    reinsurer: string | null;
    share: number;
    krw_amount: number;
    dol?: string | null;
    used?: boolean;
  };
  type EvidenceContract = {
    id: number;
    cover_note_no: string;
    assured: string;
    reinsurer: string | null;
    share: number;
    line?: string | null;
    period_from?: string | null;
    period_to?: string | null;
    used?: boolean;
  };
  const pastUsed = (
    (evidence?.past_claims?.rows as unknown as EvidenceClaim[]) || []
  ).filter((r) => r.used);
  const contractsUsed = (
    (evidence?.contracts?.rows as unknown as EvidenceContract[]) || []
  ).filter((r) => r.used);
  const policyMatch = evidence?.policy_match || null;
  const hasReasoning = thinking.length > 0 || socs.some((s) => s.reasoning);

  return (
    <Card title="References" subtitle="슬립 값과 출처 자료 매핑">
      <div className="space-y-6">
        {/* Provenance Map */}
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

            {socs.map((soc, si) => {
              const socRows: ProvRow[] = [
                {
                  kind: "ai",
                  field: "To (Reinsurer)",
                  value: soc.reinsurer,
                  detail: `AI reasoning · ${soc.confidence || "?"}${
                    soc.is_foreign ? " · Foreign (English slip)" : ""
                  }`,
                },
                {
                  kind: "ai",
                  field: "Your Share",
                  value: soc.share_pct,
                  detail: soc.reasoning
                    ? `${soc.confidence || "?"}: ${truncate(soc.reasoning, 90)}`
                    : `via ${soc.confidence || "?"}`,
                },
                {
                  kind: "computed",
                  field: "Your Amount",
                  value: fmt(soc.amount),
                  detail: totalAmt
                    ? `${fmt(totalAmt)} × ${soc.share_pct} = ${fmt(soc.amount)}`
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

        {/* Detail Sources */}
        <div className="pt-2 border-t border-slate-200">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700 mb-1">
            Detail Sources
          </div>
          <div className="text-[10px] text-slate-500 mb-3">
            원자료 메타데이터 · DB 매칭 · AI 추론 단계 (permalink 모드 — PDF
            미리보기는 메인 페이지에서만 가능)
          </div>
        </div>

        {/* Source Files (metadata only on permalink) */}
        {inputFiles.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2">
              <span>● Source Files</span>
              <span className="font-mono normal-case tracking-normal text-slate-400">
                {inputFiles.length}
              </span>
            </div>
            <div className="border border-slate-200">
              {inputFiles.map((f, i) => {
                const ext_ = (f.suffix || "").replace(".", "").toUpperCase();
                return (
                  <div
                    key={i}
                    className="border-b border-slate-100 last:border-b-0 flex items-center gap-2 px-3 py-2 hover:bg-slate-50"
                  >
                    <span className="text-[9px] font-mono uppercase tracking-wider border border-slate-300 px-1.5 py-0.5 text-slate-700 shrink-0">
                      {ext_ || "?"}
                    </span>
                    <span className="text-[12px] truncate text-slate-700">
                      {f.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DB Evidence */}
        {pastUsed.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2">
              <span>▲ Past Claims (used in reasoning)</span>
              <span className="font-mono normal-case tracking-normal text-slate-400">
                {pastUsed.length}
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
                  {pastUsed.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-2 py-1.5 font-mono text-slate-700">
                        <Link
                          href={`/ins/claims/ref/${encodeURIComponent(r.ref_no)}`}
                          className="hover:underline"
                        >
                          {r.ref_no}
                        </Link>
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
        )}

        {contractsUsed.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-2">
              <span>▲ Contracts (used in reasoning)</span>
              <span className="font-mono normal-case tracking-normal text-slate-400">
                {contractsUsed.length}
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
                  {contractsUsed.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-2 py-1.5 font-mono text-slate-700">
                        <Link
                          href={`/ins/contracts/${r.id}`}
                          className="hover:underline"
                        >
                          {r.cover_note_no}
                        </Link>
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
        )}

        {policyMatch && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
              ▲ Policy Match
            </div>
            <Link
              href={`/ins/policies/${policyMatch.id}`}
              className="border border-slate-200 px-3 py-2 flex items-center gap-3 text-[11px] hover:bg-slate-50"
            >
              <span className="font-mono font-bold">{policyMatch.cover_note_no}</span>
              <span className="text-slate-700">{policyMatch.assured}</span>
              <span className="text-slate-400 text-[10px] ml-auto font-mono">
                score: {policyMatch.score}
              </span>
            </Link>
          </div>
        )}

        {/* AI Reasoning */}
        {hasReasoning && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
              ◆ AI Reasoning
            </div>
            {thinking.length > 0 && (
              <div className="border border-slate-200 px-3 py-2 mb-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5">
                  Chain of Thought · {thinking.length} steps
                </div>
                <ol className="text-[11px] text-slate-700 space-y-1.5 list-decimal list-inside marker:text-slate-400">
                  {thinking.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </div>
            )}
            {socs.some((s) => s.reasoning) && (
              <div className="border border-slate-200">
                {socs
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
  );
}
