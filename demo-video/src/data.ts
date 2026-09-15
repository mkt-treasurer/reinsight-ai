// Realistic reinsurance-broker domain data. No placeholders — every value is
// plausible for a Korean cedant ↔ global reinsurer settlement desk.

export const cedants = ["삼성화재", "DB손해보험", "현대해상", "KB손해보험", "메리츠화재"];
export const reinsurers = ["Swiss Re", "Munich Re", "Korean Re", "SCOR", "Hannover Re"];

export const overviewKpis = [
  { label: "ACCOUNTS", ko: "이번 달 처리 계정", value: 48, suffix: "건", tone: "neutral" as const },
  { label: "DISCREPANCIES", ko: "불일치", value: 6, suffix: "건", tone: "critical" as const, action: true },
  { label: "OUTSTANDING", ko: "미입금", value: 340, prefix: "₩", suffix: "M", tone: "warning" as const },
  { label: "AVG CYCLE", ko: "평균 정산 소요", value: 11, suffix: "일", delta: "-4", tone: "positive" as const },
];

export const riskAlerts = [
  { sev: "critical", ref: "SOC-2026-0417", ko: "Swiss Re · Property Cat XL — SOC 대비 한도 초과 ₩12.4M", age: "2일" },
  { sev: "critical", ref: "SOC-2026-0392", ko: "Munich Re · Marine — 수수료율 불일치 (12.5% vs 15.0%)", age: "3일" },
  { sev: "warning", ref: "INV-2026-1188", ko: "Korean Re · Casualty QS — 입금 지연 41일 경과", age: "41일" },
  { sev: "warning", ref: "BDX-2026-0203", ko: "현대해상 → SCOR — 3월 BDX 미수신", age: "6일" },
];

// Claims by account — 48 total, 6 with SOC↔ledger differences.
export const accounts = [
  { name: "삼성화재 / Swiss Re", line: "Property Cat XL", cur: "USD", total: 4_820_000, open: 1_120_000, diff: 12_400, re: 3 },
  { name: "DB손해보험 / Munich Re", line: "Marine", cur: "USD", total: 2_140_000, open: 640_000, diff: -8_900, re: 2 },
  { name: "현대해상 / Korean Re", line: "Casualty QS", cur: "KRW", total: 3_310_000_000, open: 980_000_000, diff: 5_600_000, re: 4 },
  { name: "KB손해보험 / SCOR", line: "Property Cat XL", cur: "USD", total: 1_760_000, open: 210_000, diff: 3_200, re: 2 },
  { name: "메리츠화재 / Hannover Re", line: "Aviation", cur: "USD", total: 980_000, open: 0, diff: 1_450, re: 1 },
  { name: "삼성화재 / Munich Re", line: "Engineering", cur: "KRW", total: 1_240_000_000, open: 320_000_000, diff: -2_100_000, re: 2 },
  // matched (no diff) — shown before the toggle
  { name: "DB손해보험 / Korean Re", line: "Motor QS", cur: "KRW", total: 890_000_000, open: 0, diff: 0, re: 1 },
  { name: "현대해상 / Swiss Re", line: "Marine", cur: "USD", total: 1_430_000, open: 0, diff: 0, re: 2 },
  { name: "KB손해보험 / Hannover Re", line: "Casualty QS", cur: "USD", total: 720_000, open: 0, diff: 0, re: 1 },
  { name: "메리츠화재 / SCOR", line: "Property Cat XL", cur: "USD", total: 2_050_000, open: 0, diff: 0, re: 3 },
];

export const auditTabs = [
  { key: "stuck", ko: "정체 > 3일", en: "STUCK", count: 9 },
  { key: "unpaid", ko: "미입금", en: "UNPAID", count: 14 },
  { key: "unchecked", ko: "미검수", en: "UNCHECKED", count: 7 },
];
export const auditTotalRows = 12_400;
export const auditExceptions = [
  { sev: "critical", ref: "SOC-2026-0417", ko: "한도 초과 · 검수 대기", days: 2 },
  { sev: "warning", ref: "INV-2026-1188", ko: "입금 지연 41일", days: 41 },
  { sev: "warning", ref: "SOC-2026-0392", ko: "수수료율 재확인 필요", days: 3 },
  { sev: "critical", ref: "BDX-2026-0203", ko: "3월 BDX 미수신", days: 6 },
  { sev: "info", ref: "SOC-2026-0455", ko: "환율 스냅샷 갱신 필요", days: 1 },
];

// Document chain: Treaty → BDX → SOC → Invoice
export const docChain = [
  { key: "TREATY", ko: "요율서·특약", id: "TRY-2026-0031", meta: "Property Cat XL 2026" },
  { key: "BDX", ko: "보더로", id: "BDX-2026-0203", meta: "Q1 Premium Bordereaux" },
  { key: "SOC", ko: "정산명세", id: "SOC-2026-0417", meta: "Statement of Account" },
  { key: "INVOICE", ko: "인보이스", id: "INV-2026-1188", meta: "USD 1,120,000 due" },
];

// Slip generator source email → extracted RQ slip fields
export const sourceEmail = {
  from: "underwriting@swissre.com",
  subject: "RE: Property Cat XL 2026 — Renewal Quote (삼성화재)",
  lines: [
    "Dear Team,",
    "We are pleased to quote the 2026 renewal of the Property Cat XL",
    "programme for 삼성화재 (Samsung F&M) as follows:",
    "",
    "  • Layer:      USD 20,000,000 xs USD 10,000,000",
    "  • Rate:       4.85% of GNPI",
    "  • Brokerage:  15.0%",
    "  • Period:     01 Jan 2026 – 31 Dec 2026",
    "  • Share:      Swiss Re 35% (leader)",
    "",
    "Please revert with the signed slip. Best regards,",
  ],
};
export const slipFields = [
  { label: "Reinsured", ko: "원수사", value: "삼성화재 (Samsung Fire & Marine)", src: { where: "이메일 3문단", tone: "email" } },
  { label: "To. (Reinsurer)", ko: "재보험사", value: "Swiss Re", src: { where: "이메일 서명", tone: "email" } },
  { label: "Class", ko: "종목", value: "Property Cat XL", src: { where: "이메일 제목", tone: "email" } },
  { label: "Limit", ko: "한도", value: "USD 20,000,000 xs 10,000,000", src: { where: "엑셀 B12", tone: "excel" } },
  { label: "Rate", ko: "요율", value: "4.85% of GNPI", src: { where: "엑셀 B14", tone: "excel" } },
  { label: "Brokerage", ko: "수수료", value: "15.0%", src: { where: "엑셀 B16", tone: "excel" } },
  { label: "Period", ko: "기간", value: "01 Jan – 31 Dec 2026", src: { where: "이메일 4문단", tone: "email" } },
  { label: "Order Hereon", ko: "인수지분", value: "35% (Leader)", src: { where: "이메일 5문단", tone: "email" } },
];

// Review queue: AI draft vs revised + audit log
export const reviewDiff = [
  { field: "Brokerage", ai: "12.5%", human: "15.0%", changed: true },
  { field: "Limit", ai: "USD 20,000,000 xs 10,000,000", human: "USD 20,000,000 xs 10,000,000", changed: false },
  { field: "Period", ai: "01 Jan – 31 Dec 2026", human: "01 Jan – 31 Dec 2026", changed: false },
  { field: "Order Hereon", ai: "30%", human: "35% (Leader)", changed: true },
];
export const auditLog = [
  { actor: "ARIA", role: "AI", ko: "초안 생성", en: "draft generated", at: "09:14:02" },
  { actor: "김서연", role: "검수", ko: "수수료·지분 수정", en: "brokerage & share edited", at: "09:21:37" },
  { actor: "박준호", role: "승인", ko: "발송 승인", en: "approved for issue", at: "09:26:10" },
];

// Weekly dashboard — handler heatmap + loss ratio
export const handlers = ["김서연", "박준호", "이도현", "정하늘", "최민석"];
export const heatmap = [
  [8, 12, 6, 14, 9],
  [11, 7, 13, 5, 10],
  [6, 9, 15, 8, 12],
  [13, 10, 7, 11, 6],
];
export const lossRatio = [
  { m: "Jan", v: 61 }, { m: "Feb", v: 58 }, { m: "Mar", v: 72 },
  { m: "Apr", v: 64 }, { m: "May", v: 55 }, { m: "Jun", v: 49 },
];

// News insights → treaty match → chat
export const newsCard = {
  tag: "MARKET · RATES",
  ko: "1월 갱신 Property Cat 요율 8% 하락",
  en: "Jan renewal Property Cat rates down 8%",
  src: "Reinsurance News · 2026-01-08",
};
export const matchedTreaties = [
  { id: "TRY-2026-0031", ko: "삼성화재 Property Cat XL", pct: 92 },
  { id: "TRY-2026-0044", ko: "KB손보 Property Cat XL", pct: 87 },
];
export const chatAnswer = {
  ko: "삼성화재·KB손보 Property Cat XL 2건이 영향권입니다. 요율 8% 하락 반영 시 예상 수재보험료 −USD 1.9M, 갱신 협상에서 브로커리지 방어 여지가 커집니다.",
  en: "Two Property Cat XL treaties (Samsung F&M, KB) are exposed. An 8% rate drop implies ~−USD 1.9M ceded premium — leverage to defend brokerage at renewal.",
};

// Slip testbench — field accuracy + version trend
export const accuracyFields = [
  { field: "Limit / 한도", acc: 99.2 },
  { field: "Brokerage / 수수료", acc: 97.8 },
  { field: "Rate / 요율", acc: 98.5 },
  { field: "Period / 기간", acc: 99.6 },
  { field: "Reinsurer / 재보험사", acc: 96.4 },
];
export const versionTrend = [
  { v: "v0.6", acc: 91.2 }, { v: "v0.7", acc: 94.0 },
  { v: "v0.8", acc: 96.1 }, { v: "v0.9", acc: 97.5 }, { v: "v1.0", acc: 98.4 },
];

// Closing roadmap
export const roadmap = [
  { phase: "Phase 1", ko: "정산 자동 대사 + 예외 대시보드", en: "Auto reconciliation + exception desk", weeks: "0–6주" },
  { phase: "Phase 2", ko: "AI 슬립 초안 + 검수 워크플로", en: "AI slip drafting + review workflow", weeks: "6–12주" },
  { phase: "Phase 3", ko: "포트폴리오 인사이트 + 영업 에이전트", en: "Portfolio insight + sales agent", weeks: "12주+" },
];
