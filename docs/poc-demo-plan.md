# insightre.ai — Facultative Placement RQ 자동화 PoC 데모 계획

> 대상: 인스보험중개(노석균님) PoC 시연 · 최종 업데이트 2026-06-17
> 상태: prod 배포 완료(https://insightre.ai), 헬스 ok 확인

## 1. 한 줄 스토리

원수사 RQ 업로드 → **AI 추출 + 산출기초 일치성 검증** → **INS Corp 양식 슬립(RQ/Placing/Closing/Cover Note/Debit Note) 초안** → **재보험사 담당자 매칭** → **담당자 검수·저장**.
반복적인 "원수사 슬립 → 당사 양식 재작성"을 줄이고, RQ↔설문서 산출기초 불일치를 시스템이 먼저 잡아낸다. 모든 외부 발송은 담당자 검토 후 직접(Human-in-the-loop).

## 2. 환경 / URL

| 용도 | 위치 |
|---|---|
| 작업 화면 | https://insightre.ai/ins/tools/rq-slip |
| 검수 큐 | https://insightre.ai/ins/tools/rq-slip/cases |
| 헬스 체크 | `GET https://insightre.ai/api/tools/rq-slip/health` → `status:ok` |
| 로컬 백업 스택 | http://localhost:7602 (frontend) / :7601 (backend) |

## 3. 사전 준비 (시연 당일 아침)

- [ ] `curl -s https://insightre.ai/api/tools/rq-slip/health | jq` → `status:"ok"`, `failing:[]`
- [ ] 락게이트(접속 비밀번호) 확인 — 하드 로드 시마다 요구됨
- [ ] (선택) 시드 케이스 이관 — 검수 큐에 미리 채워두고 시연하려면:
  ```bash
  # DEV 머신에서
  cd backend && python -m scripts.rq_slip_io dump /tmp/rq_cases.json
  scp /tmp/rq_cases.json ec2-user@13.209.27.97:/tmp/
  ssh ec2-user@13.209.27.97 'docker exec -i reinsai-backend python -m scripts.rq_slip_io load /tmp/rq_cases.json'
  ```
- [ ] 샘플 파일 핸드폰/로컬에 준비 (아래 4장 파일 목록)
- [ ] 로컬 스택(`docker compose up`)도 띄워 두기 — 네트워크 사고 시 폴백

## 4. 데모 흐름 (시연 순서)

샘플 위치: `트레져러 & 인스보험중개/1. 보험사 또는 계약자로부터 받는 리스크 관련 정보/`

**Step 1 — 추출 + 산출기초 불일치 (핵심 장면)**
업로드: `1. RQ.../[삼성화재] The Founders Inc. 요율의뢰서_001회차_Ins Corp..pdf` + `2. 설문서/CGL 설문서_더파운더즈 작성.docx`
→ reinsured=**Samsung Fire & Marine** 자동 식별, 특약 43개 추출,
→ **자료 일치성 검증**에 `[HIGH] annual_turnover: USD 475,365,023 ↔ 7,000억원(설문서)` 자동 표시 + "RQ 슬립 값 우선 · 원수사 확인 권장" 라벨.

**Step 2 — 슬립 타입 전환 (다중 문서)**
상단 토글: **RQ → Placing → Closing → Cover Note → Debit Note**.
위험 정보 블록은 공유되고, 단계별 금융/조건 항목만 변함 (RQ: R/I Capacity · Placing/Closing: R/I Share·Net R/I Premium · Cover Note: R/I Comm·Security · Debit Note: Due from you·PPW). PDF 다운로드 시연.

**Step 3 — 이메일 항목 (출처 구분)**
원수사 이메일 본문을 **텍스트로 붙여넣기** → "이메일 수신 정보" 패널에 타겟보험료·RI Commission·**필요 Capacity**·제출기한이 잡힘. (첫 Submission 노출 방지를 위해 슬립 본문엔 미포함, 참고용 표시)

**Step 4 — 재보험사 매칭 (M7)**
업로드: `4. 리스크.../Reinsurer Contact Point_Reinsurance_2026.xlsx`
→ CGL 건 → **Casualty / PL(CGL)** 분류 → 담당 언더라이터 73명 + 이메일 추출.

**Step 5 — 검수·저장 워크플로우**
필드 수정(라벨 옆 호박색 점) → **Diff 패널**(AI 원본 vs 편집본 before/after) → **Save** → **검토 판정**(정확/수정요/오류) → 상태 **Draft → Reviewed → Sent** → **검수 큐**(`/cases`)에서 상태·판정 필터 + `?case=<id>` 딥링크.

**Step 6 — 한글 번호양식 (일반화)**
업로드: `1. RQ.../[DB손해보험] RQ_파라다이스_D&O_2026.pdf` (단독)
→ D&O 한글 번호양식, 소급보장일자, 특약 21개, **불일치 없음 경로**("✓") 시연.

## 5. 데모 중 안정성 / 폴백

- **extract 실패 시**: 업로드 화면의 **"↪ 최근 저장 케이스로 이어서"** 원클릭 복구 → 미리 저장한 케이스로 화면 복원.
- **이메일은 텍스트 붙여넣기로** 시연(브라우저 파일 업로드도 정상; CLI 쉼표 경로 이슈는 데모와 무관).
- **모니터링**: `ssh … 'docker exec reinsai-backend tail -f logs/rq_slip/events.jsonl'`
- **최후 폴백**: 공개 URL 사고 시 로컬 `localhost:7602`로 전환.

## 6. 시연하지 않는 것 / 알려진 한계

- **실제 발송 안 함** — 슬립·메일은 초안, 담당자가 검토 후 직접 발송(설계 원칙).
- 후속 예정: 단계별 Slip 변화 비교(M5) · 갱신 계약 비교(M6) · 재보험사 **회신 학습형 추천**(M7 고도화).
- 공식 양식은 **필드·순서·라벨 정렬** 수준(레이아웃/로고 픽셀 일치는 아님).
- `additional_fields`가 limit과 일부 중복 포착될 수 있음(담당자가 행 삭제 가능).

## 7. 데모 후 (튜닝/정리)

- 감사로그(`backend/logs/rq_slip/`)의 `events.jsonl` + `extract_*.json` 분석 → `RQ_EXTRACT` 프롬프트 튜닝.
- **PII 보존정책**: `extract_*.json`(Gemini 원응답=피보험자·재무 포함)은 **7일 후 자동 삭제**(`RQ_SLIP_LOG_RETENTION_DAYS`, 기본 7). PII를 아예 안 남기려면 `RQ_SLIP_AUDIT_RAW=0`.
