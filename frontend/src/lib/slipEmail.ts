// Auto-fills a delivery email (subject + body) from slip data so the operator
// gets a complete first draft the moment a slip PDF is generated. Both the
// placement track (RQ slip generator) and the claims track (slip generator)
// feed the same builder; `kind` selects the cover-note wording, `lang`
// selects English vs Korean, and every field row is filled from whatever the
// slip actually carries.
//
// Deliberately a plain template — no AI call, no backend dependency — so the
// draft is instant and predictable. The operator edits it in the compose
// modal before exporting the .eml, and can flip language on the fly.

export type SlipEmailKind = "placement" | "claim";
export type SlipEmailLang = "en" | "ko";

export interface SlipEmailBroker {
  name: string;
  signerName?: string;
  signerTitle?: string;
  contact?: string;
}

export interface SlipEmailContext {
  kind: SlipEmailKind;
  lang: SlipEmailLang;
  /** English document name, e.g. "Request for Quotation", "Statement of Claims". */
  docTypeLabel: string;
  /** Korean document name; falls back to `docTypeLabel` when omitted. */
  docTypeLabelKo?: string;
  /** Insured / account name (the captioned account). */
  account?: string;
  /** Ceding company. */
  reinsured?: string;
  /** Recipient reinsurer company — used for the greeting line. */
  reinsurerName?: string;
  line?: string;
  policyPeriod?: string;
  reference?: string;
  /** Quotation / response deadline (placement track). */
  deadline?: string;
  /** Attachment filename, surfaced in the body so the recipient knows what to expect. */
  attachmentName?: string;
  broker: SlipEmailBroker;
}

export interface SlipEmailDraft {
  subject: string;
  body: string;
}

type LabelledPair = [label: string, value: string | undefined];

// Join non-empty rows. `pad` lines up English labels in a monospace-ish way;
// Korean labels are wide/variable so they pass pad=0 and rely on the colon.
function rows(pairs: LabelledPair[], pad: number): string {
  return pairs
    .map(([label, value]) => {
      const v = (value ?? "").trim();
      if (!v) return null;
      const head = pad > 0 ? label.padEnd(pad) : label;
      return `    ${head}: ${v}`;
    })
    .filter((r): r is string => r !== null)
    .join("\n");
}

function signatureLines(broker: SlipEmailBroker, salutation: string): string {
  return [salutation, "", broker.signerName, broker.signerTitle, broker.name, broker.contact]
    .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
    .join("\n");
}

function buildEnglish(ctx: SlipEmailContext): SlipEmailDraft {
  const account = (ctx.account ?? "").trim();
  const subject = [
    `[${ctx.broker.name}] ${ctx.docTypeLabel}`,
    account ? `- ${account}` : "",
    ctx.line ? `(${ctx.line.trim()})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const greeting = ctx.reinsurerName?.trim()
    ? `Dear ${ctx.reinsurerName.trim()},`
    : "Dear Sir/Madam,";

  const intro =
    ctx.kind === "placement"
      ? `Please find attached our ${ctx.docTypeLabel} for the captioned account. We would be grateful for your rate quotation under the attached terms and conditions at your earliest convenience.`
      : `Please find attached the ${ctx.docTypeLabel} for the captioned account for your kind attention and necessary action.`;

  const detail = rows(
    [
      ["Account / Insured", ctx.account],
      ["Reinsured", ctx.reinsured],
      ["Class of Business", ctx.line],
      ["Period", ctx.policyPeriod],
      ["Reference", ctx.reference],
      ...(ctx.kind === "placement"
        ? ([["Quotation Deadline", ctx.deadline]] as LabelledPair[])
        : []),
    ],
    20
  );

  const attachmentNote = ctx.attachmentName
    ? `The attached document (${ctx.attachmentName}) contains the full details.`
    : "";

  const closing =
    ctx.kind === "placement"
      ? ctx.deadline?.trim()
        ? `As the quotation deadline is ${ctx.deadline.trim()}, your prompt response would be much appreciated.`
        : "Your prompt response would be much appreciated."
      : "Should you require any further information, please do not hesitate to contact us.";

  const body = [greeting, intro, detail, attachmentNote, closing, signatureLines(ctx.broker, "Best regards,")]
    .filter((b) => b.trim().length > 0)
    .join("\n\n");

  return { subject, body };
}

function buildKorean(ctx: SlipEmailContext): SlipEmailDraft {
  const label = (ctx.docTypeLabelKo ?? ctx.docTypeLabel).trim();
  const account = (ctx.account ?? "").trim();
  const subject = [
    `[${ctx.broker.name}] ${label}`,
    account ? `- ${account}` : "",
    ctx.line ? `(${ctx.line.trim()})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const greeting = ctx.reinsurerName?.trim()
    ? `${ctx.reinsurerName.trim()} 담당자님께,`
    : "담당자님께,";

  const intro =
    ctx.kind === "placement"
      ? `상기 건에 대한 ${label}를 첨부하여 송부드립니다. 첨부된 조건에 따라 요율 견적을 가능한 한 빠른 시일 내에 회신해 주시면 감사하겠습니다.`
      : `상기 건에 대한 ${label}를 첨부하오니, 검토 후 필요한 조치를 부탁드립니다.`;

  const detail = rows(
    [
      ["계정 / 피보험자", ctx.account],
      ["원수사", ctx.reinsured],
      ["보종", ctx.line],
      ["보험기간", ctx.policyPeriod],
      ["참조번호", ctx.reference],
      ...(ctx.kind === "placement"
        ? ([["견적 마감일", ctx.deadline]] as LabelledPair[])
        : []),
    ],
    0
  );

  const attachmentNote = ctx.attachmentName
    ? `첨부 문서(${ctx.attachmentName})에 상세 내용이 포함되어 있습니다.`
    : "";

  const closing =
    ctx.kind === "placement"
      ? ctx.deadline?.trim()
        ? `견적 마감일은 ${ctx.deadline.trim()}이오니, 신속한 회신 부탁드립니다.`
        : "신속한 회신 부탁드립니다."
      : "추가로 필요하신 정보가 있으시면 언제든지 연락 주시기 바랍니다.";

  const body = [greeting, intro, detail, attachmentNote, closing, signatureLines(ctx.broker, "감사합니다.")]
    .filter((b) => b.trim().length > 0)
    .join("\n\n");

  return { subject, body };
}

export function buildSlipEmailDraft(ctx: SlipEmailContext): SlipEmailDraft {
  return ctx.lang === "ko" ? buildKorean(ctx) : buildEnglish(ctx);
}
