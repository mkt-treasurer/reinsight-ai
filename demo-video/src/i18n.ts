export type Lang = "ko" | "en";

type Copy = { ko: string; en: string };

const t = (ko: string, en: string): Copy => ({ ko, en });

export const brand = {
  wordmark: "TREASURER",
  confidential: t("CONFIDENTIAL · 대외비", "CONFIDENTIAL"),
  site: "insightre.ai",
  product: t("INS · 재보험 정산 AI", "INS · Reinsurance Settlement AI"),
};

export const videoTitles = {
  A: {
    kicker: t("PART A", "PART A"),
    title: t("문제를 통제한다", "Take control of the problem"),
    sub: t(
      "사람을 늘리기 전에, 업무량과 위험을 한 화면에서",
      "See the workload and the risk before you add headcount",
    ),
  },
  B: {
    kicker: t("PART B", "PART B"),
    title: t("AI가 만들고, 사람이 승인한다", "AI drafts, people approve"),
    sub: t(
      "기존 파일과 이메일을 버리지 않고, AI가 초안을 만들고 사람이 검수",
      "Keep your files and email — AI drafts, people review",
    ),
  },
  C: {
    kicker: t("PART C", "PART C"),
    title: t("운영이 되고, 계속 좋아진다", "It runs, and it keeps improving"),
    sub: t(
      "팀 운영과 포트폴리오를 숫자로, 정확도는 측정하며 개선",
      "Run the team on numbers; measure accuracy and improve",
    ),
  },
};

export const captions = {
  s1: t(
    "사람을 늘리기 전에, 업무량과 위험을 한 화면에서",
    "See workload and risk on one screen before adding headcount",
  ),
  s2: t(
    "SOC와 원장을 비교해 차이가 있는 계정만 확인",
    "Compare SOC against the ledger — surface only accounts that differ",
  ),
  s3: t(
    "모든 건 대신, 예외 건에만 집중 — 12,400행 전수 검사",
    "Skip the noise, focus on exceptions — 12,400 rows fully audited",
  ),
  s4: t(
    "이메일·엑셀·PDF에 흩어진 근거를 한 체인으로",
    "Evidence scattered across email, Excel and PDF — linked into one chain",
  ),
  s5: t(
    "기존 파일과 이메일을 버리지 않고, AI가 추출해 초안을 만듭니다",
    "AI extracts from your existing files and email to draft the slip",
  ),
  s6: t(
    "AI 결과를 바로 발송하지 않고, 사람의 검수와 수정 이력을 남깁니다",
    "Nothing ships unreviewed — every edit and approval is logged",
  ),
  s7: t(
    "팀 운영과 포트폴리오를 숫자로",
    "Run the team and the portfolio on numbers",
  ),
  s8: t(
    "데이터가 영업 인사이트로",
    "Turn data into commercial insight",
  ),
  s9: t(
    "정확도를 측정하고, 계속 개선합니다",
    "Measure accuracy — and keep improving it",
  ),
  s10: t(
    "2주 내 데이터 샘플 기반 PoC 착수 가능",
    "PoC on your data sample within two weeks",
  ),
};

// Opening intro (before Part A). Live-presented, so this is the presenter's setup.
export const intro = {
  eyebrow: t("TREASURER × INS 보험중개", "TREASURER × INS Reinsurance Broking"),
  keywords: [
    t("흩어진 정산 근거", "Scattered settlement evidence"),
    t("늘어나는 물량", "Rising volume"),
    t("한정된 인력", "Fixed headcount"),
  ],
  line: t(
    "재보험 정산은 SOC·보더로·인보이스가 이메일과 엑셀에 흩어진 채 사람 손으로 대사됩니다.",
    "Reinsurance settlement is reconciled by hand — SOC, bordereaux and invoices scattered across email and Excel.",
  ),
  promise: t("이 업무를 통제 가능하게 만듭니다.", "We make this work controllable."),
  roadmap: [
    t("통제한다", "Take control"),
    t("AI가 만들고 사람이 승인한다", "AI drafts, people approve"),
    t("운영하고 개선한다", "Operate & improve"),
  ],
};

// Full-screen feature intro cards (interstitial before each scene).
export const featureCards = {
  s1: { no: "01", title: t("통합 관제 대시보드", "Control-tower dashboard"), sub: t("이번 달 정산 업무량과 리스크를 한 화면에", "This month's workload and risk on one screen") },
  s2: { no: "02", title: t("계정별 자동 대사", "Account reconciliation"), sub: t("SOC와 원장을 비교, 차이 있는 계정만", "SOC vs ledger — only accounts that differ") },
  s3: { no: "03", title: t("예외 전수 검사", "Full-population audit"), sub: t("샘플링이 아니라 전 건, 예외만 집중", "Not sampling — every row, focus on exceptions") },
  s4: { no: "04", title: t("근거 체인", "Evidence chain"), sub: t("Treaty → BDX → SOC → Invoice를 하나로", "Treaty → BDX → SOC → Invoice, linked") },
  s5: { no: "05", title: t("AI 슬립 초안", "AI slip drafting"), sub: t("이메일·엑셀에서 추출해 초안 자동 생성", "Extracted from email & Excel into a draft") },
  s6: { no: "06", title: t("사람 검수 + 감사 이력", "Human review + audit trail"), sub: t("AI 초안은 바로 발송되지 않습니다", "AI drafts never ship unreviewed") },
  s7: { no: "07", title: t("팀 운영 대시보드", "Team operations"), sub: t("담당자 부하와 포트폴리오 손해율", "Handler load and portfolio loss ratio") },
  s8: { no: "08", title: t("데이터 → 영업 인사이트", "Data → commercial insight"), sub: t("뉴스에서 연관 계약을 자동 매칭", "News auto-matched to exposed treaties") },
  s9: { no: "09", title: t("정확도 측정 & 개선", "Measure & improve accuracy"), sub: t("필드별로 재고, 버전마다 좋아집니다", "Measured per field, better each version") },
};

export function pick(c: Copy, lang: Lang): string {
  return c[lang];
}
