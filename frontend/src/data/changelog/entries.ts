/**
 * Changelog entries — surfaced on `/ins/whats-new` and the slip-generator
 * "최근 업데이트" banner. Each entry is a curated, customer-facing summary
 * of a release; the markdown body is intentionally written so an operator
 * can copy it directly into a reply email to the cedant.
 *
 * Add a new entry by prepending to `CHANGELOG_ENTRIES` (newest first).
 * Keep `body` factual, in Korean, and limited to what a cedant cares
 * about — internal refactors / test plumbing should be omitted.
 */
export type ChangelogArea =
  | "slip-generator"
  | "soc"
  | "claims"
  | "placement"
  | "news"
  | "platform";

export interface ChangelogEntry {
  /** Stable slug used in URLs and as a React key. */
  id: string;
  /** ISO date of release (YYYY-MM-DD). Sorted desc by this field. */
  date: string;
  /** Functional area for filtering. */
  area: ChangelogArea;
  /** Short headline. Korean, ≤ 60 chars. */
  title: string;
  /** Markdown body. Rendered with react-markdown; also copyable as-is. */
  body: string;
  /** When true, this entry is suitable for sharing in customer replies. */
  customerVisible: boolean;
  /** Optional related PR / issue reference. */
  ref?: string;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: "2026-06-22-news-insights-dashboard",
    date: "2026-06-22",
    area: "news",
    title: "뉴스 인사이트 대시보드 신설 (글로벌 + 국내 + AI 영업 시사점)",
    customerVisible: false,
    ref: "PR #30 · #31",
    body: `재보험 영업 관점의 뉴스를 한 화면에 모아 AI가 시사점을 정리해 주는 신규 도구입니다.

### 새 도구 라우트

- \`/ins/tools/news-insights\` (사이드바 Tools → Analytics)
- 4개 큐레이션 주제: 원수사·대형 고객사 / 규제·정책 / 시장·요율 동향 / 대형 손실·자연재해

### 두 소스 동등 비중

- **글로벌(영문)**: Perigon News API
- **국내(국문)**: 네이버 뉴스 검색 API
- 주제마다 소스별 동수로 가져와 교차 배치 — 한쪽으로 치우치지 않음

### AI 영업 시사점

- 주제별로 Gemini 가 "그래서 우리 갱신·고객·요율 협상에 무슨 의미인지" 를 2~3개로 정리
- 단순 헤드라인 나열이 아니라 재보험 인수·중개 데스크 관점으로 가공

### 노이즈 필터 + 자동 갱신

- 보험 관련성 필터로 비관련 기사(스포츠·일반 사회면 등)를 자동 제외
- 매일 06:00(KST) 자동 갱신 + 상단 수동 새로고침 버튼`,
  },
  {
    id: "2026-06-19-ops-dashboard",
    date: "2026-06-19",
    area: "platform",
    title: "Operations 대시보드 신설 (계약관리 원장 기반 주간 작업)",
    customerVisible: false,
    ref: "PR #27 · #29",
    body: `계약관리 마스터 원장(AI계약관리.xlsx)을 기반으로 주간 운영 작업 리스트를 보여 주는 신규 도구입니다.

### 새 도구 라우트

- \`/ins/tools/ops\` (사이드바 Tools → Analytics)

### 주요 기능

- 원장 업로드 → 스냅샷 기반 주 대비(WoW) 변화 추적
- 담당자(매니저)별 뷰에서 **담당 계약 수 기준 정렬**
- 연중 일부만 집계된 항목에 대한 **부분연도(partial-year) 안내** 표기`,
  },
  {
    id: "2026-06-18-weekly-dashboard",
    date: "2026-06-18",
    area: "platform",
    title: "Weekly 업무 진행 대시보드 신설",
    customerVisible: false,
    ref: "PR #24",
    body: `내부 직원 주간 보고(xlsx)를 모아 업무 진행 현황을 보여 주는 신규 도구입니다.

### 새 도구 라우트

- \`/ins/tools/weekly-dashboard\` (사이드바 Tools → Analytics)

### 4개 뷰

- 진행상황 추적 / 사업라인별 현황 / 담당자별 업무량 / 실적 집계

### 특징

- 취합본·개인 보고 파일을 주차별로 누적 (취합본 우선)
- 계정별 **주 대비(WoW)** 변화 추적
- 숫자 셀만 합산 — 자유 텍스트 금액은 제외하고 별도 카운트(무음 합산 방지)`,
  },
  {
    id: "2026-06-18-slip-email-compose",
    date: "2026-06-18",
    area: "slip-generator",
    title: "슬립 이메일 작성 — 한 / 영 토글 + To / Cc 추천",
    customerVisible: true,
    ref: "PR #20 · #23",
    body: `슬립을 곧바로 이메일 초안으로 만들어 발송 준비할 수 있는 작성 플로우가 추가되었습니다.

### 주요 기능

- **한 / 영 언어 토글**: 이메일 본문을 국문·영문으로 전환
- **수신자 추천**: 원본 데이터에서 To / Cc 후보를 자동 제안
- **Reply-To 편집 가능**
- 결과는 \`.eml\` 파일로 내려받아 메일 클라이언트에서 그대로 발송

### 품질

- .eml 빌더와 이메일 템플릿에 단위 테스트(Vitest)를 추가`,
  },
  {
    id: "2026-06-18-rq-slip-export-polish",
    date: "2026-06-18",
    area: "placement",
    title: "RQ-slip 내보내기 품질 — 로고·서명·페이지별 레터헤드·한글 PDF",
    customerVisible: false,
    ref: "PR #19 · #21 · #25",
    body: `플레이스먼트 RQ-slip 내보내기 결과물의 완성도를 높였습니다.

### 변경

- 내보낸 슬립에 **INS 법인 로고 + S.H. Lee 서명** 삽입
- PDF **페이지마다 레터헤드(주소 포함) + 우하단 로고 반복**
- 한국어 PDF 렌더링 수정 — form-control 텍스트가 깔끔하게 출력되도록 보정`,
  },
  {
    id: "2026-06-16-rq-slip-review-workflow",
    date: "2026-06-16",
    area: "placement",
    title: "RQ-slip 검수 워크플로우 + AI ↔ 편집본 Diff",
    customerVisible: false,
    body: `### 1. 검수 큐 페이지

저장된 RQ-slip 케이스를 한곳에서 확인하고 상태/판정으로 필터링할 수 있는 전용 큐 페이지를 신설했습니다.

- **새 라우트**: \`/ins/tools/rq-slip/cases\`
- 상태(Draft / Reviewed / Sent) · 판정(정확 / 수정요 / 오류 / 미검수) 필터
- Insured / Line / Reinsured 검색
- 케이스 클릭 → \`?case=<id>\` 딥링크로 작업 화면 자동 로드

### 2. AI 추출본 ↔ 편집본 Diff 패널

이번 슬립이 AI 초안에서 무엇이 어떻게 수정됐는지가 한눈에 보입니다.

- 수정된 필드 개수가 슬립 위에 노란색 배너로 노출
- 펼치면 \`AI 추출값 → 운영자 수정값\` 전체 비교
- 슬립 본문에서도 각 행 라벨 옆 **호박색 점**으로 수정 여부 표시
- 케이스 저장/재로드 후에도 동일하게 작동 — AI 정확도를 시간에 따라 추적할 수 있는 데이터가 자동으로 누적

### 3. 상태 전이 완성

\`draft → reviewed → sent\` 라이프사이클이 화면에서 완결됩니다.

- 케이스 헤더에 현재 상태 pill 노출 (Draft / Reviewed / Sent)
- 검수 판정 클릭 시 자동으로 \`reviewed\` 로 승격
- **발송 완료** 버튼으로 \`sent\` 상태로 명시 전이 (판정 후에만 활성화)
- 큐 페이지에서 상태 카운트(KPI) 한눈에 확인

### 4. 데모/운영 안정성 보강

- PDF 다운로드 실패 시 침묵하지 않고 오류 메시지 노출
- 백엔드 연결 실패 시 저장 케이스 목록이 비어보이는 대신 명시적 경고
- "저장됨 ✓" 토스트가 일정 시간 후 자동 사라짐`,
  },
  {
    id: "2026-05-12-testbench-runs-and-whats-new",
    date: "2026-05-12",
    area: "platform",
    title: "Slip Testbench 자동 평가 + What's New 페이지 신설",
    customerVisible: false,
    ref: "PR #3",
    body: `### 1. Slip Testbench — 영구 실행 기록

\`testbench-dataset/\` 의 \`input / ground_truth / generated\` 3단 구조를 그대로 비교해 회귀를 추적합니다.

- 실행 단위로 결과를 DB에 저장 (Alembic 0004: \`testbench_runs\` + \`testbench_pairs\`)
- **가중치 기반 정확도** (match=1.0 / minor=0.7 / major=missing=0.0) 트렌드 라인차트
- 페어별 3-way PDF iframe + 필드별 diff + 심각도 분포
- \`/ins/admin/slip-testbench/runs\` 와 \`/runs/[id]\` 신설

### 2. VLM 자동 원인 분석 (gemini-3.1-pro)

GT vs Generated PDF를 직접 모델에 업로드해 불일치 사유를 분류합니다.

- 원인 라벨: \`ocr_miss / prompt_gap / rule_mismatch / input_ambiguous / gt_error / ok_equivalent\`
- 승자(GT/Generated/동등) + 근거 + 제안 수정안까지 함께 기록
- 한 페어 실패가 전체 실행을 망치지 않도록 stub 폴백 처리

### 3. What's New 페이지

운영자가 변경사항을 그대로 회신 메일에 붙여넣을 수 있도록 마크다운 본문을 채택했습니다.

- 영역 필터 (Slip Generator / SOC / Claims / Platform)
- "고객 공개 항목만" 토글
- 각 항목 우상단 **Copy as Markdown** 버튼
- 슬립 생성기 상단의 슬림 배너에 최신 항목 노출`,
  },
  {
    id: "2026-05-11-bordereau-columns",
    date: "2026-05-11",
    area: "slip-generator",
    title: "Bordereau 컬럼 매니저 · Incident 식별 · 마스킹 전파",
    customerVisible: true,
    ref: "PR #2",
    body: `### 1. Bordereau 컬럼 자유 추가 / 수정

슬립 생성 화면 상단에 **"Bordereau Columns"** 카드가 추가되었습니다. 다음 작업을 자유롭게 수행할 수 있습니다.

- **+ 사용자 컬럼**: 빈 컬럼을 추가해 각 행에 원하는 값을 직접 입력
- **라벨 변경**: 컬럼 이름을 클릭해 인라인 수정
- **표시 / 숨김** 토글, **▲▼** 순서 재배치
- **셀 값 인라인 편집**: 표 본체에서 직접 수정 (금액·차수는 자동 숫자 변환)
- **기본값 복원** 버튼으로 표준 15컬럼으로 되돌리기

### 2. Incident 식별 (동일 사고 묶음)

청구 차수가 \`001 / 002 / 003\` 형태로 누적되는 KB 양식에 대응하여, 차수를 자동으로 분리해 동일 사고를 하나의 Incident ID로 묶도록 처리했습니다.

- 신규 컬럼 **Incident ID** / **Seq** 추가 (기본 OFF, 컬럼 매니저에서 토글)
- 예: \`2020-1021024610 001 ~ 005\` → 모두 동일 Incident ID, Seq만 \`001 ~ 005\`로 분리
- \`외\` 집계 표기도 정상 처리

### 3. 피보험자명 마스킹 자동 전파

슬립 헤더에서 피보험자명 마스킹을 해제하면, 보더루 각 행의 \`LX ****\` 표기도 함께 자동 해제됩니다. (기존에는 헤더만 해제되어 행은 마스킹 상태로 남는 문제가 있었습니다.)

### 4. Policy Period 영문 표기 자동 변환

ISO 날짜 (\`2024-03-01 ~ 2025-03-01\`, \`/\`, \`.\` 구분자 포함)를 KB 양식 기본값인 \`Mar 01, 2024 ~ Mar 01, 2025\` 형태로 자동 변환합니다. 이미 영문 표기된 항목은 그대로 유지됩니다.

### 5. 컬럼 레이아웃 저장 (배관)

슬립 케이스별 컬럼 레이아웃을 저장할 수 있도록 DB / API 까지 준비했습니다. 화면 단의 "레이아웃 저장" 버튼은 다음 업데이트에 노출 예정입니다.`,
  },
  {
    id: "2026-05-07-slip-pipeline-and-testbench",
    date: "2026-05-07",
    area: "slip-generator",
    title: "슬립 파이프라인 안정화 + Admin Slip Testbench 도입",
    customerVisible: false,
    ref: "PR #1",
    body: `### 슬립 생성 파이프라인 개선

- \`soc_stream\` 스트리밍 파이프라인 ~290줄 리팩토링 (안정성 + 응답 일관성)
- \`SLIP_TRANSLATE_TO_ENGLISH\` 프롬프트 도입으로 영문 슬립 품질 향상
- \`is_foreign_reinsurer\` / \`canonicalize_company_name\` 헬퍼 추가
- 피보험자명 재해석 로직 신설 및 회귀 테스트 (\`test_insured_resolution.py\`)
- \`slip_cases.doc_type\` 컬럼 확장 (Alembic 0002)

### Admin Slip Testbench (베타)

\`/admin/slip-testbench\` 관리자 페이지가 신설되었습니다. 운영자가 슬립 결과 품질을 빠르게 비교할 수 있는 첫 단계로, 이후 PR #3 의 자동 평가 / VLM 분석으로 확장되었습니다.

### 기타

- 사이드바: 라이브 인디케이터 닫는 태그 수정
- \`.dockerignore\` 추가로 \`node_modules\` 도커 빌드 충돌 해소
- \`ins-logo-mark.png\` 에셋 추가`,
  },
  {
    id: "2026-05-06-slip-layout-and-foreign-rule",
    date: "2026-05-06",
    area: "slip-generator",
    title: "GT 정렬 슬립 레이아웃 · 영문 날짜 · 외국 재보험사 자동 영문화 · References 패널",
    customerVisible: true,
    body: `### 1. GT 형식과 정렬한 슬립 레이아웃

기존 PLA / SOC 종이 양식과 한 글자 단위로 맞춘 레이아웃입니다.

- 컴팩트 헤더 로고와 둥근 타이틀 박스
- 옵션 \`subTitle\` (예: \`(2nd Revised)\`) 자동 노출
- Settlement 표를 5컬럼 단일 표로 재설계, **셀 단위 테두리**로 \`html2canvas\` PDF 변환에서도 모든 경계선이 보존됨
- PLA 슬립에서 Expenses Reserve 가 0이면 해당 컬럼이 자동 숨김 (GT 4컬럼 레이아웃)
- 피보험자 표시에서 \`Co., Ltd. / Inc. / Corp. / (주)\` 등 법인 접미어 자동 제거

### 2. 영문 날짜 표기

Policy Period · Date of Loss 등을 \`Mar 01, 2024\` 형식으로 자동 변환합니다. \`~\`, \`to\` 와 같은 범위 구분자는 그대로 유지됩니다.

### 3. 외국 재보험사 언어 규칙

코드 테이블 (Lines 64 / Insurers 28 / Reinsurers 94 / Currencies 13) 을 \`code_table.py\` 에 정리하고, \`is_foreign\` 플래그를 기준으로 SOC/PLA 슬립의 텍스트 필드 (line · location_of_loss · nature_of_loss · particulars · remarks) 를 자동으로 KO → EN 번역합니다.

- \`GET /api/tools/code-table\` 노출
- 슬립 행에 **Foreign / Domestic** 뱃지 노출
- 외국 재보험사 슬립에 한글이 남아있으면 ⚠ 경고 표시
- 분류 오류는 \`code_table.py\` 직접 편집으로 보정

### 4. References 패널

각 슬립 필드를 **출처 파일 / 추출 JSON / 포맷팅 / 변환** 단계로 역추적할 수 있는 References 카드가 추가되었습니다.

### 5. UX 폴리시

- 마스트헤드에 **+ New Slip** 리셋 버튼 (상태 초기화 후 깨끗한 \`/ins/tools/slip-generator\` 로 이동)
- 미리보기 패널이 닫혀있어도 PDF 다운로드가 정상 동작
- 금액 0 은 \`-\` 로 통일 표기
- AI 추출 필드 추가: \`title_subline\`, \`doc_date\`, \`expenses_reserve_100\``,
  },
  {
    id: "2026-05-04-kb-deterministic-parser",
    date: "2026-05-04",
    area: "soc",
    title: "KB 청구 보더루 결정론 파서 (단계적 도입)",
    customerVisible: true,
    body: `KB 손해보험 청구 보더루 (XLSX) 에 대해 LLM 의존도를 낮추고 결정론 파서를 단계적으로 적용합니다. 동일 입력 → 동일 출력 보장과 검증 가능한 데이터 흐름이 목표입니다.

### 도입 단계

\`KB_PARSER_MODE\` 환경변수로 세 단계를 제어합니다.

- **OFF** (기본): 기존 LLM 파이프라인을 그대로 사용
- **SHADOW**: 결정론 파서를 함께 실행해 결과만 교차 검증 (사용자 영향 없음)
- **ON**: 결정론 파서 출력을 LLM 프롬프트에 주입하고 교차 검증 경고를 SSE 이벤트로 노출

### 안전장치

- 모든 모드에서 비-KB 입력 (KR / HW / SS / HM / Meritz / DB) 은 기존 파이프라인으로 자동 폴백
- 23개 통합 테스트 추가 (총 290개 통과)
- DB 직접 쓰기 · SOC override 는 Phase 3d 까지 비활성화

### 운영자에게 보이는 변화

- ON 모드에서 결정론 파서 ↔ LLM 추출 결과 불일치 시 화면에 노란색 교차 검증 경고가 표시됩니다.
- 휴면 계약 자산 합산 검증기 (\`share_sum_validator\`) 가 함께 도입되었습니다.`,
  },
  {
    id: "2026-04-27-slip-generator-v2",
    date: "2026-04-27",
    area: "slip-generator",
    title: "Slip Generator v2 출시",
    customerVisible: true,
    body: `별도 도구로 분리된 **Slip Generator** 가 정식 공개되었습니다. KB 손해보험 (MED-MAL facility 포함) 과 KR 시리즈의 PLA/SOC 슬립 생성을 MVP 범위로 지원합니다.

### 주요 변경

- **새 도구 라우트**: \`/ins/tools/slip-generator\` 및 케이스 영구 링크 \`/ins/tools/slip-generator/[uuid]\`
- LangGraph 기반 에이전트 골격 + YAML 플레이북 (cedant 별 규칙) 으로 확장 가능한 구조
- \`slip_cases\` 테이블 신설로 슬립 작업을 케이스 단위로 영구 보존
- \`SlipDocument\` 컴포넌트로 PLA / SOC / Bordereau 통합 렌더링
- 대시보드 / SOC 라우터 및 스키마 확장
- Evidence Graph, 글로벌 검색, 사이드바 재설계
- 기존 \`/soc-generator\` 페이지는 폐기 (Tools 메뉴로 통합)`,
  },
  {
    id: "2026-04-15-prod-deploy-lock-screen",
    date: "2026-04-15",
    area: "platform",
    title: "insightre.ai 운영 배포 · 잠금화면 · SOC 파이프라인 안정화",
    customerVisible: true,
    body: `### 운영 환경

- **insightre.ai** 도메인으로 정식 운영 환경 배포 (\`docker-compose.prod.yml\`, \`deploy.sh\`)
- 잠금 / 로그인 화면 신설로 외부 노출 보호

### SOC 파이프라인 안정화

- **SSE 청크 경계 버그 수정**: 결과 이벤트 페이로드가 네트워크 청크를 가로지를 때 \`event: result\` 와 \`data:\` 가 분리되어 화면이 "completed" 단계에서 멈추는 문제 해결
- **초기화 / 다시 시도** 버튼이 단계 목록 · 사고연쇄 메시지까지 함께 초기화
- **OCR 보정**: 스캔본에서 \`I\` 가 누락된 \`NS Corp\` / \`NS\` 도 \`INS Corp\` 와 동일하게 브로커로 인식 (재보험사 분배에서 자동 제외)
- **DB 연결 누수 수정**: \`StreamingResponse\` 가 클라이언트 단절 시 \`AsyncSession\` 을 풀로 반환하지 않던 문제 해결 (장기 가동 시 연결 풀 고갈로 인한 쿼리 지연 해소)
- 테스트 스위트 정비 (\`scripts/run_soc_tests.py\`, \`run_soc_tests.sh\`)`,
  },
  {
    id: "2026-04-10-soc-generator-contract-workflow",
    date: "2026-04-10",
    area: "soc",
    title: "SOC Generator + 컨트랙트 워크플로우",
    customerVisible: true,
    body: `### SOC Generator

- SSE 스트리밍 기반 사고연쇄 추론 (\`soc_stream\`, \`soc_generator\`)
- 재보험사 단축코드 → 전체명 자동 매핑 (\`reinsurer_names.py\`)
- \`nature_of_loss\` 필드 추가 (조항 7 조건부 노출)
- 통화별 자리수 자동 적용 (KRW 정수, USD 소수 둘째 자리)

### 컨트랙트 워크플로우

- 컨트랙트 처리 파이프라인 (\`contract_processor\`, \`contract_workflow\`) 신설
- 사이드바 **Tools** 섹션에 SOC Generator · 컨트랙트 감사 링크 추가

### DataTable 강화

- 체크박스 선택, 셀 복사, 컬럼 확장 / 축소, 페이지 사이즈 셀렉터
- Claims 페이지: 컬럼 확장 · 페이지 사이즈 옵션 적용`,
  },
  {
    id: "2026-04-09-rebrand-detail-pages-audit",
    date: "2026-04-09",
    area: "platform",
    title: "InsightRe AI 리브랜드 · 상세 페이지 · 감사 자동화",
    customerVisible: true,
    body: `### 브랜드 전환

- **ReinsAI → InsightRe AI** (insightre.ai)
- 다크 사이드바 (slate-900) + 라이트 본문으로 금융 터미널 분위기 통일
- 글로벌 폰트: **JetBrains Mono · Montserrat · Pretendard**

### Claims 상세 페이지

- Account / Reinsurer / Ref No 모두 클릭 가능한 링크
- \`/ins/claims/reinsurer/[name]\`: 재보험사별 계정 breakdown
- \`/ins/claims/ref/[refno]\`: ref_no 디테일 + 재보험사 분배 · 점유율 · SOC 비교
- 삭제된 청구는 목록에서 자동 숨김
- \`account_name + ref_no + reinsurer\` 통합 검색
- ref_no 정확 일치 필터 API 파라미터 추가
- \`workflow_status\` 뱃지를 상태 옆에 노출
- **ClaimIntakeModal** 공용 컴포넌트 (\`/ins/claims\` 와 \`/ins/process\` 공유)

### 데이터 감사 자동화

- 페이지 진입 시 자동 실행 (Run Audit 버튼 클릭 불필요)
- 태그 진행률 실시간 표시
- 파일 태거: 535개 파일 · 503개 파싱 · Gemini 5개 동시 처리
- XLSX 파싱 실패 시 Gemini 멀티모달 폴백
- **Retry Failed** 버튼으로 실패 항목 재시도
- 개별 PDF 에 대한 **Extract with AI** 버튼

### 오버뷰

- **월별 보험료 YoY 비교** (2026 vs 2025 사이드바이사이드 막대 그래프)

### 안정성

- 임포트는 DB 에 데이터가 있으면 자동 스킵 (핫리로드 시 TRUNCATE 방지)
- \`claim_cases / claim_drafts / file_extractions\` 는 TRUNCATE 대상에서 제외
- DB 풀 사이즈 20 으로 확대`,
  },
  {
    id: "2026-04-08-mvp-claims-pipeline",
    date: "2026-04-08",
    area: "claims",
    title: "Claim 처리 파이프라인 + Policy 엔티티 + AI 파일 스캐너",
    customerVisible: true,
    body: `초기 MVP 빌드 — 청구 인테이크부터 결제까지 한 화면에서 처리할 수 있도록 통합되었습니다.

### Claim 처리 파이프라인

**인테이크 → AI 분석 → 드래프트 → 발송 → 결제** 의 5단계 워크플로우 신설.

- **4가지 인테이크 방식**: 붙여넣기 · MSG · 데모 · 수동 입력
- ARQ 워커 + Redis 비동기 큐로 Gemini 문서 파싱
- 마크다운 AI 요약 + 드래프트 미리보기 / 다운로드
- 청구 처리 시 \`claims\` 테이블에 실제 레코드 생성

### SOC 슬립 PDF

- INS Corp 양식 정확 매칭 (Heungkuk closing 포맷 포함)
- dwins.co.kr 로고 포함 PDF 다운로드
- 데모 데이터에 파일 미리보기 + 천 단위 구분 금액 포맷

### Policy 엔티티 도입

- 계약 ↔ 청구 ↔ 문서를 연결하는 **Policy** 엔티티 신설
- Cover Note 별 컨트랙트 목록 페이지 (\`/contracts\` 하위 라우트)
- Policy 상세 페이지에 **Total Premium + Commission** 통계 및 테이블 합계

### Documents 페이지

- 파일 브라우저, 타입 필터, 스캔 UI
- 시작 시 파일 자동 스캔, FK 안전을 위한 CASCADE TRUNCATE

### AI 파일 스캐너

- **Actual** 폴더의 실제 문서를 Policy 에 자동 매칭
- Gemini 기반 매칭 결과를 운영자가 검토 / 수동 보정 가능

### UX

- 전역 검색바 + **Cmd + K** 단축키
- Pretendard + Montserrat 폰트 (CSS @import 대신 link 태그 로딩으로 FOUT 최소화)
- 폴리시 임포트 후 자동 빌드, 날짜 직렬화 버그 수정`,
  },
];

export function getRecentEntries(limit = 3): ChangelogEntry[] {
  return [...CHANGELOG_ENTRIES]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit);
}

export function findEntry(id: string): ChangelogEntry | null {
  return CHANGELOG_ENTRIES.find((e) => e.id === id) ?? null;
}
