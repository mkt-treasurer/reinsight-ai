# Slip Testbench Dataset

샘플 클레임 문서 보관 디렉터리. `/admin/slip-testbench/runs`에서
이 폴더를 입력으로 받아 추출 → 비교 → VLM 분석을 실행한다.

## 폴더 구조

```
testbench-dataset/
├── pla/                ← PLA 슬립 (Premium Loss Advisory)
├── soc/                ← SOC 슬립 (Statement of Claim)
├── pla_bordereau/      ← PLA 보더루
└── soc_bordereau/      ← SOC 보더루
        ├── input/         ← 원본 클레임 PDF (재보험사 → 인스에 들어온 것)
        ├── ground_truth/  ← 수기로 작성된 정답 슬립 PDF
        └── generated/     ← slip-generator 가 출력한 PDF
```

문서 타입 4종 × 소스 3종 = 12개 하위 폴더. 비어 있어도 `.gitkeep`
으로 폴더 자체는 유지된다.

## 파일명 컨벤션

페어링 로직은 `frontend/src/app/admin/slip-testbench/page.tsx`의
`pickReinsurerFromFilename` + `tokenize` + `jaccard`를 그대로 재사용한다.
즉:

- **같은 클레임의 input / ground_truth / generated PDF는 파일명을 가능한 한 동일하게.**
  - `2020-1021024610_KB_(NH).pdf`
- **재보험사명은 마지막 괄호**에 둔다 — `(NH)`, `(Samsung Fire & Marine Insurance)`.
  카운터처럼 보이는 `(1)`, `(2)` 또는 `(DOL ...)`은 무시된다.
- 한 클레임에 여러 재보험사가 있으면 같은 base + 다른 괄호:
  - `2020-1021024610_KB_(NH).pdf`
  - `2020-1021024610_KB_(Samsung).pdf`

파일명이 어긋나도 자카드 점수가 0.1 이상이면 페어로 묶인다. 그 밑이면
`unmatched`로 분리되어 화면 상단에 노출된다.

## Git 정책

`.gitignore`가 모든 PDF / 이미지 / 엑셀 / CSV / JSON을 무시한다. 폴더
구조 + `.gitkeep` + 이 README만 커밋된다. 데이터 자체는 git이 아니라
S3 / 별도 공유 채널로 동기화한다 (추후 결정).
