import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EdgeTTS } from "node-edge-tts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "out", "tone-test");

const FORMAL = [
  "8월 19일, 모더나 주가가 하루 만에 177% 급등했습니다.",
  "다음 날 국내에서는 소마젠이 상한가를 기록했고, mRNA 관련주에 매수세가 몰렸습니다.",
  "하지만 같은 이름표 아래에서도, 연결의 거리는 회사마다 다릅니다.",
  "소마젠은 과거 모더나와 유전체 분석 공급 이력이 있습니다. 다만 이번 암 백신의 임상이나 생산 참여로 단정하기는 어렵습니다.",
].join(" ");

const CASUAL = [
  "8월 19일이었어요. 모더나가 하루 만에 177% 올랐습니다. 하루 만에요.",
  "다음 날 우리나라도 들썩였죠. 소마젠은 상한가 갔고, mRNA 붙은 종목들이 다 같이 움직였어요.",
  "근데 여기서 한 번 짚고 갈 게 있어요. 같은 mRNA 관련주라고 묶여도, 회사마다 거리가 꽤 다르거든요.",
  "소마젠은 예전에 모더나랑 유전체 분석 공급 계약을 한 적이 있어요. 근데 그거랑, 이번 암 백신을 같이 만든다는 건 다른 얘기죠.",
].join(" ");

const probe = (f) => parseFloat(spawnSync("ffprobe", ["-v", "error", "-show_entries",
  "format=duration", "-of", "default=nw=1:nk=1", f], { encoding: "utf8" }).stdout.trim());

const CASES = [
  { id: "1-문어체_현재대본", text: FORMAL, rate: "+16%", pitch: "+0Hz" },
  { id: "2-구어체_같은설정", text: CASUAL, rate: "+16%", pitch: "+0Hz" },
  { id: "3-구어체_더빠르고밝게", text: CASUAL, rate: "+24%", pitch: "+12Hz" },
];

for (const c of CASES) {
  const file = path.join(OUT, `${c.id}.mp3`);
  const tts = new EdgeTTS({
    voice: "ko-KR-HyunsuMultilingualNeural", lang: "ko-KR",
    outputFormat: "audio-24khz-96kbitrate-mono-mp3",
    rate: c.rate, pitch: c.pitch, timeout: 120000,
  });
  await tts.ttsPromise(c.text, file);
  console.log(c.id.padEnd(24), c.rate.padStart(5), c.pitch.padStart(6), probe(file).toFixed(1) + "s");
}
