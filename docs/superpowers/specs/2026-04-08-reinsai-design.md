# ReinsAI - 재보험 AI 정청산 자동화 시스템 설계

## 목적
재보험 중개사 정산팀을 위한 데모 프로토타입. 실제 엑셀 데이터를 PostgreSQL에 적재하고, 보더로 대조 / 정산 대시보드 / 자연어 질의 3가지 핵심 기능을 제공한다.

## 기술 스택
- **Frontend**: Next.js 15 (App Router, TypeScript, Tailwind CSS)
- **Backend**: FastAPI (Python 3.12, SQLAlchemy, openpyxl)
- **Database**: PostgreSQL 16
- **AI**: Gemini Flash (google-generativeai SDK)
- **Infra**: Docker Compose (3 containers: nextjs, fastapi, postgres)

## 아키텍처

```
Next.js (:3000) → FastAPI (:8000) → PostgreSQL (:5432)
                                   → Gemini API
```

인증 없음. 바로 대시보드 진입.

## DB 스키마

### contracts (AI계약관리.xlsx)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial PK | |
| year | int | 시트 연도 (2024/2025/2026) |
| cont_month | varchar | 계약 월 |
| no | varchar | 번호 |
| cover_note_no | varchar | 커버노트 번호 |
| assured | varchar | 피보험자 |
| project_name | varchar | 프로젝트명 |
| line | varchar | 보험종목 |
| line2 | varchar | 보험종목2 |
| new_renew | varchar | 신규/갱신 |
| renewable | varchar | 갱신가능 여부 |
| retail | varchar | 리테일 여부 |
| original_cedant | varchar | 원보험사 |
| cedant | varchar | 출재사 |
| period_from | date | 보험기간 시작 |
| period_to | date | 보험기간 종료 |
| installment | varchar | 분할납 |
| ppw | varchar | PPW |
| currency | varchar | 통화 |
| gross_prem_100 | numeric | 총보험료(100%) |
| gross_prem_inst | numeric | 총보험료(분할) |
| reinsurer | varchar | 재보험사 |
| share | numeric | 지분율 |
| ri_prem | numeric | 재보험료 |
| ri_commission | numeric | 재보험 수수료 |
| net_ri_prem | numeric | 순재보험료 |
| net_ri_prem_kwon | numeric | 순재보험료(권) |
| net_to_uwr | numeric | UWR 순수입 |
| rec_date | date | 수금일 |
| paid_date | date | 지급일 |
| co_brokerage | numeric | 공동중개 수수료 |
| partner | varchar | 파트너 |
| remarks | text | 비고 |

### claims (Claim list 통합.xlsx)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial PK | |
| sheet_name | varchar | 시트명 (ALL/C/P/E/T/M) |
| booking_month | varchar | 부킹 월 |
| soc_received | varchar | SOC 수신일 |
| soc_sent | varchar | SOC 발송일 |
| account_name | varchar | 계정명 |
| line | varchar | 보험종목 |
| policy_period | date | 보험기간 |
| dol | date | 사고일 |
| reinsurer | varchar | 재보험사 |
| currency | varchar | 통화 |
| total_amount | numeric | 총금액 |
| share | numeric | 지분율 |
| origin_currency | numeric | 원통화 금액 |
| roe | numeric | 환율 |
| krw_amount | numeric | 원화환산 보험금 |
| soc_amount | numeric | SOC 금액 |
| cedant | varchar | 출재사 |
| status | varchar | 상태 (Open/Closed) |
| received_date | date | 수금일 |
| paid_date | date | 지급일 |
| account_mgr | varchar | 담당자 |
| ref_no | varchar | 참조번호 |
| remarks | text | 비고 |

### cover_notes (Cover Note.xlsx)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial PK | |
| issuing_date | date | 발행일 |
| cover_note_number | varchar | 커버노트 번호 |
| assured | varchar | 피보험자 |
| reassured | varchar | 재보험피보험자 |
| line | varchar | 보험종목 |
| account | varchar | 담당자 |
| remarks | text | 비고 |

## 핵심 기능

### 1. 보더로 대조 (Bordereaux Reconciliation)
- contracts와 claims를 cover_note_no, assured/account_name, reinsurer 기준으로 자동 매칭
- 불일치(금액 차이, 누락, 중복) 자동 탐지 → 이상 건 하이라이트
- 매칭률, 이상건수, 금액차이 요약 통계

### 2. 정산 현황 대시보드
- 월별/라인별/재보험사별 보험료·보험금 현황
- 수금/지급 상태 트래킹
- 통화별 금액 집계
- 차트: 월별 추이, 라인별 비중, 재보험사별 분포

### 3. 자연어 질의 (AI Chat)
- Gemini Flash가 DB 스키마를 컨텍스트로 받고
- 사용자 질문 → SQL 생성 → 실행 → 결과를 자연어로 답변
- 예시: "삼성SDI 3월 클레임 현황", "ACE KR의 2026년 보험료 합계"

## 페이지 구조 (Next.js)

```
/                    → 대시보드 (요약 통계, 차트)
/reconciliation      → 보더로 대조 (매칭 결과, 이상 건 목록)
/contracts           → 계약 관리 리스트 (필터, 검색, 페이지네이션)
/claims              → 보험금 리스트 (필터, 검색, 페이지네이션)
/chat                → 자연어 질의 (채팅 UI)
```

## API 엔드포인트 (FastAPI)

```
GET  /api/dashboard/summary          대시보드 요약 통계
GET  /api/dashboard/charts           차트 데이터

GET  /api/contracts                  계약 목록 (필터, 페이지네이션)
GET  /api/contracts/{id}             계약 상세

GET  /api/claims                     보험금 목록 (필터, 페이지네이션)
GET  /api/claims/{id}                보험금 상세

GET  /api/reconciliation/results     대조 결과
GET  /api/reconciliation/summary     대조 요약

POST /api/chat                       자연어 질의

POST /api/data/import                엑셀 데이터 임포트
GET  /api/data/status                임포트 상태
```

## 데이터 임포트 파이프라인

1. FastAPI 시작 시 `reference/` 폴더의 엑셀 파일 탐지
2. openpyxl로 헤더 행 파싱 → 컬럼 매핑
3. 행별 데이터 정규화 (날짜, 숫자, 문자열)
4. PostgreSQL bulk insert
5. 임포트 완료 후 보더로 대조 자동 실행

## 프로젝트 구조

```
reinsai/
├── docker-compose.yml
├── .env
├── .env.example
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx              # 대시보드
│       │   ├── reconciliation/
│       │   ├── contracts/
│       │   ├── claims/
│       │   └── chat/
│       ├── components/
│       │   ├── layout/               # Sidebar, Header
│       │   ├── dashboard/            # StatCard, Charts
│       │   ├── reconciliation/       # MatchTable, AnomalyList
│       │   ├── contracts/            # ContractTable, Filters
│       │   ├── claims/               # ClaimTable, Filters
│       │   └── chat/                 # ChatWindow, MessageBubble
│       └── lib/
│           └── api.ts                # API client
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── contract.py
│   │   │   ├── claim.py
│   │   │   └── cover_note.py
│   │   ├── routers/
│   │   │   ├── dashboard.py
│   │   │   ├── contracts.py
│   │   │   ├── claims.py
│   │   │   ├── reconciliation.py
│   │   │   └── chat.py
│   │   ├── services/
│   │   │   ├── importer.py           # 엑셀 파싱/적재
│   │   │   ├── reconciliation.py     # 보더로 대조 로직
│   │   │   └── ai_chat.py            # Gemini 연동
│   │   └── schemas/
│   │       ├── contract.py
│   │       ├── claim.py
│   │       └── chat.py
│   └── data/                         # 엑셀 파일 마운트 지점
└── reference/                        # 원본 데이터 (git ignore)
```

## Docker Compose 포트
- Next.js: 3000
- FastAPI: 8000
- PostgreSQL: 5432
