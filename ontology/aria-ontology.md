# ARIA 온톨로지 (L3) — 수치 다루기 전 필독

`ontology/aria-ontology-l3.json` 의 사람용 요약. 새 화면·집계·수치 해석 전에 읽는다(환각·오해석 방지).
정본은 JSON 쪽이며, 그 파일이 그대로 `ins/chat` 코파일럿의 시스템 프롬프트로 직렬화된다.

계층: **L1**(설계·기획 패턴, treasurer-ontology/patterns) → **L2**(재보험 산업 스키마, treasurer-ontology/extensions/reinsurance) → **L3**(이 앱, 여기).

## 반복 실수 지점 — 이것만은

집계를 통째로 뒤집는 것 둘이 먼저다.

- **★ Excel 소계·합계 행이 계약으로 적재돼 있다** (26건). `assured` 가 `Nth Sub-Total`·`Grandtotal` 인 행들로,
  전부 2017년 적재분이고 수금·지급일이 없어 미정산으로 잡힌다. 금액이 커서 **원시 미정산 총액 5,035.7억 중
  3,621.8억(71.9%)이 이 26건**이다. 배제 조건: `assured ~* '(sub-?total|grand ?total|합계|소계)'`.
- **★ 재보험사 계열 별칭이 갈려 있다.** Peak Re 5종(`Peak Re` 335 / `Peak Re HK` 83 / `Peak Re (HK)` 2 / …),
  AIG 5종(`AIG KR` 285 / `AIG` 108 / `AIG Korea` 56 / …). 계약과 클레임이 다른 표기를 쓰기도 한다.
  Peak Re 병합 시 **CR1 20.0%→39.6%, HHI 895(비집중)→1,711(중간집중)** 으로 결론이 바뀐다.
  법인이 실제로 다를 수 있으니(HK 법인 vs KR 지점) 자동 병합하지 말고 병합 시나리오로 함께 제시할 것.
- **`gross_prem_100` 을 SUM 하지 말 것.** 한 커버노트에 재보험사 N개면 같은 값이 N번 반복된다. 총 인수물량은 `SUM(ri_prem)`.
- **`currency = 'Kwon'` 은 KRW다** (258건). 통화별 집계에서 분리하면 원화가 과소집계된다. 묶었으면 묶었다고 답변에 쓴다.
- **`reinsurer = 'Unknown'` 은 재보험사가 아니라 결측** (736건). 랭킹·점유율에서 빼고, 뺀 건수를 보고한다.
- **`claims.status` 와 `claims.workflow_status` 는 다른 축.** 전자는 클레임 종결 여부(Open/Closed), 후자는 우리 정산 처리 단계. `Closed`/`closed` 대소문자 혼재.
- **`ref_no` 는 유일하지 않다.** 재보험사 수만큼 존재하는 정상 케이스와 실제 중복 입력이 섞여 있다. `run_reconciliation_check('duplicates')` 로 먼저 판별.
- **`line` 한 컬럼에 계약형태와 종목이 섞여 있다.** Treaty·QS·Surplus·XOL = 재보험 계약형태 / Cargo·PAR·CAR·D&O·CGL·PI = 원보험 종목. 구분 없이 집계하면 의미가 깨진다.
- **`claims.dol` 이 2,700건 NULL.** Treaty QS 같은 조약 정산은 개별 사고일이 없다. '사고' 단위 집계에 포함하면
  조약정산이 단일 사고로 잡혀 최대 사고 순위가 왜곡된다.
- **`period_to = period_from` 48건** — 실제 기간이 아니라 종기 미입력. 이 계약에 붙은 클레임은 담보기간 내
  포함 여부를 계약 원장으로 검증할 수 없다("검증 불가"로 분류).
- **`cover_notes.cover_note_number` 가 unique 아님** (PF210060 2행). 1,196행 / 고유 1,195개.
- **`policies` 는 파생 테이블** (policy_builder 산출). `contracts` 와 어긋나면 contracts 가 정본이고, 어긋난 사실 자체가 보고 대상.
- **모든 원장에 `company_id`** 가 있다. 전사 집계인지 특정 테넌트인지 모호하면 되묻거나 기준을 명시.
  (실측: 현재 테넌트는 1개뿐이라 전사 = 테넌트 기준이 동일하다.)

## 원장 구조

| 테이블 | 그레인 | 스냅샷 행수 | 키 |
|---|---|---|---|
| `contracts` | 계약 × 재보험사 | 18,006 | `cover_note_no` + `no` |
| `claims` | 클레임 × 재보험사 | 13,080 | `ref_no` (비유일) |
| `cover_notes` | 커버노트 | 1,196 | `cover_note_number` |
| `policies` | 커버노트 단위 집계(파생) | 4,931 | `cover_note_no` |

`cover_note_no` 가 계약 ↔ 클레임을 관통하는 유일 키다.

**금액 3종 병기**: 원통화(`origin_currency`) + 환율(`roe`) + KRW 환산(`krw_amount`). 지분 `share` 는 0~1 소수.
`ri_prem ≈ gross_prem_100 × share`, `net_ri_prem = ri_prem − ri_commission`.

## 워크플로

- 계약: `booked → analyzed → draft_ready → sent_to_reinsurer → payment_received → completed`
- 클레임: `soc_received → analyzed → draft_ready → review → sent_to_reinsurer → awaiting_payment → completed`

실데이터는 중간 단계를 대부분 건너뛴다(계약 11,577건이 `completed`, `analyzed`/`draft_ready` 거의 없음).
**단계 누락을 이상으로 보고하지 말 것** — 정상 패턴이다.

## 코파일럿 설계 규약

- **numbers_from_db_words_from_llm** — 수치는 전부 내부 툴(SQL). LLM 은 서술·추론만.
- **ontology_as_grounding** — 이 JSON 이 시스템 프롬프트.
- **agent_step_trace_ui** — thinking/tool_call/tool_result 를 인라인 노출. 과정이 상품(제1원칙 `process_as_product`).
- **human_in_the_loop_write** — `modify_record` 는 사람 승인 게이트.
- **조용한 정규화 금지** — Kwon 병합·Unknown 제외 같은 처리를 했으면 답변에 명시한다.

## + 알파렌즈 (외부 툴)

`use_mcp=true` 일 때만 argo(alpha-lenz) MCP 툴을 함께 쓴다. 서버측 실행, 엔드포인트 `https://api.alpha-lenz.com/mcp/`.

argo 는 툴이 100개인데 대부분 재보험과 무관하다(암호화폐·VCP·CANSLIM 등). 전량 노출하면 **턴당 입력 54,456 토큰**이라
`mcp_toolset` 의 `default_config:{enabled:false}` + `configs` allowlist 로 15개만 연다 → **19,638 토큰(63.9% 절감)**.
`configs` 는 툴명을 키로 하는 **객체**다. 배열로 보내면 400.

허용 툴: `news_search` · `resolve_entity` · `company_profile` · `financial_query` · `dart_*`(공시·재무·감사의견) ·
`opensanctions_*`(제재 스크리닝) · `macro_data` · `fred_*` · `economic_calendar`.

용도는 **내부 정본과의 교차대조**(`internal_external_bridging`)다:
- 재보험사 상대방 리스크 → 내부 익스포저·미정산 이력 vs 외부 제재·재무·감사의견
- 클레임의 '왜' → 내부 dol·금액 vs 외부 보도 정황

## 자산 경계

이 파일은 스키마·코드값 분포·진단 프레임만 담는다(우리 자산). 고객사 실명 로스터, 실거래 레코드,
고유 요율·특약 플레이북은 넣지 않는다 — 반납 테스트 대상.
