# Treasurer — 45s festival film

SFF(싱가포르 핀테크 페스티벌) 부스 상영용 홍보 영상. 영어, 무음 재생 전제, 루프.

- Remotion 4 · 1920×1080 · 30fps · **44.9초**
- 나레이션·자막 트랙 없음. 정보는 전부 화면 안에 있다.
- 결과물: `treasurer-45s-fintech-festival.mp4` (커밋하지 않음)

## 구성

| 시각 | 씬 | 내용 |
|---|---|---|
| 0:00 | `s-open` | TREASURER — AI agents for financial institutions |
| 0:04 | `s-what` | 애널리스트가 매주 반복하는 세 가지 업무. 마지막에 Monitoring 을 골라 다음 씬으로 넘긴다 |
| 0:09 | `s-demo` | Monitoring 에이전트 실행 — ASK → READ → ANSWER |
| 0:17 | `s-graph` | 흩어진 데이터가 TA7Z 온톨로지 그래프로 조립된다 |
| 0:25 | `s-deploy` | 그 그래프가 고객 VPC 경계 안으로 들어간다 |
| 0:30 | `s-bench` | FIN-RATE 벤치마크 — Treasurer AX vs GPT-5.2 · Gemini 3.1 Pro |
| 0:36 | `s-reach` | 60+ 기관 · 한국 LIVE → 싱가포르·홍콩 PILOT → 일본·미국 NEXT |
| 0:41 | `s-close` | The AI operating layer for financial institutions |

## 만드는 법

```bash
npm run timeline   # src/script.json → src/timing.json (씬 길이·큐 앵커)
npm run media      # src/shots.json → Pexels B-roll → public/media/  (.env 에 키 필요)
npm run score      # timing.json 에 맞춰 BGM·효과음 합성 → bgm/score.wav
npm run render     # → out/video-silent.mp4
npm run mux        # + score.wav → treasurer-45s-fintech-festival.mp4
```

`src/script.json` 의 `cue.sec` 이 씬 길이와 애니메이션 앵커를 동시에 결정한다.
문구나 박자를 바꾸려면 거기부터 고치고 `npm run timeline` 을 다시 돌린다.

`node_modules` 는 형제 프로젝트로 걸린 디렉터리 정션이다. **이 폴더에서 `npm install` 하지 말 것.**

## 영상에 들어간 주장의 출처

`Treasurer_IR_260910_Skydeck.pdf` 기준.

| 화면 | 근거 |
|---|---|
| FIN-RATE 0.85/0.80/0.72/0.95 vs 0.65/0.76/0.68/0.95 | 덱 5쪽. 자체 평가라 `TREASURER IN-HOUSE EVALUATION` 을 병기한다 |
| 6,800+ sources | 덱 5쪽 |
| TA7Z 온톨로지 (Company·Person·Contract·Filing·Event·Asset·Regulation·Claim) | 덱 4·5쪽 |
| VPC/on-prem · customer-held keys · zero egress · ISO 27001 | 덱 5·10쪽 |
| 60+ institutions | 덱 6쪽 "Institutions with seats" |
| 한국 LIVE / 싱가포르·홍콩 PILOT / 일본·미국 NEXT | 덱 9쪽 |

### 일부러 뺀 것

- **매출·투자 수치** ($1.05M ARR, $3M 라운드, $2.9M 목표) — 투자자용이라 공개 부스 화면에 올리지 않는다.
- **고객사명·로고** — 공개 전시물에 쓰려면 각 사 동의가 필요하다.

### 아직 미확정

- `s-demo` 의 화면 내용(질문 문구, "2 ownership changes / 1 guidance cut / 1 rating downgrade",
  소스 칸 4개)은 **전부 가상의 예시**다. 실제 제품 UI 캡처로 교체하는 편이 낫다.
