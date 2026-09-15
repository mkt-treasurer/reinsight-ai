# Slip Generator — PDF 다운로드 수동 검증 체크리스트

자동 테스트 스위트(`/tools/slip-generator/test-suite`)는 추출 정확도(재보험사 매칭, ref_no)만 검사하고 PDF 캡처/다운로드 단계는 검증하지 않습니다. 회귀 방지를 위해 다음 시나리오를 PR 머지 전 한 번씩 수동으로 확인하세요.

## 골든 케이스
- 권장 케이스: `reference/보험금/2026년 3월/현대자동차 C2024019200429-33-5/`
  - 입력: `SOC_*.pdf`, 보더루 xlsx
  - 기대 SOC: 재보험사 1개 이상, 한글 피보험자, KRW 통화
- 보더루 다중 행 케이스: `reference/보험금/.../KB Settlement of Claim*` (선택)

## 시나리오 매트릭스

| # | 동작 | 기대 결과 |
|---|------|----------|
| 1 | Generate 직후 **Preview를 펼치지 않고** SOC 카드의 `PDF` 버튼 클릭 | PDF 파일이 즉시 다운로드됨 (이전: 무반응) |
| 2 | Preview 펼쳐 둔 상태에서 `PDF` 클릭 | PDF 다운로드, 화면 깨짐/잔상 없음 |
| 3 | SOC가 N≥2일 때 `Download All PDF` 클릭 | N개 파일 모두 다운로드됨 (이전: 펼쳐진 1개만) |
| 4 | `/process/[id]` 화면에서 Preview 안 펼친 채 `Download PDF` 클릭 | PDF 다운로드됨 |

## PDF 내용 검증 (각 다운로드 파일에 대해)

- [ ] 파일명에 한글이 깨지지 않음 (예: `SOC_현대자동차_..._UY2024(DOL 2024-03-15)_REF... (Munich Re).pdf`)
- [ ] 8개 정보 필드가 모두 보임: Reinsured / Insured / Type / Policy Period / Date of Loss / Location of Loss / Particulars of Loss / Remarks (필요 시 Nature of Loss)
- [ ] Settlement 표 5칸이 보임: Claim Amount(100%) / Expense(100%) / Total(100%) / Your Share % / Your Amount + Cedant's Ref No
- [ ] 한글 텍스트가 사각형(tofu)으로 깨지지 않음 — Pretendard 미로드 시 Arial로 폴백되어 모양은 다를 수 있으나 글자는 읽혀야 함
- [ ] 표·라인이 잘리지 않음 (단일 페이지에 잘 들어가는지)
- [ ] 금액 천단위 콤마/소수점 그대로 (`fmt()` 결과와 일치)
- [ ] Your Share % 가 `share * 100` 과 일치 (예: 0.05 → 5.00%)

## 발견된 이슈 → 인접 작업 트리아지

- 보더루처럼 본문이 길어 단일 A4에 안 맞으면 압축되어 잘릴 수 있음 → 별도 티켓 (multi-page 처리)
- contentEditable 필드를 편집 중 PDF 누르면 마지막 입력이 미반영 → 별도 티켓 (blur-then-capture)

이 두 가지는 본 회귀와 무관하므로 본 패치 범위 밖.
