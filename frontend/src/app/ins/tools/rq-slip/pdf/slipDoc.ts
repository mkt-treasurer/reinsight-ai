// Text-based PDF renderer for the placement RQ slip.
//
// Replaces the previous html2canvas → PNG raster export. The whole slip is
// drawn with jsPDF's TEXT api and an embedded Korean font (Nanum Gothic), which
// fixes the cedent-broker (INS) feedback the raster export could not:
//   • the slip text is SELECTABLE / copyable (real text, not an image)
//   • Korean + Latin share ONE embedded font (visual consistency)
//   • no stray dashed "____" underline (that was an <input> affordance)
//   • output is a fraction of the previous multi-MB size
//   • rows never split mid-line across a page (we paginate between rows)
//
// Framework-agnostic on purpose: it takes a jsPDF instance with the font
// already registered plus pre-decoded image data URLs, so the same function
// runs in the browser (download + .eml attachment) and in a Node verification
// harness. No React / DOM imports here.

import type { jsPDF } from "jspdf";
import { RqExtract, SlipType, SLIP_META, BROKER } from "./slipModel";

export interface SlipAssets {
  /** Registered font family name in the jsPDF VFS (regular + bold styles). */
  fontFamily: string;
  /** /ins_logo.png as a data URL, for the repeated letterhead. Optional. */
  logoDataUrl?: string;
  /** /ins_signature.png as a data URL, for the signature block. Optional. */
  signatureDataUrl?: string;
}

// ── Geometry (mm) ─────────────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LABEL_W = 40;
const VALUE_X = MARGIN + LABEL_W + 3;
const VALUE_W = PAGE_W - MARGIN - VALUE_X;
const FOOTER_RESERVE = 16; // mm kept clear at the bottom for the footer logo
const ROW_PAD = 1.6; // mm below each field row

// Type sizes (pt) and colours (r,g,b).
const PT_TO_MM = 0.352778;
const SZ = { title: 12, section: 8, label: 7.5, value: 8.5, small: 7 };
const INK: [number, number, number] = [15, 23, 42]; // slate-900
const VAL: [number, number, number] = [30, 41, 59]; // slate-800
const MUTE: [number, number, number] = [100, 116, 139]; // slate-500
const LINE: [number, number, number] = [203, 213, 225]; // slate-300

// Debit Note amount rows (mirrors DEBIT_AMOUNTS on the page).
const DEBIT_AMOUNTS = [
  "Gross Premium (100%)",
  "R/I Share (%)",
  "R/I Commission (%)",
  "Due from you",
  "Premium Due by (PPW days)",
];

const lh = (pt: number) => pt * PT_TO_MM * 1.32; // line height for a size

function clean(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

// Nanum Gothic lacks the CJK "compatibility" unit glyphs (㎡, ㎏, …) that
// Korean insurance docs use for areas/weights — jsPDF silently DROPS glyphs
// missing from the embedded font, so "Area(㎡)" would print as "Area()".
// Map the common ones to portable Latin equivalents the font does have.
const GLYPH_FALLBACKS: [RegExp, string][] = [
  [/㎡/g, "m²"], [/㎥/g, "m³"], [/㎟/g, "mm²"], [/㎠/g, "cm²"], [/㎢/g, "km²"],
  [/㎜/g, "mm"], [/㎝/g, "cm"], [/㎞/g, "km"], [/㎏/g, "kg"], [/㎎/g, "mg"],
  [/㎖/g, "ml"], [/㎗/g, "dl"], [/ℓ/g, "L"], [/㎪/g, "kPa"], [/℃/g, "°C"],
];
function sanitizeGlyphs(s: string): string {
  return GLYPH_FALLBACKS.reduce((acc, [re, to]) => acc.replace(re, to), s);
}

/**
 * Draw the full slip onto `pdf`. The caller creates the jsPDF (unit "mm",
 * A4, portrait), registers the font as `assets.fontFamily`, and passes any
 * image data URLs. Mutates `pdf` (adds pages/content); returns nothing.
 */
export function drawSlipPdf(
  pdf: jsPDF,
  slip: RqExtract,
  slipType: SlipType,
  assets: SlipAssets
): void {
  const F = assets.fontFamily;
  const meta = SLIP_META[slipType];
  let y = MARGIN; // running TOP of the next content block

  const setStyle = (
    style: "normal" | "bold",
    size: number,
    color: [number, number, number]
  ) => {
    pdf.setFont(F, style);
    pdf.setFontSize(size);
    pdf.setTextColor(color[0], color[1], color[2]);
  };

  // Draw one text line whose TOP edge is at `top` (baseline ≈ top + 0.82em).
  // Single choke point for glyph sanitisation — every drawn string (including
  // wrapped substrings from splitTextToSize) passes through here.
  const lineAt = (text: string, x: number, top: number, size: number) => {
    pdf.text(sanitizeGlyphs(text), x, top + size * PT_TO_MM * 0.82);
  };

  const footerLimit = () => PAGE_H - FOOTER_RESERVE;

  const drawLetterhead = () => {
    const top = MARGIN;
    if (assets.logoDataUrl) {
      try {
        pdf.addImage(assets.logoDataUrl, "PNG", MARGIN, top, 30, 8.5);
      } catch {
        setStyle("bold", SZ.title, INK);
        lineAt(BROKER.name, MARGIN, top, SZ.title);
      }
    } else {
      setStyle("bold", SZ.title, INK);
      lineAt(BROKER.name, MARGIN, top, SZ.title);
    }
    setStyle("normal", SZ.small, MUTE);
    lineAt(BROKER.address, MARGIN, top + 9.5, SZ.small);
    lineAt(BROKER.contact, MARGIN, top + 9.5 + lh(SZ.small), SZ.small);
    const bottom = top + 9.5 + lh(SZ.small) * 2 + 1.5;
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN, bottom, PAGE_W - MARGIN, bottom);
    return bottom + 4;
  };

  const drawFooterLogo = () => {
    const fy = PAGE_H - FOOTER_RESERVE + 4;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, fy, PAGE_W - MARGIN, fy);
    if (assets.logoDataUrl) {
      try {
        pdf.addImage(assets.logoDataUrl, "PNG", PAGE_W - MARGIN - 22, fy + 2, 22, 6.2);
      } catch {
        /* logo optional in footer */
      }
    }
  };

  const newPage = () => {
    drawFooterLogo();
    pdf.addPage();
    y = drawLetterhead();
  };

  const ensure = (h: number) => {
    if (y + h > footerLimit()) newPage();
  };

  const sep = () => {
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.15);
    pdf.line(MARGIN, y - ROW_PAD / 2, PAGE_W - MARGIN, y - ROW_PAD / 2);
  };

  // A label/value row. `value` may contain "\n" — line breaks are preserved.
  const row = (label: string, value: string, opts: { sepLine?: boolean } = {}) => {
    setStyle("bold", SZ.label, INK);
    const labelLines = pdf.splitTextToSize(label, LABEL_W) as string[];
    setStyle("normal", SZ.value, VAL);
    const valueLines = pdf.splitTextToSize(value || "—", VALUE_W) as string[];
    const rows = Math.max(labelLines.length, valueLines.length);
    const h = rows * lh(SZ.value) + ROW_PAD;
    ensure(h);
    setStyle("bold", SZ.label, INK);
    labelLines.forEach((l, i) => lineAt(l, MARGIN, y + i * lh(SZ.value), SZ.label));
    setStyle("normal", SZ.value, VAL);
    valueLines.forEach((l, i) => lineAt(l, VALUE_X, y + i * lh(SZ.value), SZ.value));
    y += h;
    if (opts.sepLine !== false) sep();
  };

  // A full-width wrapped paragraph (intro / closing / clause).
  const paragraph = (
    text: string,
    x: number,
    width: number,
    size: number,
    color: [number, number, number],
    style: "normal" | "bold" = "normal"
  ) => {
    setStyle(style, size, color);
    const lines = pdf.splitTextToSize(text, width) as string[];
    lines.forEach((l) => {
      ensure(lh(size));
      lineAt(l, x, y, size);
      y += lh(size);
    });
  };

  const gap = (mm: number) => {
    y += mm;
  };

  // ── First page letterhead ────────────────────────────────────────────────
  y = drawLetterhead();

  if (slipType === "Debit Note") {
    drawDebitNote();
  } else {
    drawStandardSlip();
  }
  drawFooterLogo();

  // ── Standard slip (RQ / Placing / Closing / Cover Note) ───────────────────
  function drawStandardSlip() {
    // Title box.
    const c = slip.commercial || {};
    const titleLines: { t: string; bold: boolean; size: number }[] = [];
    if (meta.showTo) titleLines.push({ t: `To: ${clean(c["To"]) || "—"}`, bold: false, size: SZ.value });
    let head = meta.title;
    if (meta.showLine && clean(slip.line)) head += ` ${clean(slip.line)}`;
    if (slipType === "Cover Note" && clean(c["No."])) head += ` (No. ${clean(c["No."])})`;
    titleLines.push({ t: head, bold: true, size: SZ.value + 1 });
    titleLines.push({ t: `A/C: ${clean(slip.insured) || "—"}`, bold: false, size: SZ.value });

    const boxPad = 2;
    const boxH = titleLines.reduce((s, l) => s + lh(l.size), 0) + boxPad * 2;
    ensure(boxH + 2);
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.4);
    pdf.rect(MARGIN, y, CONTENT_W, boxH);
    let ty = y + boxPad;
    titleLines.forEach((l) => {
      setStyle(l.bold ? "bold" : "normal", l.size, INK);
      lineAt(l.t, MARGIN + 3, ty, l.size);
      ty += lh(l.size);
    });
    y += boxH + 3;

    if (clean(meta.intro)) {
      paragraph(meta.intro, MARGIN, CONTENT_W, SZ.small, VAL);
      gap(2);
    }

    // Body rows (order mirrors the on-screen slip + INS template).
    if (clean(slip.policy_holder) && clean(slip.policy_holder) !== clean(slip.insured)) {
      row("Policy Holder", clean(slip.policy_holder));
    }
    row("Insured", clean(slip.insured));
    row("Location", clean(slip.location));
    row("Reinsured", clean(slip.reinsured));

    // Covered Risk (+ Annual Turnover sub-block when present).
    {
      const riskText = clean(slip.risk_description);
      const turnover = clean(slip.annual_turnover);
      const value = turnover
        ? `${riskText}\n\nAnnual Turnover:\n${turnover}`
        : riskText;
      row("Covered Risk", value);
    }

    row("Policy Period", clean(slip.policy_period));
    if (clean(slip.retroactive_date)) row("Retroactive Date", clean(slip.retroactive_date));
    row("Limit of Liability", clean(slip.limit_of_liability));
    row("Deductible", clean(slip.deductible));

    // Territory & Jurisdiction: one row when identical (or jurisdiction blank),
    // two rows when they genuinely differ (per INS feedback).
    const terr = clean(slip.territory);
    const juris = clean(slip.jurisdiction);
    if (!juris || terr === juris) {
      row("Policy Territory & Jurisdiction", terr);
    } else {
      row("Policy Territory", terr);
      row("Policy Jurisdiction", juris);
    }

    // Additional fields.
    (slip.additional_fields || []).forEach((f) => {
      if (clean(f.label) || clean(f.value)) row(clean(f.label) || "—", clean(f.value));
    });

    // Terms & Conditions — numbered clause list.
    const conditions = (slip.conditions || []).map(clean).filter(Boolean);
    if (conditions.length) {
      gap(1);
      ensure(lh(SZ.section) + 1);
      setStyle("bold", SZ.section, INK);
      lineAt("Terms & Conditions", MARGIN, y, SZ.section);
      y += lh(SZ.section) + 0.5;
      conditions.forEach((clause, i) => {
        paragraph(`${i + 1}) ${clause}`, MARGIN, CONTENT_W, SZ.small, VAL);
      });
      setStyle("normal", SZ.small, MUTE);
      ensure(lh(SZ.small));
      lineAt(`${conditions.length} clauses`, MARGIN, y, SZ.small);
      y += lh(SZ.small) + 1;
    }

    // Remarks.
    if (clean(slip.remarks)) {
      gap(1);
      ensure(lh(SZ.section) + 1);
      setStyle("bold", SZ.section, INK);
      lineAt("Remarks", MARGIN, y, SZ.section);
      y += lh(SZ.section) + 0.5;
      paragraph(clean(slip.remarks), MARGIN, CONTENT_W, SZ.small, VAL);
    }

    // Financial / commercial block — two columns.
    if (meta.financial.length) {
      gap(4);
      const colW = (CONTENT_W - 8) / 2;
      const colX = [MARGIN, MARGIN + colW + 8];
      for (let i = 0; i < meta.financial.length; i += 2) {
        const pair = meta.financial.slice(i, i + 2);
        // Height for this pair: label line + value line + underline.
        const cellH = lh(SZ.label) + lh(SZ.value) + 3;
        ensure(cellH);
        pair.forEach((lbl, j) => {
          const x = colX[j];
          setStyle("bold", SZ.label, INK);
          lineAt(lbl, x, y, SZ.label);
          const v = clean((slip.commercial || {})[lbl]);
          setStyle("normal", SZ.value, VAL);
          lineAt(v || "", x, y + lh(SZ.label), SZ.value);
          pdf.setDrawColor(...LINE);
          pdf.setLineWidth(0.2);
          const uy = y + lh(SZ.label) + lh(SZ.value) + 1;
          pdf.line(x, uy, x + colW, uy);
        });
        y += cellH;
      }
    }

    if (clean(meta.closing)) {
      gap(4);
      paragraph(meta.closing, MARGIN, CONTENT_W, SZ.small, VAL);
    }

    drawSignature();
  }

  // ── Debit Note (distinct layout: refs + amount table + bank block) ────────
  function drawDebitNote() {
    const c = slip.commercial || {};
    gap(1);
    ensure(lh(SZ.title));
    setStyle("bold", SZ.title, INK);
    lineAt("DEBIT NOTE", MARGIN, y, SZ.title);
    y += lh(SZ.title) + 2;

    row("To:", clean(c["To"]));
    row("Date", clean(c["Date"]));
    row("Your Ref.", clean(c["Your Ref."]));
    row("Our Ref.", clean(c["Our Ref."]));
    row("Contact", clean(c["Contact"]));
    row("Reinsured", clean(slip.reinsured));
    row("Original Insured", clean(slip.insured));
    row("Risk", clean(slip.risk_description));
    row("Period", clean(slip.policy_period));

    gap(2);
    ensure(lh(SZ.section));
    setStyle("bold", SZ.section, INK);
    lineAt("Amount (KRW)", MARGIN, y, SZ.section);
    y += lh(SZ.section) + 1;
    DEBIT_AMOUNTS.forEach((k) => row(k, clean(c[k])));

    gap(2);
    paragraph(
      "<Our Bank Detail>\nBank Name : Shinhan Bank (Corporate Investment Banking Center)\nKorean Currency : 140-008-142466 · Other Currencies : 180-004-410534\nSwift Code : SHBKKRSE",
      MARGIN,
      CONTENT_W,
      SZ.small,
      MUTE
    );
    drawSignature();
  }

  function drawSignature() {
    gap(6);
    ensure(24);
    setStyle("normal", SZ.small, VAL);
    lineAt("Sincerely yours,", MARGIN, y, SZ.small);
    y += lh(SZ.small) + 1;
    if (assets.signatureDataUrl) {
      try {
        pdf.addImage(assets.signatureDataUrl, "PNG", MARGIN + 2, y, 32, 13);
      } catch {
        /* signature optional */
      }
    }
    y += 14;
    pdf.setDrawColor(...MUTE);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, y, MARGIN + 55, y);
    y += 1;
    setStyle("bold", SZ.label, INK);
    lineAt(BROKER.signerName, MARGIN, y, SZ.label);
    y += lh(SZ.label);
    setStyle("normal", SZ.small, MUTE);
    lineAt(BROKER.signerTitle, MARGIN, y, SZ.small);
    y += lh(SZ.small);
    lineAt(BROKER.name.toUpperCase(), MARGIN, y, SZ.small);
    y += lh(SZ.small);
  }
}
