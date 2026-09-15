# AlphaLenz — 모더나 177% / mRNA 관련주 영상

실사 B-roll 위에 데이터 그래픽과 자막을 얹는 구성. 1920×1080 · 30fps.

## 지금 상태

- [x] 씬 구성 · 그래픽 · 자막 · 썸네일
- [x] 임시 나레이션 (Edge TTS)
- [ ] **나레이션** → `NARRATION.md` (클로바더빙 또는 직접 녹음)
- [ ] **B-roll 영상** → `.env` 에 API 키 넣고 `node scripts/fetch-media.mjs`

두 가지가 채워지기 전에도 렌더는 됩니다. 나레이션은 TTS가, 배경은 그라디언트가 대신합니다.

## 전체 흐름

```bash
npm install

# 1. 나레이션  (택 1)
node scripts/tts.mjs                 # 임시용 Edge TTS
node scripts/import-recording.mjs    # audio/rec/ 의 클로바더빙·녹음 파일을 가져옴

# 1b. 음악·효과음 (나레이션 없는 버전)
node scripts/make-score.mjs

# 2. B-roll 영상  (.env 필요)
node scripts/fetch-media.mjs

# 3. 제품 화면 캡처
node scripts/capture.mjs

# 4. 렌더 + 오디오 합성
npx remotion render src/index.ts Main out/video-silent.mp4 --concurrency=2 --timeout=180000
node scripts/mux.mjs

# 썸네일
npx remotion still src/index.ts Thumbnail thumbnail-1920x1080.png
```

1번이 바뀌면 길이가 바뀌므로 4번을 다시 돌려야 합니다.
BGM만 추가하는 거라면 `bgm/` 에 음원 넣고 4번의 `mux.mjs` 만 다시 돌리면 됩니다.

## 파일 구조

| 경로 | 내용 |
|---|---|
| `src/script.json` | **대본** (구어체) — `vo`(나레이션) / `sub`(화면 자막) |
| `src/shots.json` | 씬별 B-roll 검색어 |
| `src/timing.json` | 자동 생성 — 오디오 길이에서 계산한 씬·자막 타이밍 |
| `src/scenes/` | 씬별 그래픽 |
| `src/Footage.tsx` | B-roll 배경 + 스크림 + 그레이딩 |
| `audio/rec/` | 클로바더빙 결과물이나 녹음을 여기 넣습니다 |
| `public/media/` | 받아온 B-roll (자동 생성) |
| `CREDITS.txt` | 영상 출처 기록 (자동 생성) |

## 설계 메모

- **폰트는 base64 data URI로 임베드**(`src/fontData.ts`)돼 있습니다. `staticFile()` 로 fetch 하면
  렌더 탭에서 간헐적으로 폰트 로딩이 영영 안 끝나 1700~3500프레임 근처에서 렌더가 죽습니다.
  Remotion 이 타이머를 패치하기 때문에 `setTimeout` 가드도 안 먹힙니다.
- **자막·모션 타이밍은 오디오에서 역산**합니다. 그래서 나레이션을 바꾸면 반드시 재렌더가 필요합니다.
- **문장 분할은 "가장 긴 쉼 N-1개"** 를 고릅니다. 무음 개수를 맞추려 들면 문장 안의
  자연스러운 쉼 때문에 절대 안 맞습니다.
