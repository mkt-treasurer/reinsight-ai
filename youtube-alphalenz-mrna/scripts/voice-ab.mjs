/**
 * 나레이션 자연스러움 A/B.
 * 핵심 가설: 한 큐를 통째로 합성하면 억양이 평평해진다.
 * 문장 단위로 끊어 합성하고 사이에 실제 호흡을 넣으면 사람처럼 들린다.
 */
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EdgeTTS } from "node-edge-tts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "out", "voice-ab");
const TMP = path.join(OUT, "tmp");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const PARA = [
  "일반적인 예방 백신과는 방식이 다릅니다.",
  "먼저 환자의 종양을 분석한 뒤, 암세포만의 특징을 찾아 면역체계에 알려줍니다.",
  "환자 한 명 한 명에게 맞춘, 개인별 암 백신인 셈입니다.",
];

const probe = (f) =>
  parseFloat(
    spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of",
      "default=nw=1:nk=1", f], { encoding: "utf8" }).stdout.trim()
  );

const ffmpeg = (args) => {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr?.slice(-800) || "ffmpeg failed");
};

async function say(text, voice, rate, file) {
  for (let i = 1; i <= 4; i++) {
    try {
      const tts = new EdgeTTS({
        voice, lang: "ko-KR",
        outputFormat: "audio-24khz-96kbitrate-mono-mp3",
        rate, pitch: "+0Hz", timeout: 120000,
      });
      await tts.ttsPromise(text, file);
      if (existsSync(file) && probe(file) > 0.2) return;
      throw new Error("empty");
    } catch (e) {
      if (i === 4) throw e;
      await new Promise((r) => setTimeout(r, 1200 * i));
    }
  }
}

/** 문장별 파일을 호흡(초)을 끼워 이어 붙인다 */
function joinWithBreaths(files, breaths, out) {
  const inputs = [];
  const parts = [];
  let cursor = 0;
  files.forEach((f, i) => {
    inputs.push("-i", f);
    const ms = Math.round(cursor * 1000);
    parts.push(`[${i}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`);
    cursor += probe(f) + (breaths[i] ?? 0);
  });
  const mix = files.map((_, i) => `[a${i}]`).join("");
  ffmpeg([
    "-y", ...inputs,
    "-filter_complex",
    `${parts.join(";")};${mix}amix=inputs=${files.length}:normalize=0:duration=longest,` +
      `apad,atrim=0:${cursor.toFixed(3)},loudnorm=I=-18:TP=-2:LRA=9[o]`,
    "-map", "[o]", "-c:a", "libmp3lame", "-q:a", "2", out,
  ]);
}

const HY = "ko-KR-HyunsuMultilingualNeural";
const IJ = "ko-KR-InJoonNeural";

const CASES = [
  {
    id: "A_현재방식_통째로",
    run: async (f) => say(PARA.join(" "), HY, "+16%", f),
  },
  {
    id: "B_문장별_호흡",
    run: async (f) => {
      const fs = [];
      for (let i = 0; i < PARA.length; i++) {
        const p = path.join(TMP, `b${i}.mp3`);
        await say(PARA[i], HY, "+16%", p);
        fs.push(p);
      }
      joinWithBreaths(fs, [0.34, 0.30, 0], f);
    },
  },
  {
    id: "C_문장별_속도변화",
    run: async (f) => {
      const rates = ["+10%", "+18%", "+8%"]; // 도입 천천히, 설명 빠르게, 결론 천천히
      const fs = [];
      for (let i = 0; i < PARA.length; i++) {
        const p = path.join(TMP, `c${i}.mp3`);
        await say(PARA[i], HY, rates[i], p);
        fs.push(p);
      }
      joinWithBreaths(fs, [0.38, 0.32, 0], f);
    },
  },
  {
    id: "D_InJoon_속도변화",
    run: async (f) => {
      const rates = ["+8%", "+16%", "+6%"];
      const fs = [];
      for (let i = 0; i < PARA.length; i++) {
        const p = path.join(TMP, `d${i}.mp3`);
        await say(PARA[i], IJ, rates[i], p);
        fs.push(p);
      }
      joinWithBreaths(fs, [0.38, 0.32, 0], f);
    },
  },
];

for (const c of CASES) {
  const f = path.join(OUT, `${c.id}.mp3`);
  await c.run(f);
  console.log(`${c.id.padEnd(24)} ${probe(f).toFixed(1)}s`);
}
rmSync(TMP, { recursive: true, force: true });
console.log(`\n-> ${OUT}`);
