"use client";

// Placement RQ-slip generator (insightre.ai Facultative placement track).
// EXPERIMENTAL / ISOLATED: upload a cedent's RQ documents → AI extracts the
// placement fields and flags 산출기초 mismatches → edit an INS Corp-format RQ
// slip draft → download. Self-contained; shares no state with the claims Slip
// Generator. Backend: POST /api/tools/rq-slip/extract (stateless).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import EmailComposeModal from "@/components/EmailComposeModal";
import { buildSlipEmailDraft } from "@/lib/slipEmail";
import { extractEmails } from "@/lib/emailRecipients";
import {
  type Discrepancy,
  type RqExtract,
  type SlipType,
  SLIP_TYPES,
  SLIP_META,
  BROKER,
  rqAttachmentName,
} from "./pdf/slipModel";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

interface ReinsurerContact {
  company: string;
  contact: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  remarks: string;
  sheet: string;
  lines: string[];
}

interface ReinsurerMatch {
  line: string;
  matched_sheet: string;
  sub_line: string | null;
  contacts: ReinsurerContact[];
  available_sheets: Record<string, number>;
}

interface CaseSummary {
  id: string;
  insured: string | null;
  line: string | null;
  reinsured: string | null;
  status: string;
  verdict: string | null;
  created_at: string | null;
  updated_at: string | null;
}

type Verdict = "correct" | "needs_fix" | "wrong";
type CaseStatus = "draft" | "reviewed" | "sent";

const STATUS_PILL: Record<CaseStatus, { bg: string; ink: string; label: string }> = {
  draft: { bg: "#e2e8f0", ink: "#334155", label: "Draft" },
  reviewed: { bg: "#bae6fd", ink: "#0c4a6e", label: "Reviewed" },
  sent: { bg: "#bbf7d0", ink: "#14532d", label: "Sent" },
};

const SEVERITY_INK: Record<Discrepancy["severity"], string> = {
  high: "#b91c1c",
  medium: "#b45309",
  low: "#64748b",
};

// Human-readable document names for the delivery-email subject/body. Mirrors
// SLIP_META but phrased for prose rather than the slip masthead.
const RQ_DOC_LABEL: Record<SlipType, string> = {
  RQ: "Request for Quotation",
  Placing: "Placing Order",
  Closing: "Closing Order",
  "Cover Note": "Reinsurance Cover Note",
  "Debit Note": "Debit Note",
};

const RQ_DOC_LABEL_KO: Record<SlipType, string> = {
  RQ: "요율 견적 요청서",
  Placing: "출재 청약서",
  Closing: "출재 확정서",
  "Cover Note": "재보험 커버노트",
  "Debit Note": "차변표(Debit Note)",
};

// Recommended Reply-To for outgoing placement mail. Empty until the broker's
// standard RQ desk address is confirmed; the operator can set it per-email and
// the modal placeholder hints the broker domain (dwins.co.kr).
const RQ_REPLY_TO = "";

// Debit Note has a distinct layout: refs + amount table + bank detail.
const DEBIT_AMOUNTS = [
  "Gross Premium (100%)",
  "R/I Share (%)",
  "R/I Commission (%)",
  "Due from you",
  "Premium Due by (PPW days)",
];

function DebitNoteDoc({
  slip,
  commercial,
  onCommercial,
}: {
  slip: RqExtract;
  commercial: Record<string, string>;
  onCommercial: (k: string, v: string) => void;
}) {
  const cell =
    "w-full bg-transparent text-[12px] text-slate-800 focus:outline-none focus:bg-amber-50 border-b border-dashed border-slate-200 focus:border-slate-400 px-1";
  const editRow = (label: string, key: string) => (
    <div className="grid grid-cols-[170px_1fr] gap-3 py-1.5 border-b border-slate-100">
      <div className="text-[11px] font-bold text-slate-700">{label}</div>
      <input
        value={commercial[key] || ""}
        onChange={(e) => onCommercial(key, e.target.value)}
        className={cell}
        placeholder="—"
      />
    </div>
  );
  const roRow = (label: string, value: string) => (
    <div className="grid grid-cols-[170px_1fr] gap-3 py-1.5 border-b border-slate-100">
      <div className="text-[11px] font-bold text-slate-700">{label}</div>
      <div className="text-[12px] text-slate-800 px-1">{value || "—"}</div>
    </div>
  );
  return (
    <div
      id="rq-slip-doc"
      className="bg-white border border-slate-300 w-full max-w-[820px] px-12 py-10"
    >
      <div className="border-b-2 border-slate-900 pb-3 mb-5">
        <div className="text-[18px] font-bold tracking-tight text-slate-900">{BROKER.name}</div>
        <div className="text-[9px] text-slate-500 mt-1">{BROKER.address}</div>
        <div className="text-[9px] text-slate-500">{BROKER.contact}</div>
      </div>
      <div className="text-[15px] font-bold tracking-[0.15em] text-slate-900 mb-4">DEBIT NOTE</div>
      {editRow("To:", "To")}
      {editRow("Date", "Date")}
      {editRow("Your Ref.", "Your Ref.")}
      {editRow("Our Ref.", "Our Ref.")}
      {editRow("Contact", "Contact")}
      {roRow("Reinsured", slip.reinsured || "")}
      {roRow("Original Insured", slip.insured || "")}
      {roRow("Risk", slip.risk_description || "")}
      {roRow("Period", slip.policy_period || "")}
      <div className="mt-4 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-900">
        Amount (KRW)
      </div>
      {DEBIT_AMOUNTS.map((k) => editRow(k, k))}
      <div className="mt-5 text-[10px] text-slate-600 leading-relaxed border-t border-slate-200 pt-3">
        &lt;Our Bank Detail&gt;
        <br />
        Bank Name : Shinhan Bank (Corporate Investment Banking Center)
        <br />
        Korean Currency : 140-008-142466 · Other Currencies : 180-004-410534
        <br />
        Swift Code : SHBKKRSE
      </div>
      <div className="mt-6">
        <div className="text-[11px] text-slate-600">Sincerely yours,</div>
        <div className="mt-8 border-t border-slate-400 w-56 pt-1">
          <div className="text-[11px] font-bold text-slate-900">{BROKER.signerName}</div>
          <div className="text-[9px] text-slate-600">{BROKER.signerTitle}</div>
          <div className="text-[9px] text-slate-600">{BROKER.name.toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
}

// Presentational helpers defined at MODULE SCOPE (not inside the page
// component) so their component type identity is stable across renders.
// Defining them inline would remount every <input> on each keystroke and
// drop focus — the classic "new component type each render" pitfall.
function SlipRow({
  label,
  children,
  modified,
}: {
  label: string;
  children: React.ReactNode;
  modified?: boolean;
}) {
  return (
    <div className="grid grid-cols-[170px_1fr] gap-4 py-2 border-b border-slate-100">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 pt-1 flex items-center gap-1.5">
        <span>{label}</span>
        {modified && (
          <span
            title="AI 추출본에서 수정됨"
            aria-label="modified"
            className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"
          />
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

// Diff between the immutable AI baseline (`original`) and the current
// `slip`. Powers the per-row "modified" dot and the summary panel above the
// slip doc — both are demo-critical because the value proposition is "AI
// pulled X, operator corrected to Y".
interface DiffEntry {
  key: string;
  label: string;
  before: string;
  after: string;
}

// Headline + body fields shown one-per-row on the slip. Order = render order
// in the doc, so the diff panel reads top-to-bottom like the slip.
const DIFF_FIELDS: { key: keyof RqExtract; label: string }[] = [
  { key: "line", label: "Line" },
  { key: "policy_holder", label: "Policy Holder" },
  { key: "insured", label: "Insured" },
  { key: "location", label: "Location" },
  { key: "reinsured", label: "Reinsured" },
  { key: "risk_description", label: "Covered Risk" },
  { key: "annual_turnover", label: "Annual Turnover" },
  { key: "policy_period", label: "Policy Period" },
  { key: "retroactive_date", label: "Retroactive Date" },
  { key: "limit_of_liability", label: "Limit of Liability" },
  { key: "deductible", label: "Deductible" },
  { key: "territory", label: "Territory" },
  { key: "jurisdiction", label: "Jurisdiction" },
  { key: "currency", label: "Currency" },
  { key: "reference_no", label: "Reference No." },
  { key: "doc_date", label: "Doc Date" },
];

function _norm(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function computeDiff(original: RqExtract | null, slip: RqExtract | null): DiffEntry[] {
  if (!original || !slip) return [];
  const out: DiffEntry[] = [];
  for (const { key, label } of DIFF_FIELDS) {
    const before = _norm(original[key]);
    const after = _norm(slip[key]);
    if (before !== after) out.push({ key: String(key), label, before, after });
  }
  // Terms & Conditions — joined line-by-line so re-ordering shows as a change.
  const beforeCond = (original.conditions || []).map((c) => c.trim()).filter(Boolean).join("\n");
  const afterCond = (slip.conditions || []).map((c) => c.trim()).filter(Boolean).join("\n");
  if (beforeCond !== afterCond) {
    out.push({ key: "conditions", label: "Terms & Conditions", before: beforeCond, after: afterCond });
  }
  // Remarks — free-form block; compared as trimmed text.
  const beforeRemarks = _norm(original.remarks);
  const afterRemarks = _norm(slip.remarks);
  if (beforeRemarks !== afterRemarks) {
    out.push({ key: "remarks", label: "Remarks", before: beforeRemarks, after: afterRemarks });
  }
  // Additional fields — match by label.
  const beforeAf = new Map<string, string>();
  (original.additional_fields || []).forEach((f) =>
    beforeAf.set(f.label || "", _norm(f.value))
  );
  const afterAfLabels = new Set<string>();
  (slip.additional_fields || []).forEach((f) => {
    const label = f.label || "";
    afterAfLabels.add(label);
    const before = beforeAf.get(label) ?? "";
    const after = _norm(f.value);
    if (before !== after) {
      out.push({ key: `af:${label}`, label: `+ ${label}`, before, after });
    }
  });
  // Removed additional fields (present in original, absent in slip).
  for (const [label, before] of beforeAf.entries()) {
    if (!afterAfLabels.has(label) && before) {
      out.push({ key: `af-del:${label}`, label: `+ ${label}`, before, after: "" });
    }
  }
  // Commercial block — keyed by label.
  const beforeC = original.commercial || {};
  const afterC = slip.commercial || {};
  const allCKeys = new Set([...Object.keys(beforeC), ...Object.keys(afterC)]);
  for (const k of allCKeys) {
    const before = _norm(beforeC[k]);
    const after = _norm(afterC[k]);
    if (before !== after) out.push({ key: `c:${k}`, label: k, before, after });
  }
  return out;
}

function DiffSummaryPanel({ diff }: { diff: DiffEntry[] }) {
  const [open, setOpen] = useState(false);
  if (diff.length === 0) {
    return (
      <div className="border border-slate-200 bg-white px-4 py-2.5 flex items-center gap-2 text-[12px]">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
        <span className="text-slate-500">AI 추출본과 동일 — 아직 수정된 필드가 없습니다.</span>
      </div>
    );
  }
  return (
    <div className="border border-amber-300 bg-amber-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-amber-50 transition-colors"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-amber-900">
          AI 추출본 대비 수정
        </span>
        <span className="text-[11px] font-mono tabular-nums text-amber-800">
          {diff.length} field{diff.length !== 1 ? "s" : ""}
        </span>
        <span className="flex-1" />
        <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
          {open ? "접기" : "펼치기"}
        </span>
      </button>
      {open && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {diff.map((d) => (
            <div key={d.key} className="px-4 py-2 grid grid-cols-[160px_1fr] gap-4 items-start">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-900 pt-0.5">
                {d.label}
              </div>
              <div className="text-[12px] leading-relaxed">
                <div className="font-mono text-slate-500 line-through whitespace-pre-wrap break-words">
                  {d.before || "(empty)"}
                </div>
                <div className="font-mono text-slate-900 whitespace-pre-wrap break-words mt-0.5">
                  {d.after || "(empty)"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlipField({
  value,
  onChange,
  multiline = false,
  placeholder = "—",
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const cls =
    "w-full bg-transparent text-[12px] leading-relaxed text-slate-800 focus:outline-none focus:bg-amber-50 px-1 -mx-1 border-b border-dashed border-slate-200 focus:border-slate-400";
  return multiline ? (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={Math.max(2, value.split("\n").length)}
      placeholder={placeholder}
      className={`${cls} resize-y`}
    />
  ) : (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cls}
    />
  );
}

export default function RqSlipPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slip, setSlip] = useState<RqExtract | null>(null);
  const [slipType, setSlipType] = useState<SlipType>("RQ");
  const [emailOpen, setEmailOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reinsurer contact-directory matching (M7). The directory holds PII, so it
  // is uploaded per session and never persisted — kept in component state only.
  const [reMatch, setReMatch] = useState<ReinsurerMatch | null>(null);
  const [reLoading, setReLoading] = useState(false);
  const [reError, setReError] = useState<string | null>(null);
  const [reDir, setReDir] = useState<File | null>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  // Persistence (saved cases). `original` is the immutable AI extract captured
  // at extraction time; `slip` is the editable copy — saving stores both so
  // accuracy (original vs edited) can be reviewed later.
  const [original, setOriginal] = useState<RqExtract | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [reviewVerdict, setReviewVerdict] = useState<Verdict | null>(null);
  const [caseStatus, setCaseStatus] = useState<CaseStatus | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);

  // AI baseline → operator edit diff. Drives the summary panel above the slip
  // and the per-row "modified" dots. Recomputed every render — diff is small.
  const diff = computeDiff(original, slip);
  const diffKeys = new Set(diff.map((d) => d.key));

  // Dirty tracker — JSON snapshot of the last persisted slip. Lets us warn
  // the operator before they close the tab / download a PDF whose edits
  // never reached the server. Stamp this whenever the slip is flushed:
  // save / extract / load / reviewCase / markSent all call setLastSavedJson.
  const [lastSavedJson, setLastSavedJson] = useState<string | null>(null);
  const dirty =
    slip != null && lastSavedJson != null && JSON.stringify(slip) !== lastSavedJson;

  const addFiles = (incoming: FileList | File[]) =>
    setFiles((prev) => [...prev, ...Array.from(incoming)]);
  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => {
    setFiles([]);
    setPasteText("");
    setSlip(null);
    setError(null);
    setLoading(false);
    setReMatch(null);
    setReError(null);
    setReDir(null);
    setSlipType("RQ");
    setOriginal(null);
    setCaseId(null);
    setSavedAt(null);
    setReviewVerdict(null);
    setCaseStatus(null);
    setLastSavedJson(null);
    if (fileRef.current) fileRef.current.value = "";
    if (dirRef.current) dirRef.current.value = "";
    // Strip ?case=<id> so a page reload after "+ New" starts fresh instead
    // of reloading the case the operator just stepped away from.
    if (typeof window !== "undefined" && window.location.search.includes("case=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  // POST the uploaded contact directory + the slip's current line; the backend
  // classifies the line to a sheet/sub-line and returns the contacts to approach.
  const matchReinsurers = async (file: File) => {
    setReLoading(true);
    setReError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("line", slip?.line || "");
      const res = await fetch(`${API_URL}/api/tools/rq-slip/reinsurers`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) setReError(data.error);
      else setReMatch(data as ReinsurerMatch);
    } catch (e) {
      setReError(e instanceof Error ? e.message : "재보험사 매칭 실패");
    } finally {
      setReLoading(false);
    }
  };

  const onDirChosen = (file: File | null) => {
    if (!file) return;
    setReDir(file);
    matchReinsurers(file);
  };

  const CASES_URL = `${API_URL}/api/tools/rq-slip/cases`;

  // Tracks the last loadCases failure so we can surface a backend-down warning
  // on the page rather than silently hiding the saved-drafts panel.
  const [casesFetchError, setCasesFetchError] = useState<string | null>(null);

  const loadCases = async () => {
    try {
      const res = await fetch(CASES_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCases(data.cases || []);
      setCasesFetchError(null);
    } catch (e) {
      // During a live demo a backend timeout will leave the saved-drafts
      // panel empty — explicitly note the failure so it's not mistaken for
      // "no saved cases".
      setCasesFetchError(
        e instanceof Error ? e.message : "케이스 목록 불러오기 실패"
      );
    }
  };

  // "저장됨 ✓" 토스트 auto-fade so it doesn't linger on the masthead long
  // after the save — operator should see it briefly as confirmation.
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  // Guard against accidental tab close / reload while edits are unsaved.
  // The native browser prompt is intentionally generic — text is ignored by
  // modern browsers; what matters is returning a string to trigger it.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Deep link from the /cases queue: ?case=<id> auto-loads that case.
  // Read window.location directly inside useEffect to avoid the Next.js
  // useSearchParams prerender boundary requirement.
  useEffect(() => {
    loadCases();
    if (typeof window !== "undefined") {
      const id = new URLSearchParams(window.location.search).get("case");
      if (id) loadCase(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save the current draft — PATCH if it already has an id, else POST a new case.
  const saveCase = async () => {
    if (!slip) return;
    setSaving(true);
    setError(null);
    try {
      const res = caseId
        ? await fetch(`${CASES_URL}/${caseId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slip }),
          })
        : await fetch(CASES_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              insured: slip.insured,
              line: slip.line,
              reinsured: slip.reinsured,
              extracted: original || slip,
              slip,
            }),
          });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCaseId(data.id);
      setSavedAt(Date.now());
      setCaseStatus((data.status as CaseStatus) || "draft");
      setLastSavedJson(JSON.stringify(slip));
      loadCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const loadCase = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`${CASES_URL}/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const ext = (data.extracted || {}) as RqExtract;
      const edited = data.slip && Object.keys(data.slip).length ? (data.slip as RqExtract) : ext;
      const slipForState = { conditions: [], discrepancies: [], ...edited };
      setOriginal({ conditions: [], discrepancies: [], ...ext });
      setSlip(slipForState);
      setCaseId(data.id);
      setReviewVerdict((data.verdict as Verdict) || null);
      setCaseStatus((data.status as CaseStatus) || "draft");
      setSavedAt(null);
      setLastSavedJson(JSON.stringify(slipForState));
      setReMatch(null);
      setReDir(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    }
  };

  const reviewCase = async (verdict: Verdict) => {
    if (!caseId) {
      setError("먼저 저장한 뒤 검토 판정을 기록할 수 있습니다.");
      return;
    }
    setReviewVerdict(verdict);
    // Verdict click promotes draft → reviewed but does NOT regress sent → reviewed.
    const nextStatus: CaseStatus = caseStatus === "sent" ? "sent" : "reviewed";
    setCaseStatus(nextStatus);
    const snapshot = slip;
    try {
      // Include the current slip so verdict-click also flushes any pending
      // local edits — otherwise reviewing a case the operator just tweaked
      // would silently discard those tweaks on the server.
      await fetch(`${CASES_URL}/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, status: nextStatus, slip: snapshot }),
      });
      if (snapshot) setLastSavedJson(JSON.stringify(snapshot));
      loadCases();
    } catch {
      setError("검토 판정 저장 실패");
    }
  };

  // Final step: mark the slip as sent to the reinsurer. Requires the case to
  // be saved and reviewed first — the queue page filters on this status to
  // separate work-in-progress from completed placements.
  const markSent = async () => {
    if (!caseId) {
      setError("먼저 저장한 뒤 발송 처리할 수 있습니다.");
      return;
    }
    const prev = caseStatus;
    setCaseStatus("sent");
    const snapshot = slip;
    try {
      // Same rationale as reviewCase — include slip so the sent record
      // reflects the operator's final edits, not a stale draft.
      const res = await fetch(`${CASES_URL}/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent", slip: snapshot }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (snapshot) setLastSavedJson(JSON.stringify(snapshot));
      loadCases();
    } catch {
      setCaseStatus(prev); // roll back optimistic update
      setError("발송 처리 저장 실패");
    }
  };

  const extract = async () => {
    if (!files.length && !pasteText.trim()) return;
    setLoading(true);
    setError(null);
    setSlip(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      if (pasteText.trim()) fd.append("text", pasteText);
      const res = await fetch(`${API_URL}/api/tools/rq-slip/extract`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        const ext = (data.extracted || {}) as RqExtract;
        const base = { conditions: [], discrepancies: [], ...ext };
        setOriginal(base); // immutable AI baseline
        setSlip(base);
        setCaseId(null); // a fresh extraction is a new, unsaved case
        setSavedAt(null);
        setReviewVerdict(null);
        setCaseStatus(null);
        // Treat the fresh extract as "clean" baseline — any subsequent
        // edit immediately flips dirty=true.
        setLastSavedJson(JSON.stringify(base));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "추출 실패");
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof RqExtract, value: string) =>
    setSlip((prev) => (prev ? { ...prev, [key]: value } : prev));

  const updateAdditionalField = (idx: number, value: string) =>
    setSlip((prev) =>
      prev
        ? {
            ...prev,
            additional_fields: (prev.additional_fields || []).map((f, i) =>
              i === idx ? { ...f, value } : f
            ),
          }
        : prev
    );

  // Manual correction of AI-surfaced extra rows, matching slip-generator:
  // operators can rename a mislabelled row, delete a wrong/duplicate row, or
  // add a field the AI missed entirely. New rows are tagged source:"manual"
  // so the diff panel can distinguish operator-added from AI-extracted.
  const updateAdditionalFieldLabel = (idx: number, label: string) =>
    setSlip((prev) =>
      prev
        ? {
            ...prev,
            additional_fields: (prev.additional_fields || []).map((f, i) =>
              i === idx ? { ...f, label } : f
            ),
          }
        : prev
    );

  const removeAdditionalField = (idx: number) =>
    setSlip((prev) =>
      prev
        ? {
            ...prev,
            additional_fields: (prev.additional_fields || []).filter((_, i) => i !== idx),
          }
        : prev
    );

  const addAdditionalField = () =>
    setSlip((prev) =>
      prev
        ? {
            ...prev,
            additional_fields: [
              ...(prev.additional_fields || []),
              { label: "", value: "", source: "manual" },
            ],
          }
        : prev
    );

  const updateCommercial = (key: string, value: string) =>
    setSlip((prev) =>
      prev ? { ...prev, commercial: { ...(prev.commercial || {}), [key]: value } } : prev
    );

  // Render the slip into a jsPDF document and return it with its filename.
  // Shared by the direct "Download PDF" action and the email-compose flow
  // (which needs the bytes to attach rather than save). Returns null on
  // failure — the caller surfaces the error to the operator.
  // Build the slip as a TEXT-based PDF (real, selectable text + embedded
  // Korean font) instead of an html2canvas raster. See ./pdf/slipDoc.ts.
  // Returns a jsPDF so BOTH the download and the .eml attachment flow are
  // unchanged (they call .save() / .output()).
  const renderSlipPdf = async (): Promise<{
    pdf: import("jspdf").jsPDF;
    filename: string;
  } | null> => {
    if (!slip) {
      setError("슬립 데이터가 없어 PDF를 생성할 수 없습니다.");
      return null;
    }
    try {
      const { jsPDF } = await import("jspdf");
      const { drawSlipPdf } = await import("./pdf/slipDoc");
      const { registerSlipFont, loadSlipImages } = await import("./pdf/fonts");
      const pdf = new jsPDF("p", "mm", "a4");
      const fontFamily = await registerSlipFont(pdf);
      const { logoDataUrl, signatureDataUrl } = await loadSlipImages();
      drawSlipPdf(pdf, slip, slipType, { fontFamily, logoDataUrl, signatureDataUrl });
      return { pdf, filename: rqAttachmentName(slip, slipType) };
    } catch (e) {
      // Font fetch / render failures would otherwise vanish silently. Surface
      // so the operator can retry rather than wonder why nothing happened.
      setError(
        `PDF 생성 실패: ${e instanceof Error ? e.message : String(e)} — 새로고침 후 다시 시도해 주세요.`
      );
      return null;
    }
  };

  const downloadPdf = async () => {
    const result = await renderSlipPdf();
    if (result) result.pdf.save(result.filename);
  };

  return (
    <div className="-m-5 bg-white text-slate-900 min-h-screen">
      {/* Masthead */}
      <div className="border-b border-slate-900 px-6 py-4 flex items-center gap-6 bg-slate-900 text-white">
        <div className="flex items-baseline gap-3 shrink-0">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase">
            RQ Slip · Placement
          </span>
          <span className="text-[10px] text-slate-400 tracking-wider hidden md:inline">
            원수사 RQ → AI 추출 → INS Corp 양식 슬립 초안
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums text-slate-300 shrink-0">
          <span className="hidden lg:inline">
            <span className="text-slate-500 mr-1">TOOL</span>RQ/v0 · experimental
          </span>
          {slip && (
            <>
              {dirty && (
                <span
                  className="text-[10px] text-amber-300 normal-case tracking-normal"
                  title="저장되지 않은 편집 — Save 또는 검토 판정 클릭 시 함께 저장됩니다"
                >
                  ● 미저장 편집
                </span>
              )}
              {savedAt && !dirty && (
                <span className="text-[10px] text-emerald-400 normal-case tracking-normal">
                  저장됨 ✓
                </span>
              )}
              <button
                onClick={saveCase}
                disabled={saving}
                className="px-3 py-1.5 border border-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] text-white hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40"
              >
                {saving ? "Saving…" : caseId ? "Update" : "Save"}
              </button>
              <button
                onClick={downloadPdf}
                className="px-3 py-1.5 border border-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] text-white hover:bg-white hover:text-slate-900 transition-colors"
              >
                Download PDF
              </button>
              <button
                onClick={() => setEmailOpen(true)}
                className="px-3 py-1.5 border border-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] text-white hover:bg-white hover:text-slate-900 transition-colors"
              >
                Email 초안
              </button>
              <button
                onClick={reset}
                className="px-3 py-1.5 border border-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] text-white hover:bg-white hover:text-slate-900 transition-colors"
              >
                + New
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* INPUT */}
        {!slip && (
          <>
            <div className="border border-slate-200 bg-white">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
                  Source Documents
                </span>
                <span className="text-[10px] text-slate-400">
                  원수사 RQ Slip · 설문서 · 계약서 · 이메일
                </span>
              </div>
              <div className="p-4">
                <div
                  className="border border-dashed border-slate-300 p-6 text-center cursor-pointer hover:border-slate-900 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    addFiles(e.dataTransfer.files);
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.msg,.xlsx,.xls"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                  />
                  <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-700">
                    Drag files here · 클릭하여 선택
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    PDF · DOCX · MSG · XLSX
                  </div>
                </div>
                {files.length > 0 && (
                  <div className="mt-3 border border-slate-200">
                    {files.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 text-[12px] border-b border-slate-200 last:border-b-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[9px] font-mono font-bold tracking-wider bg-slate-900 text-white px-1.5 py-0.5">
                            {f.name.split(".").pop()?.toUpperCase()}
                          </span>
                          <span className="font-medium text-slate-900 truncate">
                            {f.name}
                          </span>
                          <span className="text-slate-400 font-mono tabular-nums text-[10px]">
                            {(f.size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] hover:underline shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border border-slate-200 bg-white">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
                  Email / Text
                </span>
                <span className="text-[10px] text-slate-400">
                  타겟보험료 · RI Commission · 제출기한
                </span>
              </div>
              <div className="p-4">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="이메일 본문(타겟보험료·제출기한 등)을 붙여넣기…"
                  className="w-full h-28 px-3 py-2 border border-slate-300 bg-white text-[12px] focus:outline-none focus:border-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={extract}
                disabled={(!files.length && !pasteText.trim()) || loading}
                className="px-6 py-2.5 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? "Analyzing…" : "Extract & Draft Slip"}
              </button>
              <span className="text-[10px] text-slate-400 font-mono">
                {files.length} file{files.length !== 1 ? "s" : ""}
                {pasteText.trim() ? " · with text" : ""}
              </span>
              <span className="flex-1" />
              {/* Live-demo fallback — one-click "continue with the most recent
                  saved case" so the operator can dodge a Gemini outage without
                  fumbling through the queue page mid-presentation. */}
              {cases.length > 0 && (
                <button
                  onClick={() => loadCase(cases[0].id)}
                  className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline"
                  title={`최근 저장 케이스: ${cases[0].insured || "(미상)"} · ${cases[0].updated_at?.slice(0, 10) || ""}`}
                >
                  ↪ 최근 저장 케이스로 이어서
                </button>
              )}
            </div>

            {error && (
              <div className="border border-[#b91c1c] bg-white px-4 py-3 text-[12px] text-[#b91c1c]">
                {error}
              </div>
            )}

            {/* Backend unreachable: explicit warning so an empty saved-drafts
                panel during a live demo isn't mistaken for "no cases yet". */}
            {casesFetchError && (
              <div className="border border-amber-400 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-900">
                케이스 목록을 불러올 수 없습니다 ({casesFetchError}) — 백엔드 연결 상태를 확인하세요.
              </div>
            )}

            {/* Saved cases — reload a previously drafted slip */}
            {cases.length > 0 && (
              <div className="border border-slate-200 bg-white">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between gap-3">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
                    저장된 케이스 · Saved Drafts
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                    {cases.length}
                  </span>
                  <span className="flex-1" />
                  <Link
                    href="/ins/tools/rq-slip/cases"
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline"
                  >
                    검수 큐 열기 →
                  </Link>
                </div>
                <div className="max-h-[280px] overflow-auto divide-y divide-slate-100">
                  {cases.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => loadCase(c.id)}
                      className="w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors flex items-center gap-3"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12px] font-medium text-slate-900 truncate">
                          {c.insured || "(미상 Insured)"}
                        </span>
                        <span className="block text-[10px] text-slate-500 truncate">
                          {c.line || "—"}
                          {c.reinsured ? ` · ${c.reinsured}` : ""}
                        </span>
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                        {c.status}
                        {c.verdict ? ` · ${c.verdict}` : ""}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 shrink-0 hidden sm:inline">
                        {c.updated_at ? c.updated_at.slice(0, 10) : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* RESULT */}
        {slip && (
          <>
            {/* Discrepancy check — the M3 value highlight */}
            <div className="border border-slate-200 bg-white">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
                  자료 일치성 검증
                </span>
                <span className="text-[10px] text-slate-400">
                  RQ ↔ 설문서 · 계약서 불일치 대조 (산출기초·보험조건 등)
                </span>
              </div>
              <div className="p-4">
                {slip.discrepancies && slip.discrepancies.length > 0 ? (
                  <div className="space-y-2">
                    {slip.discrepancies.map((d, i) => (
                      <div
                        key={i}
                        className="border-l-2 pl-3 py-1"
                        style={{ borderColor: SEVERITY_INK[d.severity] || "#64748b" }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: SEVERITY_INK[d.severity] || "#64748b" }}
                          >
                            {d.severity}
                          </span>
                          <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                            {d.field}
                          </span>
                        </div>
                        <div className="text-[12px] text-slate-700 mt-0.5">
                          <span className="font-mono">RQ: {d.rq_value || "—"}</span>
                          <span className="text-slate-400 mx-2">↔</span>
                          <span className="font-mono">{d.other_value || "—"}</span>
                        </div>
                        {d.note && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{d.note}</div>
                        )}
                      </div>
                    ))}
                    <div className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                      기준: RQ 슬립 값 우선 · 발송 전 원수사(보험사) 담당자 확인 권장
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px] text-emerald-700">
                    ✓ 자료 간 불일치가 감지되지 않았습니다. (단일 문서이거나 충돌 없음)
                  </div>
                )}
              </div>
            </div>

            {/* Email-sourced terms (target premium / RI commission / capacity /
                deadline). Reference only — kept OFF the slip so the first
                submission never auto-exposes the target premium. */}
            {(slip.target_premium ||
              slip.ri_commission ||
              slip.submission_deadline ||
              slip.ri_capacity) && (
              <div className="border border-slate-200 bg-white">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
                    이메일 수신 정보 · Email Terms
                  </span>
                  <span className="text-[10px] text-slate-400">
                    참고용 · 슬립 미포함 (첫 Submission 타겟보험료 비공개)
                  </span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
                  {(
                    [
                      ["타겟보험료 / Target Premium", slip.target_premium],
                      ["RI Commission", slip.ri_commission],
                      ["필요 Capacity", slip.ri_capacity],
                      ["제출기한 / Deadline", slip.submission_deadline],
                    ] as [string, string | undefined][]
                  ).map(([label, val]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-3 border-b border-slate-100 py-1"
                    >
                      <span className="text-slate-500">{label}</span>
                      <span className="font-mono text-slate-800">{val || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reinsurer matching (M7) — who to approach for this line.
                Lives OUTSIDE #rq-slip-doc so the PII never enters the slip PDF. */}
            <div className="border border-slate-200 bg-white">
              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-baseline justify-between">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-700">
                  재보험사 후보 · Placement Targets
                </span>
                <span className="text-[10px] text-slate-400">
                  Line 기준 접촉 재보험사 분류 · 컨택 디렉터리는 세션에만 보관(미저장)
                </span>
              </div>
              <div className="p-4">
                <input
                  ref={dirRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => onDirChosen(e.target.files?.[0] || null)}
                />

                {!reMatch && !reLoading && (
                  <div
                    className="border border-dashed border-slate-300 p-5 text-center cursor-pointer hover:border-slate-900 transition-colors"
                    onClick={() => dirRef.current?.click()}
                  >
                    <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-700">
                      재보험사 컨택 디렉터리 업로드 · 클릭하여 선택
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      Reinsurer Contact Point .xlsx — current line:{" "}
                      <span className="text-slate-600">{slip.line || "—"}</span>
                    </div>
                  </div>
                )}

                {reLoading && (
                  <div className="text-[12px] text-slate-500">재보험사 매칭 중…</div>
                )}
                {reError && (
                  <div className="border border-[#b91c1c] bg-white px-3 py-2 text-[12px] text-[#b91c1c]">
                    {reError}
                  </div>
                )}

                {reMatch && !reLoading && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="bg-slate-900 text-white font-bold uppercase tracking-wider px-2 py-0.5 text-[10px]">
                        {reMatch.matched_sheet}
                        {reMatch.sub_line ? ` · ${reMatch.sub_line}` : ""}
                      </span>
                      <span className="text-slate-600 font-mono tabular-nums">
                        {reMatch.contacts.length} contacts
                      </span>
                      <span className="flex-1" />
                      <button
                        onClick={() => reDir && matchReinsurers(reDir)}
                        className="px-2 py-1 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
                      >
                        현재 Line으로 재매칭
                      </button>
                      <button
                        onClick={() => dirRef.current?.click()}
                        className="px-2 py-1 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
                      >
                        다른 파일
                      </button>
                    </div>

                    {reMatch.contacts.length === 0 ? (
                      <div className="text-[12px] text-slate-500">
                        이 Line에 매칭되는 컨택이 없습니다. Line 표기를 확인하거나 다른 시트를 검토하세요.
                      </div>
                    ) : (
                      <div className="max-h-[360px] overflow-auto border border-slate-200">
                        <table className="w-full text-[11px] border-collapse">
                          <thead className="sticky top-0 bg-slate-100 text-slate-600">
                            <tr className="text-left uppercase tracking-wider text-[9px]">
                              <th className="px-2 py-1.5 font-bold">Company</th>
                              <th className="px-2 py-1.5 font-bold">Contact</th>
                              <th className="px-2 py-1.5 font-bold">E-mail</th>
                              <th className="px-2 py-1.5 font-bold">Phone</th>
                              <th className="px-2 py-1.5 font-bold">Lines</th>
                              <th className="px-2 py-1.5 font-bold">Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reMatch.contacts.map((c, i) => (
                              <tr
                                key={i}
                                className="border-t border-slate-100 hover:bg-amber-50 align-top"
                              >
                                <td className="px-2 py-1.5 font-medium text-slate-900 whitespace-nowrap">
                                  {c.company}
                                </td>
                                <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                                  {c.contact}
                                  {c.title ? (
                                    <span className="text-slate-400"> · {c.title}</span>
                                  ) : null}
                                </td>
                                <td className="px-2 py-1.5 font-mono text-[10px] text-slate-600">
                                  {c.email ? (
                                    <a
                                      href={`mailto:${c.email}`}
                                      className="hover:underline"
                                    >
                                      {c.email}
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                  {c.phone || "—"}
                                </td>
                                <td className="px-2 py-1.5">
                                  <div className="flex flex-wrap gap-1">
                                    {c.lines.map((ln) => (
                                      <span
                                        key={ln}
                                        className="bg-slate-200 text-slate-700 px-1 text-[9px] font-bold tracking-wide"
                                      >
                                        {ln}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-slate-500 text-[10px] max-w-[200px]">
                                  {c.remarks}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* AI baseline ↔ edits diff — the demo "wow" moment. Lives OUTSIDE
                #rq-slip-doc so it doesn't leak into the PDF. */}
            <DiffSummaryPanel diff={diff} />

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex-1 min-w-[200px]">
                아래 슬립은 AI 초안입니다 — 항목을 클릭해 직접 수정하세요. 발송 전 담당자 검토 필수.
              </div>

              {/* Status pill — current lifecycle state of this case */}
              {caseStatus && (
                <span
                  className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{
                    background: STATUS_PILL[caseStatus].bg,
                    color: STATUS_PILL[caseStatus].ink,
                  }}
                  title="저장된 케이스의 현재 상태"
                >
                  {STATUS_PILL[caseStatus].label}
                </span>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider mr-1">
                  검토
                </span>
                {(
                  [
                    ["correct", "정확", "#047857"],
                    ["needs_fix", "수정요", "#b45309"],
                    ["wrong", "오류", "#b91c1c"],
                  ] as [Verdict, string, string][]
                ).map(([v, label, ink]) => (
                  <button
                    key={v}
                    onClick={() => reviewCase(v)}
                    className="px-2.5 py-1 border text-[10px] font-bold uppercase tracking-wider transition-colors"
                    style={
                      reviewVerdict === v
                        ? { background: ink, borderColor: ink, color: "#fff" }
                        : { borderColor: "#cbd5e1", color: "#475569" }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 발송 완료 — promotes reviewed → sent. Disabled until the
                  case is reviewed (status reviewed AND verdict set) so it
                  can't be clicked accidentally on a half-checked draft. */}
              {caseId && (
                <button
                  onClick={markSent}
                  disabled={
                    caseStatus === "sent" || caseStatus !== "reviewed" || !reviewVerdict
                  }
                  className="px-2.5 py-1 border border-emerald-700 text-[10px] font-bold uppercase tracking-wider text-emerald-800 hover:bg-emerald-700 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-emerald-800"
                  title={
                    caseStatus === "sent"
                      ? "이미 발송 처리됨"
                      : caseStatus !== "reviewed" || !reviewVerdict
                      ? "검수 판정 후 발송 처리 가능"
                      : "재보험사 발송 완료로 표시"
                  }
                >
                  {caseStatus === "sent" ? "✓ Sent" : "발송 완료"}
                </button>
              )}
            </div>

            {/* Slip type selector — RQ / Placing / Closing / Cover Note / Debit Note */}
            <div className="flex w-fit border border-slate-300">
              {SLIP_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setSlipType(t)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] border-r border-slate-300 last:border-r-0 transition-colors ${
                    slipType === t
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Editable INS Corp document — risk block shared across
                RQ/Placing/Closing/Cover Note; Debit Note has its own layout. */}
            <div className="flex justify-center">
              {slipType === "Debit Note" ? (
                <DebitNoteDoc
                  slip={slip}
                  commercial={slip.commercial || {}}
                  onCommercial={updateCommercial}
                />
              ) : (
              <div
                id="rq-slip-doc"
                className="bg-white border border-slate-300 w-full max-w-[820px] px-12 py-10"
              >
                {/* Letterhead — INS corp logo over the address block. This is
                    the on-screen preview; the downloaded/emailed PDF is drawn
                    separately as real text by ./pdf/slipDoc.ts (letterhead
                    repeated on every page there). */}
                <div data-pdf-header className="border-b-2 border-slate-900 pb-3 mb-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/ins_logo.png"
                    alt={BROKER.name}
                    width={140}
                    height={40}
                    className="block h-[40px] w-auto mb-1.5"
                  />
                  <div className="text-[9px] text-slate-500 mt-1">{BROKER.address}</div>
                  <div className="text-[9px] text-slate-500">{BROKER.contact}</div>
                </div>

                {/* Body — on-screen editable preview. The exported PDF is
                    rebuilt as text in ./pdf/slipDoc.ts, not captured from here. */}
                <div data-pdf-body>

                {/* Title box (To / header / A/C) — header varies by slip type */}
                <div className="border border-slate-900 px-4 py-2 mb-4">
                  {SLIP_META[slipType].showTo && (
                    <div className="text-[12px] text-slate-700 mb-1 flex items-baseline gap-1">
                      <span>To:</span>
                      <input
                        value={slip.commercial?.["To"] || ""}
                        onChange={(e) => updateCommercial("To", e.target.value)}
                        placeholder="Reinsurer / Underwriter"
                        className="bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:bg-amber-50 flex-1 min-w-[180px]"
                      />
                    </div>
                  )}
                  <div className="text-[13px] font-bold text-slate-900 flex flex-wrap items-baseline gap-1">
                    <span>{SLIP_META[slipType].title}</span>
                    {SLIP_META[slipType].showLine && (
                      <input
                        value={slip.line || ""}
                        onChange={(e) => update("line", e.target.value)}
                        placeholder="Line of Business"
                        className="bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:bg-amber-50 font-bold flex-1 min-w-[180px]"
                      />
                    )}
                    {slipType === "Cover Note" && (
                      <span className="flex items-baseline gap-1 font-normal">
                        (No.
                        <input
                          value={slip.commercial?.["No."] || ""}
                          onChange={(e) => updateCommercial("No.", e.target.value)}
                          placeholder="—"
                          className="bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:bg-amber-50 w-24"
                        />
                        )
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-slate-700 mt-1 flex items-baseline gap-1">
                    <span>A/C:</span>
                    <input
                      value={(slip.policy_holder || slip.insured) || ""}
                      onChange={(e) => update("policy_holder", e.target.value)}
                      placeholder="Policy Holder"
                      className="bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:bg-amber-50 flex-1 min-w-[180px]"
                    />
                  </div>
                </div>

                {SLIP_META[slipType].intro && (
                  <div className="text-[11px] text-slate-600 mb-3">
                    {SLIP_META[slipType].intro}
                  </div>
                )}

                {/* Body fields */}
                {/* Field order/labels mirror the official INS Corp RQ Slip
                    template (인스보험중개 계약 서류 양식/1. RQ Slip):
                    Insured → Location → Reinsured, then Covered Risk. Annual
                    Turnover is NOT a standalone row on the official form — it is
                    folded into the Risks/Covered Risk block (with per-product
                    breakdown), so we render it beneath the risk description. */}
                {/* Policy Holder only appears when it genuinely differs from the
                    Insured. The official INS Corp form omits it for the common
                    case where 계약자 == 피보험자 (e.g. The Founders), so we mirror
                    that and avoid a redundant row. */}
                {(slip.policy_holder || "").trim() &&
                  (slip.policy_holder || "").trim() !== (slip.insured || "").trim() && (
                    <SlipRow label="Policy Holder" modified={diffKeys.has("policy_holder")}>
                      <SlipField
                        value={slip.policy_holder || ""}
                        onChange={(v) => update("policy_holder", v)}
                      />
                    </SlipRow>
                  )}
                <SlipRow label="Insured" modified={diffKeys.has("insured")}>
                  <SlipField value={slip.insured || ""} onChange={(v) => update("insured", v)} />
                </SlipRow>
                <SlipRow label="Location" modified={diffKeys.has("location")}>
                  <SlipField value={slip.location || ""} onChange={(v) => update("location", v)} />
                </SlipRow>
                <SlipRow label="Reinsured" modified={diffKeys.has("reinsured")}>
                  <SlipField value={slip.reinsured || ""} onChange={(v) => update("reinsured", v)} />
                </SlipRow>
                <SlipRow
                  label="Covered Risk"
                  modified={diffKeys.has("risk_description") || diffKeys.has("annual_turnover")}
                >
                  <SlipField
                    value={slip.risk_description || ""}
                    onChange={(v) => update("risk_description", v)}
                    multiline
                  />
                  {(slip.annual_turnover || "").trim() && (
                    <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Annual Turnover
                        </span>
                        <span className="flex-1" />
                        <button
                          type="button"
                          data-pdf-ignore
                          onClick={() => update("annual_turnover", "")}
                          title="자동 입력된 산출기초 값 삭제"
                          aria-label="Annual Turnover 삭제"
                          className="text-slate-300 hover:text-red-600 transition-colors text-[13px] leading-none px-1"
                        >
                          ×
                        </button>
                      </div>
                      <SlipField
                        value={slip.annual_turnover || ""}
                        onChange={(v) => update("annual_turnover", v)}
                        multiline
                      />
                    </div>
                  )}
                </SlipRow>
                <SlipRow label="Policy Period" modified={diffKeys.has("policy_period")}>
                  <SlipField
                    value={slip.policy_period || ""}
                    onChange={(v) => update("policy_period", v)}
                  />
                </SlipRow>
                {(slip.retroactive_date || "").trim() && (
                  <SlipRow label="(Retroactive Date)" modified={diffKeys.has("retroactive_date")}>
                    <SlipField
                      value={slip.retroactive_date || ""}
                      onChange={(v) => update("retroactive_date", v)}
                    />
                  </SlipRow>
                )}
                <SlipRow label="Limit of Liability" modified={diffKeys.has("limit_of_liability")}>
                  <SlipField
                    value={slip.limit_of_liability || ""}
                    onChange={(v) => update("limit_of_liability", v)}
                    multiline
                  />
                </SlipRow>
                <SlipRow label="Deductible" modified={diffKeys.has("deductible")}>
                  <SlipField
                    value={slip.deductible || ""}
                    onChange={(v) => update("deductible", v)}
                    multiline
                  />
                </SlipRow>
                {/* Per INS feedback: when Territory and Jurisdiction are the
                    same (the common Worldwide/Worldwide or Korea/Korea case),
                    show ONE combined row rather than repeating the value twice.
                    Only split into two labelled rows when they genuinely
                    differ (e.g. Territory Worldwide / Jurisdiction Korea). */}
                {(slip.territory || "").trim() === (slip.jurisdiction || "").trim() ||
                !(slip.jurisdiction || "").trim() ? (
                  <SlipRow
                    label="Policy Territory & Jurisdiction"
                    modified={diffKeys.has("territory") || diffKeys.has("jurisdiction")}
                  >
                    <SlipField
                      value={slip.territory || ""}
                      onChange={(v) => update("territory", v)}
                    />
                  </SlipRow>
                ) : (
                  <>
                    <SlipRow label="Policy Territory" modified={diffKeys.has("territory")}>
                      <SlipField
                        value={slip.territory || ""}
                        onChange={(v) => update("territory", v)}
                      />
                    </SlipRow>
                    <SlipRow label="Policy Jurisdiction" modified={diffKeys.has("jurisdiction")}>
                      <SlipField
                        value={slip.jurisdiction || ""}
                        onChange={(v) => update("jurisdiction", v)}
                      />
                    </SlipRow>
                  </>
                )}

                {/* Product/stage-specific fields the AI surfaced (Retroactive
                    Date has its own row above; this catches everything else).
                    Fully hand-editable like slip-generator: rename the label,
                    edit the value, or delete a wrong/duplicate row. */}
                {(slip.additional_fields || []).map((f, i) => (
                  <div
                    key={`af-${i}`}
                    className="grid grid-cols-[170px_1fr_auto] gap-4 py-2 border-b border-slate-100 items-start"
                  >
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        value={f.label || ""}
                        onChange={(e) => updateAdditionalFieldLabel(i, e.target.value)}
                        placeholder="필드명…"
                        className="w-full bg-transparent text-[11px] font-bold uppercase tracking-wider text-slate-900 focus:outline-none focus:bg-amber-50 border-b border-dashed border-transparent focus:border-slate-400"
                      />
                      {diffKeys.has(`af:${f.label || ""}`) && (
                        <span
                          title="AI 추출본에서 수정됨"
                          aria-label="modified"
                          className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                        />
                      )}
                    </div>
                    <SlipField
                      value={f.value || ""}
                      onChange={(v) => updateAdditionalField(i, v)}
                    />
                    <button
                      type="button"
                      data-pdf-ignore
                      onClick={() => removeAdditionalField(i)}
                      title="이 행 삭제"
                      aria-label="행 삭제"
                      className="text-slate-300 hover:text-red-600 transition-colors text-[14px] leading-none px-1 pt-1"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Add a row the AI missed entirely (manual correction). */}
                <div data-pdf-ignore className="py-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={addAdditionalField}
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    + 행 추가
                  </button>
                </div>

                {/* Terms & Conditions — one clause per line */}
                <div className="py-2 border-b border-slate-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 mb-1">
                    Terms &amp; Conditions
                  </div>
                  <textarea
                    value={(slip.conditions || []).join("\n")}
                    onChange={(e) =>
                      setSlip((prev) =>
                        prev ? { ...prev, conditions: e.target.value.split("\n") } : prev
                      )
                    }
                    rows={Math.max(4, (slip.conditions || []).length + 1)}
                    placeholder="한 줄에 하나의 특약/조건…"
                    className="w-full bg-transparent text-[11px] leading-relaxed text-slate-800 focus:outline-none focus:bg-amber-50 border border-dashed border-slate-200 focus:border-slate-400 px-2 py-1 resize-y"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
                    {(slip.conditions || []).filter((c) => c.trim()).length} clauses
                  </div>
                </div>

                {/* Remarks — free-form 비고/기타조건 block (co-insured, waiver
                    targets, misc notes). Rendered only when present so RQs
                    without a remarks block stay lean. Kept distinct from T&C. */}
                {(slip.remarks || "").trim() && (
                  <div className="py-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                        Remarks
                      </div>
                      {diffKeys.has("remarks") && (
                        <span
                          title="AI 추출본에서 수정됨"
                          aria-label="modified"
                          className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                        />
                      )}
                    </div>
                    <textarea
                      value={slip.remarks || ""}
                      onChange={(e) =>
                        setSlip((prev) =>
                          prev ? { ...prev, remarks: e.target.value } : prev
                        )
                      }
                      rows={Math.max(3, (slip.remarks || "").split("\n").length + 1)}
                      placeholder="공동피보험자 · 대위권포기 적용 대상 · 기타조건…"
                      className="w-full bg-transparent text-[11px] leading-relaxed text-slate-800 focus:outline-none focus:bg-amber-50 border border-dashed border-slate-200 focus:border-slate-400 px-2 py-1 resize-y whitespace-pre-wrap"
                    />
                  </div>
                )}

                {/* Financial / commercial block — labels vary by slip type.
                    Editable: broker fills R/I Share etc. from Placing onward;
                    on the RQ these stay blank for the reinsurer to quote. */}
                <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3">
                  {SLIP_META[slipType].financial.map((lbl) => (
                    <div key={lbl} className="border-b border-slate-300 pb-2">
                      <div className="text-[11px] font-bold text-slate-900 mb-0.5">{lbl}</div>
                      <input
                        value={slip.commercial?.[lbl] || ""}
                        onChange={(e) => updateCommercial(lbl, e.target.value)}
                        placeholder="—"
                        className="w-full bg-transparent text-[12px] text-slate-800 focus:outline-none focus:bg-amber-50"
                      />
                    </div>
                  ))}
                </div>

                {SLIP_META[slipType].closing && (
                  <div className="text-[11px] text-slate-600 mt-6">
                    {SLIP_META[slipType].closing}
                  </div>
                )}

                {/* Signature — handwritten signature image sits just above the
                    rule, with the printed name/title below it. */}
                <div className="mt-8">
                  <div className="text-[11px] text-slate-600">Sincerely yours,</div>
                  <div className="w-56">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/ins_signature.png"
                      alt={`${BROKER.signerName} signature`}
                      width={130}
                      height={55}
                      className="block h-[55px] w-auto ml-2 -mb-2 mt-3"
                    />
                    <div className="border-t border-slate-400 pt-1">
                      <div className="text-[11px] font-bold text-slate-900">
                        {BROKER.signerName}
                      </div>
                      <div className="text-[9px] text-slate-600">{BROKER.signerTitle}</div>
                      <div className="text-[9px] text-slate-600">{BROKER.name.toUpperCase()}</div>
                    </div>
                  </div>
                </div>

                </div>{/* /[data-pdf-body] */}

                {/* Footer — INS corp watermark mark, bottom-right. Marked
                    [data-pdf-footer] so the PDF export repeats it on every page
                    (mirrors the official INS Corp RQ slip). */}
                <div
                  data-pdf-footer
                  className="mt-10 pt-3 border-t border-slate-200 flex justify-end"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/ins_logo.png"
                    alt={BROKER.name}
                    width={96}
                    height={28}
                    className="block h-[28px] w-auto opacity-60"
                  />
                </div>
              </div>
              )}
            </div>
          </>
        )}
      </div>

      {slip && emailOpen && (
        <EmailComposeModal
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          to={
            reMatch?.contacts
              ?.map((c) => c.email)
              .filter(Boolean)
              .join("; ") || ""
          }
          replyTo={RQ_REPLY_TO}
          suggestions={extractEmails(
            (reMatch?.contacts ?? []).map((c) => c.email).join("\n"),
            pasteText
          )}
          defaultLang="en"
          buildDraft={(lang) =>
            buildSlipEmailDraft({
              kind: "placement",
              lang,
              docTypeLabel: RQ_DOC_LABEL[slipType],
              docTypeLabelKo: RQ_DOC_LABEL_KO[slipType],
              account: slip.insured,
              reinsured: slip.reinsured,
              reinsurerName: reMatch?.contacts?.[0]?.company,
              line: slip.line,
              policyPeriod: slip.policy_period,
              reference: slip.reference_no,
              deadline: slip.submission_deadline,
              attachmentName: rqAttachmentName(slip, slipType),
              broker: {
                name: BROKER.name,
                signerName: BROKER.signerName,
                signerTitle: BROKER.signerTitle,
                contact: BROKER.contact,
              },
            })
          }
          attachmentFilename={rqAttachmentName(slip, slipType)}
          buildAttachment={async () => {
            const r = await renderSlipPdf();
            return r ? r.pdf.output("arraybuffer") : null;
          }}
        />
      )}
    </div>
  );
}
