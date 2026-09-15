"use client";

import React from "react";
import { SIGNATURE_SHLEE_DATA_URL } from "./signatureData";

export type SlipType = "SOC" | "PLA" | "Bordereau SOC" | "Bordereau PLA";

export interface BordereauClaim {
  insured: string;
  policy_period: string;
  uy: string;
  facility: string;
  dol: string;
  doc: string;
  currency: string;
  claim_amount_100: number;
  expense_100: number;
  cedant: string;
  cedant_ref_no: string;
  /** Reference body with the revision suffix stripped — successive
   *  billings (``001``/``002``/``003`` …) of the same loss collapse
   *  to one ``incident_id``. Backend-derived from ``cedant_ref_no``
   *  when the cedant has a verified ref-no parser; otherwise null. */
  incident_id?: string | null;
  /** Integer revision parsed from ``cedant_ref_no`` (e.g. 1 for
   *  ``2020-1021024610 001``). Null when the source ref carries no
   *  revision. Together with ``incident_id`` this is what customers
   *  use to identify "동일 사고" claims. */
  claim_seq?: number | null;
}

/** Discriminated union describing how a bordereau column's value is
 *  produced for a given row. */
export type BordereauColumnSource =
  | { kind: "index" }
  | { kind: "field"; field: keyof BordereauClaim }
  // ``computed`` is for values that depend on slip-level context
  // (your_share %, claim×share, etc.) — not directly editable.
  | { kind: "computed"; computed: "share_pct" | "your_amount" | "to_reinsurer" }
  | { kind: "static"; value: string }
  // Per-row free text. Keys into ``valuesByRowIdx`` by row index.
  | { kind: "custom"; valuesByRowIdx: Record<number, string> };

export interface BordereauColumn {
  /** Stable key used for React keys, edit callbacks, and persistence. */
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  /** When false the column is hidden from both the editor and the
   *  rendered slip. Visibility, not deletion — toggling preserves
   *  any custom values set on the column. */
  visible?: boolean;
  /** Render hint for numeric formatting (right-aligned, sign color). */
  numeric?: boolean;
  source: BordereauColumnSource;
}

/** The legacy hardcoded 15-column layout, plus the two incident-
 *  identification columns (off by default — customers turn them on
 *  per slip-case from the column manager). When the host passes
 *  ``columns`` to ``<SlipDocument>`` this is ignored. */
export const DEFAULT_BORDEREAU_COLUMNS: readonly BordereauColumn[] = [
  { key: "no", label: "No.", align: "center", visible: true, source: { kind: "index" } },
  { key: "insured", label: "Insured", align: "left", visible: true, source: { kind: "field", field: "insured" } },
  { key: "policy_period", label: "Policy Period", align: "center", visible: true, source: { kind: "field", field: "policy_period" } },
  { key: "uy", label: "UY", align: "center", visible: true, source: { kind: "field", field: "uy" } },
  { key: "facility", label: "Facility", align: "center", visible: true, source: { kind: "field", field: "facility" } },
  { key: "dol", label: "DOL", align: "center", visible: true, source: { kind: "field", field: "dol" } },
  { key: "doc", label: "DOC", align: "center", visible: true, source: { kind: "field", field: "doc" } },
  { key: "reinsurer", label: "Reinsurer", align: "left", visible: true, source: { kind: "computed", computed: "to_reinsurer" } },
  { key: "currency", label: "Currency", align: "center", visible: true, source: { kind: "field", field: "currency" } },
  { key: "claim_amount_100", label: "Total Claim Amount\n(100%)", align: "right", visible: true, numeric: true, source: { kind: "field", field: "claim_amount_100" } },
  { key: "expense_100", label: "Fees & Expenses\n(100%)", align: "right", visible: true, numeric: true, source: { kind: "field", field: "expense_100" } },
  { key: "share", label: "Share", align: "center", visible: true, source: { kind: "computed", computed: "share_pct" } },
  { key: "your_amount", label: "Total\n(ours)", align: "right", visible: true, numeric: true, source: { kind: "computed", computed: "your_amount" } },
  { key: "cedant", label: "Cedant", align: "center", visible: true, source: { kind: "field", field: "cedant" } },
  { key: "cedant_ref_no", label: "Cedant's\nRef. No.", align: "left", visible: true, source: { kind: "field", field: "cedant_ref_no" } },
  // Incident-identification columns. Default off so legacy slips
  // keep their existing 15-column shape; operators flip them on via
  // the column manager when they want "동일 사고" identifiers
  // visible (typical KB workflow with 001/002/003 sequences).
  { key: "incident_id", label: "Incident ID", align: "left", visible: false, source: { kind: "field", field: "incident_id" } },
  { key: "claim_seq", label: "Seq", align: "center", visible: false, source: { kind: "field", field: "claim_seq" } },
];

/** Returns true when the column's value can be edited inline. */
export function isBordereauColumnEditable(col: BordereauColumn): boolean {
  return col.source.kind === "field" || col.source.kind === "custom";
}

export type SlipField =
  | "toReinsurer"
  | "cedantRef"
  | "reinsured"
  | "insured"
  | "claimType"
  | "policyPeriod"
  | "dol"
  | "locationOfLoss"
  | "natureOfLoss"
  | "particulars"
  | "remarks"
  | "currency"
  | "claimAmount100"
  | "expense100"
  | "total100"
  | "yourShare"
  | "yourAmount";

/**
 * Free-form row in the slip body table. When bodyFields is supplied
 * to <SlipDocument>, it REPLACES the default 8-row layout, and the
 * caller takes ownership of label/value/order. Use this to support
 * insurer-specific labels (e.g. "Nature of Loss" only on certain
 * cedants) or arbitrary user-added rows.
 */
export interface SlipBodyField {
  id: string;
  label: string;
  value: string;
  kind?: "text" | "textarea";
}

/** Mirror of backend extracted.text_en — English translations attached
 *  to the extracted blob for foreign-reinsurer slips. The Claim Detail
 *  card's KR/EN toggle pulls from here; for domestic-only cases the
 *  values are produced on-demand by /api/tools/soc/translate. */
export interface TextEnMap {
  account_name?: string;
  line?: string;
  location_of_loss?: string;
  nature_of_loss?: string;
  particulars?: string;
  remarks?: string;
  description?: string;
}

interface SlipProps {
  id: string;
  type?: SlipType;
  toReinsurer: string;
  date: string;
  cedantRef: string;
  reinsured: string;
  insured: string;
  claimType: string;
  policyPeriod: string;
  dol: string;
  locationOfLoss: string;
  natureOfLoss?: string;
  particulars: string;
  remarks: string;
  currency: string;
  claimAmount100: number;
  expense100: number;
  total100: number;
  yourShare: number;
  yourAmount: number;
  editable?: boolean;
  onFieldChange?: (field: SlipField, value: string) => void;
  claims?: BordereauClaim[];
  /** Optional second-line subtitle inside the title box, e.g. "(2nd Revised)". */
  subTitle?: string;
  /** When supplied, REPLACES the default Reinsured / Insured / Type / ...
   *  body table with a fully custom row list. Editing flows through
   *  onBodyFieldChange(id, value) instead of onFieldChange. */
  bodyFields?: SlipBodyField[];
  onBodyFieldChange?: (id: string, value: string) => void;
  /** Bordereau-table column layout. When omitted the renderer falls
   *  back to ``DEFAULT_BORDEREAU_COLUMNS`` (current 15-column layout
   *  plus the two incident columns turned off). Only meaningful for
   *  Bordereau SOC / Bordereau PLA types. */
  columns?: BordereauColumn[];
  /** Fires when an editable bordereau cell loses focus with a changed
   *  value. ``columnKey`` matches ``BordereauColumn.key``; the parent
   *  is responsible for routing the raw string back into the right
   *  shape (numeric coercion for amounts, etc.) and updating its
   *  source-of-truth claim list. */
  onClaimCellChange?: (rowIdx: number, columnKey: string, value: string) => void;
}

function fmt(val: number, currency?: string | null): string {
  if (val === 0) return "-";
  // Negative amounts are shown in parentheses (accounting convention)
  // — color is applied separately at the cell level so that the same
  // string flows through contentEditable / html2canvas correctly.
  const abs = Math.abs(val);
  const ccy = currency ? String(currency).toUpperCase() : "";
  let formatted: string;
  if (ccy === "KRW") {
    formatted = abs.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  } else if (ccy) {
    // Non-KRW currency — always show two decimal places so USD/EUR/JPY
    // amounts don't silently truncate ("12,345.67" stays "12,345.67",
    // "12,345" becomes "12,345.00").
    formatted = abs.toLocaleString("ko-KR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else {
    // No currency context — preserve legacy behaviour: trailing zeros
    // dropped for whole numbers, two decimals for non-integers.
    formatted =
      abs === Math.floor(abs)
        ? abs.toLocaleString("ko-KR", { maximumFractionDigits: 0 })
        : abs.toLocaleString("ko-KR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
  }
  return val < 0 ? `(${formatted})` : formatted;
}

function E({
  text,
  field,
  editable,
  onChange,
  style,
  className,
}: {
  text: string | number;
  field: SlipField;
  editable?: boolean;
  onChange?: (field: SlipField, value: string) => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  if (!editable || !onChange) {
    return <span style={style} className={className}>{String(text)}</span>;
  }
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      className={`slip-edit ${className || ""}`}
      style={style}
      onBlur={(e) => {
        const v = e.currentTarget.textContent || "";
        if (v !== String(text)) onChange(field, v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
    >
      {String(text)}
    </span>
  );
}

export default function SlipDocument(props: SlipProps) {
  const p = props;
  const type: SlipType = p.type || "SOC";
  const isBordereau = type === "Bordereau SOC" || type === "Bordereau PLA";
  const isPLA = type === "PLA" || type === "Bordereau PLA";

  if (isBordereau) return <BordereauDocument {...p} isPLA={isPLA} />;

  const title = isPLA ? "Preliminary Loss Advice" : "Settlement of Claim";
  const greeting = isPLA ? "Dear Claims Handler," : "Dear Team,";
  const intro = isPLA
    ? "Please be advised of a loss (update) on this risk, the particulars of which are as follows."
    : "With reference to the above claim, we regret to advise you of Settlement of Claim as following details:";
  const closing = isPLA
    ? "Trust you will find the above to be in good order, but feel free to contact us with any inquiries that you may have."
    : "We trust you will find the above to be in good order";

  return (
    <div id={p.id} style={{
      width: 720, background: "#fff", padding: "40px 50px 60px", fontFamily: "Arial, 'Pretendard Variable', sans-serif",
      fontSize: 13, lineHeight: 1.5, color: "#111",
    }}>
      <div style={{ marginBottom: 4 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ins-logo.png" alt="INS Corp" style={{ height: 52, marginBottom: 6 }} />
        <div style={{ fontSize: 11, color: "#333", lineHeight: 1.4 }}>
          <div>15th Floor, The Exchange Seoul, 21 Mugyo-ro, Jung-gu | Seoul, Korea 04520</div>
          <div><b>TEL: +82-2-2088-2727(Rep.) | FAX: +82-2-2088-2740 | www.dwins.co.kr</b></div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #999", borderBottom: "1px solid #999", padding: "8px 0", marginBottom: 4, display: "flex", fontSize: 13 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "#555", width: 80 }}>To:</span>
            <E text={p.toReinsurer} field="toReinsurer" editable={p.editable} onChange={p.onFieldChange} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <span style={{ color: "#555", width: 80 }}>Cedant&apos;s Ref:</span>
            <E text={p.cedantRef} field="cedantRef" editable={p.editable} onChange={p.onFieldChange} />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div><span style={{ color: "#555" }}>From: </span><a href="mailto:claim@dwins.co.kr" style={{ color: "#2563eb" }}>claim@dwins.co.kr</a></div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: "#555" }}>Date: </span>
            {p.date ? (
              p.date
            ) : (
              <span style={{ color: "#b91c1c", fontStyle: "italic" }}>
                &lt;set date&gt;
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{
        border: "1px solid #ccc", padding: p.subTitle ? "12px 0" : "16px 0", textAlign: "center",
        margin: "20px 0", fontSize: 20, fontWeight: 700, borderRadius: 3, lineHeight: 1.25,
      }}>
        <div>{title}</div>
        {p.subTitle && (
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{p.subTitle}</div>
        )}
      </div>

      <div style={{ marginBottom: 8 }}>{greeting}</div>
      <div style={{ marginBottom: 24, fontSize: 13 }}>{intro}</div>

      <table style={{ marginLeft: 40, marginBottom: 32, borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {(() => {
            // When bodyFields is supplied, the caller fully owns the body
            // rows (label/value/order). Otherwise we render the default
            // 8-row layout from named props for backwards compatibility.
            type Row = { id: string; label: string; value: string; field?: SlipField };
            const rows: Row[] = p.bodyFields
              ? p.bodyFields.map((f) => ({ id: f.id, label: f.label, value: f.value }))
              : [
                  { id: "reinsured", label: "Reinsured", value: p.reinsured, field: "reinsured" },
                  { id: "insured", label: "Insured", value: p.insured, field: "insured" },
                  { id: "claimType", label: "Type", value: p.claimType, field: "claimType" },
                  { id: "policyPeriod", label: "Policy Period", value: p.policyPeriod, field: "policyPeriod" },
                  { id: "dol", label: "Date of Loss", value: p.dol, field: "dol" },
                  { id: "locationOfLoss", label: "Location of Loss", value: p.locationOfLoss || "-", field: "locationOfLoss" },
                  ...(p.natureOfLoss
                    ? [{ id: "natureOfLoss", label: "Nature of Loss", value: p.natureOfLoss, field: "natureOfLoss" as SlipField }]
                    : []),
                  { id: "particulars", label: "Particulars of Loss", value: p.particulars || "Refer to the list", field: "particulars" },
                  { id: "remarks", label: "Remarks", value: p.remarks || "-", field: "remarks" },
                ];
            return rows.map((r, i) => (
              <tr key={r.id}>
                <td style={{ padding: "4px 8px 4px 0", verticalAlign: "top", width: 24, color: "#555" }}>{i + 1}.</td>
                <td style={{ padding: "4px 0", width: 150, verticalAlign: "top" }}>{r.label}</td>
                <td style={{ padding: "4px 0", verticalAlign: "top" }}>
                  : {p.bodyFields
                    ? (
                        <E
                          text={r.value}
                          /* For custom rows we don't have a SlipField id —
                             route through onBodyFieldChange via a thin
                             adapter that ignores SlipField and uses r.id. */
                          field={"toReinsurer"}
                          editable={p.editable && !!p.onBodyFieldChange}
                          onChange={(_f, v) => p.onBodyFieldChange?.(r.id, v)}
                        />
                      )
                    : (
                        <E
                          text={r.value}
                          field={r.field || "toReinsurer"}
                          editable={p.editable}
                          onChange={p.onFieldChange}
                        />
                      )}
                </td>
              </tr>
            ));
          })()}
        </tbody>
      </table>

      {/* Caption above the settlement table — flush with the data
          table edges using a real 2-cell mini-table (no flex). For
          PLA, only Currency renders on the right; for SOC, Settlement
          left + Currency right. */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6, tableLayout: "fixed" }}>
        <tbody>
          <tr>
            <td style={{ padding: 0, textAlign: "left", verticalAlign: "baseline", border: "none" }}>
              {!isPLA && (
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>Settlement:</span>
              )}
            </td>
            <td style={{ padding: 0, textAlign: "right", verticalAlign: "baseline", border: "none" }}>
              <span style={{ fontSize: 12, color: "#555" }}>
                Currency: <E text={p.currency} field="currency" editable={p.editable} onChange={p.onFieldChange} />
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Settlement / loss-advice data table — 5 columns with vertical
          separators between cells, and horizontal rules on top + bottom
          of headers and bottom of data. Borders are on th/td (not tr)
          because tr-level borders disappear under border-collapse in
          some renderers, including html2canvas. tableLayout is auto so
          long numbers like "1,850,000,000" are not forced to wrap. */}
      {(() => {
        const VR = "1px solid #888";
        const HR = "1.5px solid #111";
        const headerCellSt: React.CSSProperties = {
          padding: "6px 6px",
          textAlign: "center",
          fontWeight: 700,
          borderTop: HR,
          borderBottom: HR,
          borderLeft: VR,
          borderRight: VR,
        };
        const dataCellSt: React.CSSProperties = {
          padding: "8px 6px",
          textAlign: "right",
          borderBottom: HR,
          borderLeft: VR,
          borderRight: VR,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        };
        const refCellSt: React.CSSProperties = {
          ...dataCellSt,
          textAlign: "center",
          fontSize: 11,
        };
        // PLA: hide the "Expenses Reserve" column when its value is 0 (the
        // GT format omits the column entirely in that case). SOC always
        // shows Survey Fee since that's a separate field.
        const showExpenseCol = !isPLA || p.expense100 !== 0;
        const headers = isPLA
          ? ["Estimated Loss Amount", "Expenses Reserve", "Total (100%)"]
          : ["Claim Amount (100%)", "Expense (100%)", "Total (100%)"];
        const cols = showExpenseCol
          ? ["20%", "14%", "17%", "19%", "30%"]
          : ["24%", "20%", "22%", "34%"];
        return (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 32, tableLayout: "fixed" }}>
            <colgroup>
              {cols.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={headerCellSt}>{headers[0]}</th>
                {showExpenseCol && <th style={headerCellSt}>{headers[1]}</th>}
                <th style={headerCellSt}>{headers[2]}</th>
                <th style={headerCellSt}>
                  Your Share: <span style={{ fontWeight: 400 }}>{(p.yourShare * 100).toFixed(2)}%</span>
                </th>
                <th style={headerCellSt}>Cedant&apos;s Ref No.</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    ...dataCellSt,
                    color: p.claimAmount100 < 0 ? "#b91c1c" : undefined,
                  }}
                >
                  <E text={fmt(p.claimAmount100, p.currency)} field="claimAmount100" editable={p.editable} onChange={p.onFieldChange} />
                </td>
                {showExpenseCol && (
                  <td
                    style={{
                      ...dataCellSt,
                      color: p.expense100 < 0 ? "#b91c1c" : undefined,
                    }}
                  >
                    <E text={fmt(p.expense100, p.currency)} field="expense100" editable={p.editable} onChange={p.onFieldChange} />
                  </td>
                )}
                <td
                  style={{
                    ...dataCellSt,
                    color: p.total100 < 0 ? "#b91c1c" : undefined,
                  }}
                >
                  <E text={fmt(p.total100, p.currency)} field="total100" editable={p.editable} onChange={p.onFieldChange} />
                </td>
                <td
                  style={{
                    ...dataCellSt,
                    color: p.yourAmount < 0 ? "#b91c1c" : undefined,
                  }}
                >
                  <E text={fmt(p.yourAmount, p.currency)} field="yourAmount" editable={p.editable} onChange={p.onFieldChange} />
                </td>
                <td style={refCellSt}>{p.cedantRef}</td>
              </tr>
            </tbody>
          </table>
        );
      })()}

      {!isPLA && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>* Our Bank Details</div>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            <div>Name of Bank: Shinhan Bank / Gwanggyo Middle Market</div>
            <div>Address of Bank : 54, Cheonggyecheon-ro, Jung-gu, Seoul 04540, Korea</div>
            <div>Swift Code : SHBKKRSE</div>
            <div>Beneficiary: INS Corp.</div>
            <div>Account No. : 180-004-410534 (All Other Currencies) / 140-008-142466 (Korea Currency)</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <div>{closing}</div>
        <div>Sincerely yours,</div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SIGNATURE_SHLEE_DATA_URL} alt="Signature" style={{ height: 48, display: "block", marginBottom: 4 }} />
          <div style={{ marginTop: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>S. H. Lee</div>
            <div style={{ fontWeight: 700, fontSize: 11 }}>REINSURANCE / MANAGING DIRECTOR (TEAM LEADER)</div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>INS CORP.</div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ins-logo-mark.png" alt="INS Corp" style={{ height: 70, opacity: 0.95 }} />
      </div>
    </div>
  );
}

function BordereauDocument(p: SlipProps & { isPLA?: boolean }) {
  const claims = p.claims || [];
  const share = p.yourShare || 0;
  const ccyDefault = p.currency || "KRW";
  const isPLA = !!p.isPLA;
  const title = isPLA ? "Preliminary Loss Advice" : "Settlement of Claim";
  const greeting = isPLA ? "Dear Claims Handler," : "Dear Sir.";
  const intro = isPLA
    ? "Please be advised of a loss (update) on the following risks, the particulars of which are as follows:"
    : "We have received a request for settlement for the above claim, the details of which are as follows:";
  const closing = isPLA
    ? "Trust you will find the above to be in good order, but feel free to contact us with any inquiries that you may have."
    : "We hope the attached is assistance to your claim settlement but please let us know should you need any more information.";
  // Per-currency subtotals. Bordereaux that mix USD + KRW (or any other
  // pair) emit one footer row per ISO code so summing across currencies
  // never happens silently. Single-currency slips fall back to the
  // legacy single Total row downstream.
  const totalsByCcy = new Map<string, number>();
  for (const c of claims) {
    const ccy = String(c.currency || ccyDefault).toUpperCase();
    const ours = ((c.claim_amount_100 || 0) + (c.expense_100 || 0)) * share;
    totalsByCcy.set(ccy, (totalsByCcy.get(ccy) || 0) + ours);
  }
  const cols = (p.columns ?? DEFAULT_BORDEREAU_COLUMNS).filter(
    (c) => c.visible !== false
  );

  // Resolve a single cell to ``{ text, numericValue }``. ``numericValue``
  // drives the red-on-negative styling for numeric cells. Non-numeric
  // sources just return the display text. Numeric cells thread the row's
  // own ``currency`` (per-row ISO override) through fmt so a USD row
  // renders with two decimal places even in a packet where most rows are
  // KRW.
  function cellValue(
    col: BordereauColumn,
    row: BordereauClaim,
    idx: number
  ): { text: string; numericValue?: number } {
    const rowCcy = String(row.currency || ccyDefault);
    switch (col.source.kind) {
      case "index":
        return { text: String(idx + 1) };
      case "field": {
        const raw = row[col.source.field];
        if (raw === null || raw === undefined || raw === "") return { text: "—" };
        if (col.numeric) {
          const n = Number(raw) || 0;
          return { text: n ? fmt(n, rowCcy) : "-", numericValue: n };
        }
        return { text: String(raw) };
      }
      case "computed": {
        if (col.source.computed === "share_pct") {
          return { text: `${(share * 100).toFixed(0)}%` };
        }
        if (col.source.computed === "to_reinsurer") {
          return { text: p.toReinsurer || "—" };
        }
        if (col.source.computed === "your_amount") {
          const ours =
            ((row.claim_amount_100 || 0) + (row.expense_100 || 0)) * share;
          return { text: fmt(ours, rowCcy), numericValue: ours };
        }
        return { text: "" };
      }
      case "static":
        return { text: col.source.value };
      case "custom": {
        const v = col.source.valuesByRowIdx?.[idx];
        return { text: v ?? "" };
      }
    }
  }

  // Editable cells write back the raw string; parent decides numeric
  // coercion. ``share``/``your_amount`` are derived and never editable.
  const handleCellEdit = (rowIdx: number, columnKey: string, value: string) => {
    if (p.onClaimCellChange) p.onClaimCellChange(rowIdx, columnKey, value);
  };
  return (
    <div id={p.id} style={{
      width: 1100, background: "#fff", padding: "40px 50px 60px",
      fontFamily: "Arial, 'Pretendard Variable', sans-serif",
      fontSize: 12, lineHeight: 1.5, color: "#111",
    }}>
      <div style={{ marginBottom: 4 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ins-logo.png" alt="INS Corp" style={{ height: 52, marginBottom: 6 }} />
        <div style={{ fontSize: 11, color: "#333", lineHeight: 1.4 }}>
          <div>15th Floor, The Exchange Seoul, 21 Mugyo-ro, Jung-gu | Seoul, Korea 04520</div>
          <div><b>TEL: +82-2-2088-2727(Rep.) | FAX: +82-2-2088-2740 | www.dwins.co.kr</b></div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          To.{" "}
          <E text={p.toReinsurer} field="toReinsurer" editable={p.editable} onChange={p.onFieldChange} />
        </div>
        <div style={{ textAlign: "right", fontSize: 11, lineHeight: 1.6 }}>
          <div><span style={{ color: "#555" }}>Telephone</span> : 82-2-2088-2727</div>
          <div><span style={{ color: "#555" }}>Cedant Ref.</span> : Various</div>
          <div><span style={{ color: "#555" }}>Your Ref.</span> : Please advise</div>
          <div><span style={{ color: "#555" }}>Contact</span> : claim@dwins.co.kr</div>
          <div>
            <span style={{ color: "#555" }}>Date</span> :{" "}
            {p.date ? (
              p.date
            ) : (
              <span style={{ color: "#b91c1c", fontStyle: "italic" }}>
                &lt;set date&gt;
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 22, fontWeight: 700, margin: "28px 0 20px" }}>
        {title}
      </div>

      <div style={{ marginBottom: 6 }}>{greeting}</div>
      <div style={{ marginBottom: 16 }}>
        {intro}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, marginBottom: 0 }}>
        <thead>
          <tr style={{ background: "#f3f4f6", borderTop: "1.5px solid #111", borderBottom: "1px solid #111" }}>
            {cols.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "6px 4px",
                  textAlign: "center",
                  fontWeight: 700,
                  whiteSpace: "pre-line",
                  border: "1px solid #ccc",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {claims.length === 0 ? (
            <tr>
              <td
                colSpan={cols.length || 1}
                style={{ padding: 20, textAlign: "center", color: "#888", border: "1px solid #ccc" }}
              >
                (no claim rows)
              </td>
            </tr>
          ) : (
            claims.map((c, i) => {
              const tdBase: React.CSSProperties = { padding: "6px 4px", border: "1px solid #ccc", verticalAlign: "top" };
              return (
                <tr key={i}>
                  {cols.map((col) => {
                    const { text, numericValue } = cellValue(col, c, i);
                    const align = col.align ?? "center";
                    const baseStyle: React.CSSProperties = {
                      ...tdBase,
                      textAlign: align,
                      ...(col.numeric ? { fontVariantNumeric: "tabular-nums" } : {}),
                      ...(numericValue !== undefined && numericValue < 0
                        ? { color: "#b91c1c" }
                        : {}),
                    };
                    const editable = p.editable && isBordereauColumnEditable(col);
                    return (
                      <td key={col.key} style={baseStyle}>
                        {editable ? (
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            className="slip-edit"
                            onBlur={(e) => {
                              const v = e.currentTarget.textContent || "";
                              if (v !== text) handleCellEdit(i, col.key, v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                (e.currentTarget as HTMLElement).blur();
                              }
                            }}
                          >
                            {text}
                          </span>
                        ) : (
                          text
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
          {(() => {
            // Footer keeps the legacy "Reinsurance Share / Total" row but
            // becomes layout-agnostic: spans the first half for the label,
            // the last span for the currency+grand-total, and the rest is
            // filler. With dynamic column counts we split proportionally.
            // Multi-currency packets get one row per ISO code so a USD
            // subtotal never gets folded into a KRW grand total.
            const n = cols.length || 1;
            if (n < 3) return null;
            const lastTwo = 2;
            const labelSpan = Math.max(1, n - lastTwo);
            const rows = Array.from(totalsByCcy.entries());
            // Empty footer fallback — keeps the visual footer rule even
            // when there are no claim rows to total.
            if (rows.length === 0) {
              return (
                <tr style={{ background: "#fff4a3", borderTop: "1.5px solid #111" }}>
                  <td
                    colSpan={labelSpan}
                    style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, border: "1px solid #ccc" }}
                  >
                    {p.toReinsurer ? `${p.toReinsurer} Share` : "Reinsurance Share"}
                  </td>
                  <td
                    style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, border: "1px solid #ccc" }}
                  >
                    {ccyDefault}
                  </td>
                  <td
                    style={{
                      padding: "8px 6px",
                      textAlign: "right",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      border: "1px solid #ccc",
                    }}
                  >
                    {fmt(0, ccyDefault)}
                  </td>
                </tr>
              );
            }
            return rows.map(([ccy, total], i) => (
              <tr key={ccy} style={{ background: "#fff4a3", borderTop: i === 0 ? "1.5px solid #111" : undefined }}>
                <td
                  colSpan={labelSpan}
                  style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, border: "1px solid #ccc" }}
                >
                  {i === 0
                    ? (p.toReinsurer ? `${p.toReinsurer} Share` : "Reinsurance Share")
                    : ""}
                </td>
                <td
                  style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, border: "1px solid #ccc" }}
                >
                  {ccy}
                </td>
                <td
                  style={{
                    padding: "8px 6px",
                    textAlign: "right",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    border: "1px solid #ccc",
                  }}
                >
                  {fmt(total, ccy)}
                </td>
              </tr>
            ));
          })()}
        </tbody>
      </table>

      <div style={{ marginTop: 24, marginBottom: 12 }}>
        {closing}
      </div>

      {!isPLA && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>* Our Bank Details</div>
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            <div>Name of Bank: Shinhan Bank / Gwanggyo Middle Market</div>
            <div>Address of Bank : 54, Cheonggyecheon-ro, Jung-gu, Seoul 04540, Korea</div>
            <div>Swift Code : SHBKKRSE</div>
            <div>Beneficiary: INS Corp.</div>
            <div>Account No. : 180-004-410534 (All Other Currencies) / 140-008-142466 (Korea Currency)</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 6 }}>Sincerely yours,</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SIGNATURE_SHLEE_DATA_URL} alt="Signature" style={{ height: 48, display: "block", marginBottom: 4 }} />
          <div style={{ marginTop: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>S. H. Lee</div>
            <div style={{ fontWeight: 700, fontSize: 11 }}>REINSURANCE / MANAGING DIRECTOR (TEAM LEADER)</div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>INS CORP.</div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ins-logo-mark.png" alt="INS Corp" style={{ height: 70, opacity: 0.95 }} />
      </div>
    </div>
  );
}
