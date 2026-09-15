// Shared, React-free data model for the placement RQ-slip document.
//
// Extracted from the rq-slip page so the text-based PDF renderer
// (`slipDoc.ts`) can import the SAME types + constants the editor uses —
// one source of truth, and importable from a plain Node verification
// harness (no React/DOM). Do NOT add React imports here.

export interface Discrepancy {
  field: string;
  rq_value: string;
  other_value: string;
  severity: "high" | "medium" | "low";
  note: string;
}

// Product/stage-specific fields the AI found on the cedent slip that don't map
// to a fixed field (e.g. D&O Discovery Period, Placing Written Line).
export interface AdditionalField {
  label: string;
  value: string;
  source?: string;
}

export interface RqExtract {
  line?: string;
  insured?: string;
  policy_holder?: string;
  reinsured?: string;
  location?: string;
  policy_period?: string;
  risk_description?: string;
  annual_turnover?: string;
  retroactive_date?: string;
  limit_of_liability?: string;
  deductible?: string;
  territory?: string;
  jurisdiction?: string;
  conditions?: string[];
  remarks?: string;
  currency?: string;
  reference_no?: string;
  doc_date?: string;
  target_premium?: string;
  ri_commission?: string;
  submission_deadline?: string;
  ri_capacity?: string;
  additional_fields?: AdditionalField[];
  discrepancies?: Discrepancy[];
  commercial?: Record<string, string>;
}

// INS Corp broker letterhead, transcribed from the real outgoing RQ slip
// sample (RQ_The Founders_CGL_UY2026.pdf). The broker identity is fixed.
export const BROKER = {
  name: "INS Corp.",
  address:
    "15th Floor, The Exchange Seoul, 21 Mugyo-ro, Jung-gu | Seoul, Korea 04520",
  contact: "TEL: +82-2-2088-2727 (Rep.) | FAX: +82-2-2088-2740 | www.dwins.co.kr",
  signerName: "S. H. LEE",
  signerTitle: "REINSURANCE / MANAGING DIRECTOR (TEAM LEADER)",
};

// The five INS Corp document types. RQ/Placing/Closing/Cover Note share the
// risk block; only the header, intro, closing line and financial block differ.
// Debit Note has a wholly separate layout (no risk block).
export type SlipType = "RQ" | "Placing" | "Closing" | "Cover Note" | "Debit Note";
export const SLIP_TYPES: SlipType[] = ["RQ", "Placing", "Closing", "Cover Note", "Debit Note"];

export interface SlipMeta {
  title: string;
  showLine: boolean;
  showTo: boolean;
  intro: string;
  closing: string;
  financial: string[];
}

export const SLIP_META: Record<SlipType, SlipMeta> = {
  RQ: {
    title: "Request of Rate Quotation on",
    showLine: true,
    showTo: false,
    intro:
      "With reference to the above account, you are duly requested to provide your rate quotation under the following terms and conditions.",
    closing:
      "It would be much appreciated if you could give us your feedback as soon as possible.",
    financial: ["Gross Premium (100%)", "Total Deduction", "R/I Capacity"],
  },
  Placing: {
    title: "Placing Order on",
    showLine: true,
    showTo: true,
    intro: "",
    closing:
      "It would be much appreciated if you could give us your feedback as soon as possible.",
    financial: ["Gross Premium", "R/I Share", "Total Deduction", "Net R/I Premium to Underwriter"],
  },
  Closing: {
    title: "Closing Order on",
    showLine: true,
    showTo: true,
    intro:
      "With regard to the captioned account, we are pleased to advise you reinsurance order as following terms and conditions.",
    closing:
      "It would be much appreciated if you could give us your feedback as soon as possible.",
    financial: ["Gross Premium", "R/I Share", "Total Deduction", "Net R/I Premium to Underwriter"],
  },
  "Cover Note": {
    title: "REINSURANCE COVER NOTE",
    showLine: false,
    showTo: true,
    intro: "",
    closing:
      "Please examine this document carefully and if either the terms do not comply with your instruction or the security is unacceptable please advise us immediately.",
    financial: ["Gross Premium (100%)", "R/I Comm.", "R/I Share(%)", "Security", "RI Conditions", "Net R/I Premium"],
  },
  "Debit Note": {
    title: "DEBIT NOTE",
    showLine: false,
    showTo: true,
    intro: "",
    closing: "",
    financial: [],
  },
};

// Slip PDF / attachment filename — shared by the download and email flows so
// the .eml attachment name matches the saved PDF exactly.
export function rqAttachmentName(slip: RqExtract | null, slipType: SlipType): string {
  const acc = (slip?.insured || "RQ").replace(/[\/\\:*?"<>|]/g, "").trim();
  return `${slipType.replace(/\s+/g, "_")}_${acc}.pdf`;
}
