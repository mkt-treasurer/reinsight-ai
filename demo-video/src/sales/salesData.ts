// 가상 데이터 — 기획안 §4 기준. 실제 고객/계약이 아닌 이해를 돕기 위한 예시.
// 영상 전체에 "Concept Demo · 가상 데이터" 고지가 상시 노출된다.

export const PHASES = ["DISCOVER", "CONNECT", "PLACE", "RECONCILE"] as const;
export type Phase = (typeof PHASES)[number];

// ── Scene 1. 오프닝 ───────────────────────────────────────────────
export const opening = {
  lines: [
    "보험 영업은",
    "고객이 보험을 요청할 때 시작되지 않습니다.",
  ],
  turn: ["보험이 필요해지는 순간을", "먼저 발견하는 것에서 시작됩니다."],
  product: "AI Insurance Sales & Operations Platform",
};

// ── Scene 2. Opportunity Radar ────────────────────────────────────
export const radarRows = [
  { name: "한빛로지스", score: 92, signal: "신규 물류센터 건설", need: "재산 · 기업휴지", focus: true },
  { name: "세온배터리", score: 87, signal: "해외공장 신설", need: "재산 · 배상책임", focus: false },
  { name: "넥스커머스", score: 81, signal: "개인정보 처리 확대", need: "사이버보험", focus: false },
];

export const radarEvents = [
  { tag: "CAPEX", ko: "신규 저온 물류센터 건설", meta: "2026-06 착공" },
  { tag: "CAPEX", ko: "설비투자 1,800억 원", meta: "공시" },
  { tag: "GLOBAL", ko: "해외 물류사업 확대", meta: "베트남 · 폴란드" },
  { tag: "HIRING", ko: "정보보안 담당자 신규 채용", meta: "채용공고 3건" },
  { tag: "RENEWAL", ko: "기존 계약 갱신 D-110", meta: "패키지 만기" },
];

export const radarWhyNow =
  "신규 시설투자와 해외 운송 확대에 따라 재산보험, 기업휴지보험, 적하보험 및 사이버보험 수요가 예상됩니다.";

// ── Scene 3. Account 360 ──────────────────────────────────────────
export const accountKpis = [
  { label: "OPPORTUNITY SCORE", ko: "영업기회 점수", value: 92, suffix: "", tone: "accent" as const },
  { label: "RENEWAL", ko: "갱신까지", value: 110, prefix: "D-", suffix: "", tone: "warning" as const },
  { label: "POTENTIAL PREMIUM", ko: "예상 보험료", value: 12, suffix: "억", tone: "neutral" as const },
  { label: "EXPECTED BROKERAGE", ko: "예상 중개수익", value: 7200, suffix: "만", tone: "positive" as const },
];

export const accountFirm = [
  { k: "업종", v: "종합물류 · 콜드체인" },
  { k: "매출 / 자산", v: "1조 2,400억 / 8,900억" },
  { k: "주요 사업장", v: "이천 · 김해 · 평택 외 6" },
  { k: "해외 사업", v: "베트남 하이퐁, 폴란드 우치" },
  { k: "최근 투자", v: "저온 물류센터 1,800억" },
];

export const accountPolicies = [
  { line: "패키지 (재산)", insurer: "A 보험사", expiry: "2026-11-14", premium: "6.2억", status: "renew" },
  { line: "적하", insurer: "B 보험사", expiry: "2026-09-30", premium: "1.8억", status: "renew" },
  { line: "영업배상책임", insurer: "A 보험사", expiry: "2027-03-01", premium: "0.9억", status: "ok" },
  { line: "기업휴지", insurer: "—", expiry: "미가입", premium: "—", status: "gap" },
  { line: "사이버", insurer: "—", expiry: "미가입", premium: "—", status: "gap" },
];

export const accountAi = [
  "신규 물류센터의 자산가액과 예상 영업중단 손실을 반영해 재산보험 및 기업휴지보험을 우선 제안해야 합니다.",
  "기존 적하보험과 통합해 패키지 프로그램으로 제안할 경우 수주 가능성이 높아집니다.",
];

// ── Scene 4. Relationship Intelligence ────────────────────────────
// 좌표는 720×470 관계도 캔버스 기준.
export const relNodes = [
  { id: "hanbit", label: "한빛로지스", sub: "고객사", x: 360, y: 235, kind: "center" as const },
  { id: "cfo", label: "박지훈 CFO", sub: "의사결정자", x: 585, y: 120, kind: "target" as const },
  { id: "risk", label: "리스크관리팀장", sub: "실무 검토", x: 620, y: 262, kind: "client" as const },
  { id: "ops", label: "물류운영담당 임원", sub: "현장", x: 560, y: 396, kind: "client" as const },
  { id: "kim", label: "김태현 이사", sub: "자사 임직원", x: 112, y: 128, kind: "own" as const },
  { id: "broker", label: "기존 보험중개사", sub: "경쟁", x: 108, y: 262, kind: "rival" as const },
  { id: "insurer", label: "원수사 기업보험팀", sub: "인수", x: 132, y: 392, kind: "market" as const },
  { id: "reins", label: "재보험 언더라이터", sub: "재보험", x: 348, y: 432, kind: "market" as const },
];

export const relEdges = [
  { from: "hanbit", to: "cfo", strong: false },
  { from: "hanbit", to: "risk", strong: false },
  { from: "hanbit", to: "ops", strong: false },
  { from: "broker", to: "hanbit", strong: false },
  { from: "insurer", to: "hanbit", strong: false },
  { from: "reins", to: "insurer", strong: false },
  { from: "kim", to: "cfo", strong: true }, // warm path
];

export const relPath = {
  title: "김태현 이사 → 박지훈 CFO",
  evidence: [
    "산업협회 세미나에서 접촉",
    "최근 이메일 교류 2회",
    "공통 지인 1명",
  ],
  verdict: "Warm Introduction 가능성: 높음",
  advice: "박지훈 CFO에게 직접 콜드메일을 보내기보다 김태현 이사를 통한 소개 요청이 효과적입니다.",
};

// ── Scene 5. AI Sales Copilot ─────────────────────────────────────
export const copilotProducts = [
  "Property All Risks",
  "Business Interruption",
  "Machinery Breakdown",
  "Cargo Insurance",
  "Cyber Insurance",
  "General Liability",
];

export const copilotStrategy = [
  "신규 물류센터의 재산 및 기업휴지 리스크 진단 제안",
  "기존 적하보험과 통합한 보험 프로그램 검토",
  "사이버보험 Gap Analysis를 부가 서비스로 제공",
  "보험료 절감보다 보장 공백과 사고 시 손실 규모를 중심으로 접근",
];

export const copilotDecisionMakers = ["CFO", "Risk Manager", "Logistics Operation Director"];

export const copilotAgenda = [
  "신규 물류센터 자산가액 검토",
  "영업중단 손실액 산정",
  "기존 보험 프로그램 보장 공백",
  "국내외 보험시장 배치 가능성",
  "예상 보험료 및 절감 방안",
];

export const copilotEmail = [
  "신규 물류센터 가동 전 자산가액과 예상 영업중단 손실을",
  "반영해 기존 보험 프로그램의 보장 공백을 검토할 필요가",
  "있습니다. 트레져러 INS를 활용해 주요 리스크와 적합한",
  "보험 구조를 사전에 분석했습니다.",
];

// ── Scene 6. Market Placement ─────────────────────────────────────
export const marketRows = [
  { name: "A 보험사", kind: "원수", fit: 93, cap: "500억", note: "물류센터 인수 경험" },
  { name: "C 재보험사", kind: "재보험", fit: 91, cap: "800억", note: "대형 재산위험 선호" },
  { name: "B 보험사", kind: "원수", fit: 88, cap: "300억", note: "경쟁력 있는 요율" },
];

export const marketDetail = [
  { k: "유사 위험 인수 사례", v: "콜드체인 4건 · 최근 18개월" },
  { k: "과거 견적 / 교신", v: "2025 갱신 견적 2회" },
  { k: "요청 자료", v: "COPE, BI Worksheet, 소방설비 도면" },
  { k: "예상 요율", v: "0.082% ~ 0.094%" },
  { k: "접촉 담당자", v: "기업보험팀 이수민 부장" },
];

export const placementStages = [
  "Opportunity Identified",
  "Client Contacted",
  "Risk Data Collected",
  "Market Submission",
  "Quote Received",
  "Bound",
];
export const placementCurrent = 3; // Market Submission

// ── Scene 7. Reconciliation Center ────────────────────────────────
export const reconDocs = [
  "Signed Slip",
  "Cover Note",
  "Premium Statement",
  "Debit Note",
  "Credit Note",
  "Brokerage Invoice",
  "Remittance Advice",
  "은행 입출금 내역",
];

export const reconRows = [
  { item: "Gross Premium", contract: "12억 원", actual: "12억 원", state: "match" as const },
  { item: "Brokerage", contract: "7,200만 원", actual: "6,600만 원", state: "diff" as const },
  { item: "Reinsurance Premium", contract: "8.4억 원", actual: "미송금", state: "check" as const },
  { item: "Tax", contract: "3,600만 원", actual: "3,600만 원", state: "match" as const },
];

export const reconAlert = {
  title: "Brokerage Discrepancy Detected",
  body: "계약 기준 대비 중개수수료 600만 원 부족",
};

export const reconActions = [
  "차이 원인 분석",
  "미수금 담당자 지정",
  "회수 예정일 설정",
  "보험사 확인 이메일 작성",
  "정산 완료 여부 추적",
];

// ── Scene 8. Revenue Intelligence Dashboard ───────────────────────
export const revenueKpis = [
  { label: "NEW OPPORTUNITIES", ko: "신규 영업기회", value: 38, suffix: "건", tone: "accent" as const },
  { label: "EXPECTED PREMIUM", ko: "예상 보험료", value: 146, suffix: "억", tone: "neutral" as const },
  { label: "EXPECTED BROKERAGE", ko: "예상 중개수익", value: 8.4, suffix: "억", tone: "positive" as const, dec: 1 },
  { label: "RENEWAL ≤ 90D", ko: "90일 내 갱신", value: 17, suffix: "건", tone: "warning" as const },
  { label: "UNCOLLECTED FEE", ko: "미수 중개수수료", value: 1.2, suffix: "억", tone: "critical" as const, dec: 1 },
  { label: "RECON ERRORS", ko: "정산 오류", value: 6, suffix: "건", tone: "critical" as const },
];

export const pipeline = [
  { stage: "Lead", n: 38 },
  { stage: "Contacted", n: 26 },
  { stage: "Meeting", n: 18 },
  { stage: "Submission", n: 12 },
  { stage: "Quote", n: 9 },
  { stage: "Bound", n: 6 },
  { stage: "Reconciled", n: 4 },
];

export const nextActions = [
  { ko: "한빛로지스 CFO 소개 요청", tone: "accent" as const },
  { ko: "갱신 D-90 고객 5곳 접촉", tone: "warning" as const },
  { ko: "미수수료 6,000만 원 확인", tone: "critical" as const },
  { ko: "보험사 견적 3건 회신 독촉", tone: "neutral" as const },
  { ko: "고위험 고객 보장 공백 검토", tone: "neutral" as const },
];

// ── Scene 9. 엔딩 ─────────────────────────────────────────────────
export const endingBeats = [
  { en: "Find Opportunities", ko: "발견한다" },
  { en: "Build Relationships", ko: "연결한다" },
  { en: "Win Business", ko: "수주한다" },
  { en: "Reconcile Revenue", ko: "정산한다" },
];

export const endingSlogan = "보험 영업기회 발굴부터 수수료 회수까지";
