# TREASURER × INS — 재보험 정산 AI 제품 데모 영상

미팅용 개념/목업 기반 제품 데모 (Remotion). 다크 네이비 TREASURER "무대" 위에
실제 INS 제품 화면(라이트 파이낸셜 데스크 UI)을 앱 윈도우로 얹은 구성.

## 3편 구성

| 편 | 제목 | 씬 | 길이 |
|----|------|----|------|
| **A** | 문제를 통제한다 | Overview → Claims by Account → Data Audit | 35s |
| **B** | AI가 만들고, 사람이 승인한다 | Document Chain → Slip Generator → Review Queue | 40s |
| **C** | 운영이 되고, 계속 좋아진다 | Weekly Dashboard → News→Agent → Testbench → Closing | 42s |

통합본 ~117s. 한국어(본편) + 영어 세트 각각 생성.

## 렌더

```bash
npm install                 # 최초 1회 (Chrome Headless Shell 자동 다운로드)
npm run render:A            # out/A_문제를통제한다_ko.mp4
npm run render:B
npm run render:C
bash scripts/concat.sh ko   # out/전체_INS정산AI데모_ko.mp4
bash scripts/render-en.sh   # 영어 3편 + 통합본
```

미리보기(스튜디오): `npm run dev` → 브라우저에서 씬별 타임라인 스크럽.

## 구조

- `src/theme.ts` — 무대(다크 네이비+블루) / 제품 윈도우(라이트 데스크) 토큰
- `src/i18n.ts` — 자막·카피 한/영, `src/data.ts` — 재보험 도메인 목업 데이터
- `src/stage/` — Stage(워드마크·grid·Confidential), AppWindow(브라우저+masthead), Caption
- `src/ui/primitives.tsx` — KPI/카드/배지 등 INS UI 프리미티브
- `src/scenes/S1..S10` — 씬별 컴포넌트, `src/videos/VideoA|B|C.tsx` — Sequence 조립
- `src/Root.tsx` — ko/en × A/B/C = 6개 Composition 등록

## 데이터 현실감

원수사(삼성화재·DB손보·현대해상·KB손보·메리츠), 재보험사(Swiss Re·Munich Re·Korean Re·
SCOR·Hannover Re), POL/SOC/BDX/INV/TRY-2026-XXX, USD/KRW, Property Cat XL·Marine·
Casualty QS 등 실제 라인. placeholder 없음.

> 개념/목업 데모입니다. 실제 계약 데이터가 아니며, 화면은 제안 단계 UI 컨셉입니다.
