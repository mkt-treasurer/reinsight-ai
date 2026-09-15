import { describe, it, expect } from "vitest";
import { buildSlipEmailDraft, type SlipEmailContext } from "./slipEmail";

const broker = {
  name: "INS Corp.",
  signerName: "S. H. Lee",
  signerTitle: "REINSURANCE / MANAGING DIRECTOR",
  contact: "TEL: +82-2-2088-2727",
};

const placement = (over: Partial<SlipEmailContext> = {}): SlipEmailContext => ({
  kind: "placement",
  lang: "en",
  docTypeLabel: "Request for Quotation",
  docTypeLabelKo: "요율 견적 요청서",
  account: "The Founders Inc.",
  reinsured: "ABC Insurance Co.",
  reinsurerName: "Munich Re",
  line: "D&O Liability",
  policyPeriod: "2026-07-01 ~ 2027-06-30",
  reference: "RQ-2026-001",
  deadline: "2026-06-25",
  attachmentName: "RQ_The Founders.pdf",
  broker,
  ...over,
});

describe("buildSlipEmailDraft — English placement", () => {
  const d = buildSlipEmailDraft(placement());

  it("builds the bracketed subject with account and line", () => {
    expect(d.subject).toBe(
      "[INS Corp.] Request for Quotation - The Founders Inc. (D&O Liability)"
    );
  });

  it("greets the named reinsurer", () => {
    expect(d.body).toContain("Dear Munich Re,");
  });

  it("includes the quotation deadline line for placement", () => {
    expect(d.body).toContain("Quotation Deadline");
    expect(d.body).toContain("As the quotation deadline is 2026-06-25");
  });

  it("names the attachment and signs off with the broker block", () => {
    expect(d.body).toContain("RQ_The Founders.pdf");
    expect(d.body).toContain("Best regards,");
    expect(d.body).toContain("S. H. Lee");
    expect(d.body).toContain("INS Corp.");
  });
});

describe("buildSlipEmailDraft — Korean placement", () => {
  const d = buildSlipEmailDraft(placement({ lang: "ko" }));

  it("uses the Korean document label in the subject", () => {
    expect(d.subject).toBe(
      "[INS Corp.] 요율 견적 요청서 - The Founders Inc. (D&O Liability)"
    );
  });

  it("uses Korean greeting, field labels and closing", () => {
    expect(d.body).toContain("Munich Re 담당자님께,");
    expect(d.body).toContain("계정 / 피보험자");
    expect(d.body).toContain("견적 마감일은 2026-06-25이오니");
    expect(d.body).toContain("감사합니다.");
  });

  it("falls back to the English label when docTypeLabelKo is absent", () => {
    const d2 = buildSlipEmailDraft(placement({ lang: "ko", docTypeLabelKo: undefined }));
    expect(d2.subject).toContain("Request for Quotation");
  });
});

describe("buildSlipEmailDraft — claim track", () => {
  const claim = (over: Partial<SlipEmailContext> = {}): SlipEmailContext => ({
    kind: "claim",
    lang: "en",
    docTypeLabel: "Statement of Claims",
    docTypeLabelKo: "클레임 명세서",
    account: "Hyundai Steel",
    reinsured: "Korean Re",
    reinsurerName: "Swiss Re",
    line: "Property",
    deadline: "2026-06-25",
    attachmentName: "SOC_Hyundai.pdf",
    broker,
    ...over,
  });

  it("omits the quotation-deadline row even when a deadline is present", () => {
    const d = buildSlipEmailDraft(claim());
    expect(d.body).not.toContain("Quotation Deadline");
    expect(d.body).toContain("for your kind attention and necessary action");
  });

  it("uses the claim closing line in Korean", () => {
    const d = buildSlipEmailDraft(claim({ lang: "ko" }));
    expect(d.body).toContain("검토 후 필요한 조치를 부탁드립니다");
    expect(d.body).toContain("언제든지 연락 주시기 바랍니다");
  });
});

describe("buildSlipEmailDraft — field omission & fallbacks", () => {
  it("drops empty rows instead of printing blank labels", () => {
    const d = buildSlipEmailDraft(placement({ reinsured: "", reference: "", line: "" }));
    expect(d.body).not.toContain("Reinsured");
    expect(d.body).not.toContain("Reference");
    // No line → subject has no trailing "( )"
    expect(d.subject).toBe("[INS Corp.] Request for Quotation - The Founders Inc.");
  });

  it("greets generically when no reinsurer name is given", () => {
    expect(buildSlipEmailDraft(placement({ reinsurerName: "" })).body).toContain("Dear Sir/Madam,");
    expect(buildSlipEmailDraft(placement({ lang: "ko", reinsurerName: "" })).body).toContain(
      "담당자님께,"
    );
  });

  it("uses the generic deadline closing when none is set (placement)", () => {
    const d = buildSlipEmailDraft(placement({ deadline: "" }));
    expect(d.body).toContain("Your prompt response would be much appreciated.");
    expect(d.body).not.toContain("Quotation Deadline");
  });

  it("produces different output per language", () => {
    const en = buildSlipEmailDraft(placement({ lang: "en" }));
    const ko = buildSlipEmailDraft(placement({ lang: "ko" }));
    expect(en.subject).not.toBe(ko.subject);
    expect(en.body).not.toBe(ko.body);
  });
});
