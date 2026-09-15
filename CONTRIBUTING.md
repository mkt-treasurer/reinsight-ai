# 작업 규칙

이 저장소는 **공개(public)** 다. 커밋 전에 시크릿이 섞이지 않았는지 항상 확인한다.

## 브랜치

`main` 에 직접 커밋하지 않는다. 작업을 시작하기 전에 브랜치를 먼저 판다.

```bash
git switch main && git pull
git switch -c feat/soc-parser-kb
```

접두사는 변경 성격에 맞춘다.

| 접두사 | 쓰는 경우 |
|---|---|
| `feat/` | 기능 추가 |
| `fix/` | 버그 수정 |
| `docs/` | 문서만 변경 |
| `chore/` | 빌드·설정·의존성 등 동작에 영향 없는 정리 |
| `refactor/` | 동작은 그대로, 구조만 변경 |

## PR

`push.autoSetupRemote` 가 저장소 로컬에 설정돼 있어 첫 푸시에도 `-u` 가 필요 없다.

```bash
git push
gh pr create --fill
```

제목은 커밋 메시지와 같은 규칙(`type(scope): 요약`)을 쓰고, 본문에는
**무엇을 왜 바꿨는지**를 적는다. 리뷰어가 diff만 보고 의도를 역산하게 두지 않는다.

화면이 바뀌는 변경이면 스크린샷을, 파서·대사 로직이 바뀌면 테스트 결과를 붙인다.

## 커밋 전 확인

### 시크릿

`.env` 는 `.gitignore` 에 있지만, 코드에 키를 하드코딩하면 그대로 공개된다.
키는 반드시 환경변수로 읽는다 — `youtube-alphalenz-mrna/scripts/fetch-media.mjs` 가 그 예다.

푸시 전에 스테이징된 내용만 한 번 훑는다.

```bash
git diff --cached
```

### 업무 데이터

계약 관리 원장, 원수사 문서, 설문 응답 등은 PII 다. `.gitignore` 에
`reference/`, `backend/data/`, `AI계약관리.xlsx`, `*.eml` 등이 걸려 있으니
`git add -f` 로 우회하지 않는다.

### 미디어 산출물

`*.mp4`, `*.wav`, `*.mp3`, `*.jpg` 와 `output/`, `*/out/`, `public/media/` 는
의도적으로 제외돼 있다(2.3GB → 22MB). 렌더 결과물은 커밋하지 않고
소스(Remotion 컴포넌트, 스크립트, `script.json`)만 올린다.
영상은 소스에서 다시 뽑을 수 있어야 한다.

## 테스트

바꾼 영역만이라도 돌려보고 올린다.

```bash
cd frontend && npm test                  # 프론트엔드
pip install pytest && cd backend && pytest   # 백엔드 (requirements.txt 에 없음)
./scripts/run_soc_tests.sh               # SOC 추출 회귀 — 백엔드(:7601) 기동 필요
```

## 온톨로지

`ontology/aria-ontology-l3.json` 이 정본이고 `ins/chat` 코파일럿의 시스템 프롬프트로
직렬화된다. 수치나 용어를 다루기 전에 사람용 요약인 `ontology/aria-ontology.md` 를 먼저 읽는다.
