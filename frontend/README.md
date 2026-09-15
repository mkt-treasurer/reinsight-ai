# ARIA — frontend

Next.js 16 / React 19 / Tailwind 4 / Base UI. 백엔드(FastAPI)는 `../backend`.
루트 개요는 [../README.md](../README.md).

## 실행

보통은 레포 루트에서 compose 로 스택 전체를 띄운다 (`frontend:7602`).

```bash
cd .. && docker compose up --build
```

프론트만 단독으로 돌릴 때:

```bash
npm install
npm run dev          # :3000
```

백엔드 주소는 `NEXT_PUBLIC_API_URL` 로 주입한다. 미설정 시 `src/lib/api.ts` 가
`http://localhost:7601` 로 폴백하므로, 로컬에서 백엔드가 그 포트에 떠 있으면
별도 설정 없이 붙는다.

```bash
npm run build        # 프로덕션 빌드
npm start            # 빌드 결과 서빙
npm run lint         # eslint
npm test             # vitest (watch: npm run test:watch)
```

## 화면 구성

세 종류의 표면이 한 앱에 들어 있고, 디자인 규칙이 서로 다르다.

| 경로 | 성격 | 디자인 |
|---|---|---|
| `/` | 공개 랜딩 (마케팅) | `src/components/sections/*` 조합. DESIGN.md 적용 대상 아님 |
| `/survey` | 공개 만족도 설문 | 독립 |
| `/ins/**` | 내부 업무 화면 | **DESIGN.md 준수** |

### `/ins` 하위

```
/ins                          Overview — KPI·차트·attention·펀넬 (DESIGN.md 기준 구현체)
/ins/claims                   클레임 목록 · by-account · ref/[refno] · reinsurer/[name]
/ins/contracts                계약 목록 · [id] · audit · by-cover-note · process
/ins/policies                 정책 목록 · [id]
/ins/documents                문서
/ins/process/[id]             클레임 처리 워크플로
/ins/reconciliation           대사
/ins/audit-data               데이터 감사
/ins/chat                     ins/chat 코파일럿 (L3 온톨로지 그라운딩)
/ins/whats-new                변경 이력 (src/data/changelog/entries.ts)
/ins/tools/slip-generator     슬립 생성 · [uuid] · test-suite
/ins/tools/rq-slip            RQ 슬립 · cases · pdf/ (jsPDF 문서 모델)
/ins/tools/weekly-dashboard   주간 리포트
/ins/tools/news-insights      뉴스 인사이트
/ins/tools/bd                 BD
/ins/tools/ops                운영
/ins/admin/slip-testbench     테스트벤치 · runs · runs/[id]
```

`/ins` 전체는 `src/app/ins/layout.tsx` 아래에서 `LockGate` 로 감싸여 있다.
이건 **인증이 아니라 데모용 잠금 화면**이다 — 통과 여부를 `localStorage`
(`reinsai_unlocked`)에만 두므로 접근 제어로 믿으면 안 된다.

## 소스 배치

```
src/app/            App Router 페이지, actions/send-inquiry.ts (문의 폼 Server Action)
src/components/     공용 컴포넌트 (DataTable, ChartCard, StatCard, Modal, Sidebar,
                    GlobalSearch, EvidenceGraph, SlipDocument, EmailComposeModal ...)
  sections/         랜딩 페이지 섹션
  ui/               프리미티브
src/lib/            api.ts(백엔드 fetch + 응답 타입), eml.ts, slipEmail.ts,
                    emailRecipients.ts, inquiry-schema.ts, utils.ts
src/data/changelog/ /ins/whats-new 항목
public/fonts/       NanumGothic (PDF 생성용)
```

테스트는 `src/lib/*.test.ts` 에 모여 있다 (eml, slipEmail, emailRecipients).

## 규칙

- **[DESIGN.md](./DESIGN.md)** — `/ins` 화면의 디자인 언어. 새 업무 화면은
  `src/app/ins/page.tsx` 구조를 복사해서 시작한다.
- **[AGENTS.md](./AGENTS.md)** — 코딩 에이전트용 규칙. 이 Next.js 버전은 학습
  데이터와 API·관례가 다를 수 있으므로 `node_modules/next/dist/docs/` 를 먼저 읽을 것.
