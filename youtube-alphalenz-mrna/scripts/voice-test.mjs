import { mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EdgeTTS } from "node-edge-tts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "out", "voice-test");
mkdirSync(OUT, { recursive: true });

// natural orthography — numerals and latin left as-is
const TEXT =
  "그런데 왜 주가는 177%나 올랐을까요. 모더나는 코로나 이후 성장동력이 비어 있었습니다. " +
  "2분기 매출은 약 1억 달러, 순손실은 약 8억 달러였습니다. " +
  "소마젠은 과거 모더나와 유전체 분석 공급 이력이 있습니다. " +
  "다만 이번 암 백신의 임상이나 생산 참여로 단정하기는 어렵습니다.";

const CANDIDATES = [
  { id: "A_SunHi_14",     voice: "ko-KR-SunHiNeural",              rate: "+14%", pitch: "+0Hz" },
  { id: "B_Hyunsu_8",     voice: "ko-KR-HyunsuMultilingualNeural", rate: "+8%",  pitch: "+0Hz" },
  { id: "C_Hyunsu_16",    voice: "ko-KR-HyunsuMultilingualNeural", rate: "+16%", pitch: "+0Hz" },
  { id: "D_InJoon_14",    voice: "ko-KR-InJoonNeural",             rate: "+14%", pitch: "+0Hz" },
  { id: "E_SunHi_22",     voice: "ko-KR-SunHiNeural",              rate: "+22%", pitch: "+0Hz" },
];

const probe = (f) =>
  parseFloat(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", f], { encoding: "utf8" }).stdout.trim());

const syl = (TEXT.match(/[가-힣]/g) || []).length;

for (const c of CANDIDATES) {
  const file = path.join(OUT, `${c.id}.mp3`);
  const tts = new EdgeTTS({
    voice: c.voice, lang: "ko-KR",
    outputFormat: "audio-24khz-96kbitrate-mono-mp3",
    rate: c.rate, pitch: c.pitch, timeout: 120000,
  });
  await tts.ttsPromise(TEXT, file);
  const d = probe(file);
  console.log(
    c.id.padEnd(14),
    c.voice.padEnd(38),
    c.rate.padStart(5),
    `${d.toFixed(1)}s`.padStart(7),
    `${(syl / d).toFixed(2)} 음절/초`
  );
}
console.log(`\n한글 음절 ${syl}개 · 현재 본편은 4.51 음절/초 · 자연 발화 5.5~6.5`);
