# ARIA / ReinsAI

재보험 클레임·계약 처리 플랫폼. 원수사에서 들어오는 클레임 문서(SOC·PLA·보더루)를
추출·검증하고, 계약/정산 데이터와 대사(reconciliation)한 뒤, 정산 슬립을 생성한다.

FastAPI 백엔드 + Next.js 프론트엔드, L3 온톨로지를 시스템 프롬프트로 직렬화해
LLM 추출·질의응답의 그라운딩 컨텍스트로 쓴다.

## 구조

```
backend/            FastAPI (Python 3.12, SQLAlchemy async + Postgres, arq 워커)
  app/routers/      26개 라우터 — claims, contracts, policies, reconciliation,
                    soc_generator, soc_stream(SSE), slip_testbench, weekly, news, bd, survey ...
  app/services/     도메인 로직 — 문서 파서, 클레임/계약 프로세서, 대사 엔진,
                    cedant 판별, 재보험사 명칭 정규화, LLM 프롬프트, 챗 에이전트
  app/services/parsers/   원수사별 결정론적 파서 (KB 보더루 등)
  alembic/          DB 마이그레이션
  tests/            pytest — 파서 픽스처, 회귀 시나리오

frontend/           Next.js 16 / React 19 / Tailwind 4 / Base UI
  src/app/ins/      내부 업무 화면 — claims, contracts, policies, documents,
                    process, reconciliation, audit-data, chat, tools, admin
  src/app/survey/   만족도 설문 (공개)

ontology/           L3 온톨로지. aria-ontology-l3.json 이 정본이며 ins/chat
                    코파일럿의 시스템 프롬프트로 직렬화된다.
                    aria-ontology.md 는 사람용 요약 — 수치 다루기 전 필독.

testbench-dataset/  슬립 테스트벤치 입력 (PLA/SOC × 보더루, input/ground_truth/generated)
docs/               ADR, 배포 문서, PoC 데모 계획
scripts/            ssh-tunnel.sh, deploy.sh, ec2-bootstrap.sh, SOC 테스트 러너
deploy/             nginx 설정

demo-video/         Remotion 기반 세일즈 데모 영상 소스
alder-demo/         정적 데모 페이지 + 녹화 스크립트
youtube-alphalenz-*/ 유튜브 영상(알파렌즈) Remotion 프로젝트
```

## 로컬 실행

Postgres와 Redis는 로컬에서 띄우지 않는다. 공용 EC2 호스트에 있고
SSH 터널(로컬 `7700`/`7703`)로 붙는다.

```bash
cp .env.example .env        # 값 채우기 (아래 참고)
./scripts/ssh-tunnel.sh     # 터미널 1 — pg:7700, redis:7703
docker compose up --build   # 터미널 2 — backend:7601, worker, frontend:7602
```

iTerm2를 쓴다면 `make dev` 가 위 두 단계를 패널로 나눠 한 번에 띄운다.
`make logs` / `make stop` / `make build` 도 있다.

| 서비스 | 로컬 포트 |
|---|---|
| backend (FastAPI) | http://localhost:7601 |
| frontend (Next.js) | http://localhost:7602 |
| Postgres (터널) | 7700 |
| Redis (터널) | 7703 |

## 환경 변수

`.env.example` 을 복사해서 채운다. 백엔드는 pydantic-settings 로 읽으며
`backend/app/config.py` 의 Settings 필드명(소문자)이 대문자 키에 1:1 대응한다.

필수는 `DATABASE_URL`, `POSTGRES_PASSWORD`, `GEMINI_API_KEY` 정도고
나머지는 비워두면 **해당 기능만** 비활성화되고 백엔드는 정상 기동한다
(`ANTHROPIC_API_KEY` 없으면 챗 비활성, 뉴스 키 없으면 뉴스 툴만 missing 등).

`SURVEY_RESULTS_PASSWORD` 만 예외 — 미설정 시 설문 결과 조회 API가
401로 fail-closed 된다(소스 fallback 없음).

## 테스트

```bash
cd frontend && npm test
```

백엔드 테스트는 pytest 로 돌지만 `requirements.txt` 에 들어 있지 않다 — 따로 설치해야 한다.

```bash
pip install pytest && cd backend && pytest
```

SOC 추출 회귀 스위트는 백엔드 API(`:7601`)를 호출하므로 먼저 스택을 띄워야 한다.

```bash
./scripts/run_soc_tests.sh
```

인자로 케이스 id 부분 문자열을 넘기면 해당 케이스만 돌고, `CONCURRENCY` 로 동시 실행 수를 바꾼다.

## 배포

```bash
./scripts/deploy.sh          # rsync → EC2 → docker-compose.prod.yml up -d --build → health check
```

SSH 키는 `REINSAI_SSH_KEY` 또는 `~/.ssh/kbo-stats-key.pem`.
프로덕션 환경변수는 별도의 `.env.prod` 를 호스트에 둔다(레포에 없음).

## 레포에 없는 것

`.gitignore` 로 제외된 항목들 — 클론 후 별도로 채워야 한다.

- `.env`, `.env.prod` — 시크릿
- `reference/`, `backend/data/` — 원본 업무 데이터
- 미디어 산출물 (`*.mp4`, `*.jpg`, `*.wav`, `*.mp3`), `output/`, `*/out/`, `public/media/`
- 계약 관리 원장·문서 양식 (PII)
