/**
 * Edge TTS 나레이션.
 *
 * 큐를 통째로 한 번에 합성하면 문장 사이에 호흡이 없고 억양이 평평해져서
 * 기계처럼 들린다. 그래서 문장 단위로 따로 합성한 뒤
 *   - 문장마다 속도를 달리 주고 (도입 느리게 → 설명 빠르게 → 결론 느리게)
 *   - 사이에 실제 무음(호흡)을 끼워
 * 이어 붙인다. node-edge-tts 가 XML 을 이스케이프해서 SSML <break> 는 못 쓴다.
 *
 *   node scripts/tts.mjs
 *   VOICE=ko-KR-HyunsuMultilingualNeural node scripts/tts.mjs
 *   TEMPO=6 node scripts/tts.mjs      # 전체를 6%p 더 빠르게
 */
import { readFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EdgeTTS } from "node-edge-tts";
import { buildTimeline, probe, cueFile, ffmpeg } from "./build-timeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO = path.join(root, "audio");
const TMP = path.join(root, "out", "tts-tmp");
mkdirSync(AUDIO, { recursive: true });
mkdirSync(TMP, { recursive: true });

const VOICE = process.env.VOICE || "ko-KR-InJoonNeural";
const TEMPO = Number(process.env.TEMPO || 0);  // 전체 속도 오프셋(%p)

/** 문장 위치별 속도 — 사람은 일정한 속도로 말하지 않는다 */
function ratesFor(n) {
  const r = (v) => `${v + TEMPO >= 0 ? "+" : ""}${v + TEMPO}%`;
  if (n === 1) return [r(11)];
  if (n === 2) return [r(12), r(8)];
  return [r(8), ...Array(n - 2).fill(r(16)), r(6)];
}

/** 문장 사이 호흡(초). 마지막 뒤에는 없다 */
function breathsFor(n) {
  if (n <= 1) return [0];
  const b = [];
  for (let i = 0; i < n - 1; i++) b.push(i === 0 ? 0.36 : 0.30);
  b.push(0);
  return b;
}

const splitSentences = (t) =>
  (t.match(/[^.?!]+[.?!]*/g) || [t]).map((s) => s.trim()).filter(Boolean);

async function say(text, rate, file) {
  for (let i = 1; i <= 4; i++) {
    try {
      const tts = new EdgeTTS({
        voice: VOICE,
        lang: "ko-KR",
        outputFormat: "audio-24khz-96kbitrate-mono-mp3",
        rate,
        pitch: "+0Hz",
        timeout: 120000,
      });
      await tts.ttsPromise(text, file);
      if (existsSync(file) && probe(file) > 0.2) return;
      throw new Error("빈 오디오");
    } catch (e) {
      if (i === 4) throw e;
      await new Promise((r) => setTimeout(r, 1200 * i));
    }
  }
}

/** 문장 파일들을 호흡을 끼워 하나로 */
function joinWithBreaths(files, breaths, out) {
  if (files.length === 1) {
    ffmpeg(["-y", "-i", files[0], "-af", "aresample=48000,loudnorm=I=-18:TP=-2:LRA=9",
      "-c:a", "libmp3lame", "-q:a", "2", out]);
    return;
  }
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

const script = JSON.parse(readFileSync(path.join(root, "src/script.json"), "utf8"));
let made = 0;

for (const scene of script.scenes) {
  for (let ci = 0; ci < scene.cues.length; ci++) {
    if (cueFile(root, scene.id, ci)) continue;
    const id = `${scene.id}-${String(ci + 1).padStart(2, "0")}`;
    const dst = path.join(AUDIO, `${id}.mp3`);
    const parts = splitSentences(scene.cues[ci].vo);
    const rates = ratesFor(parts.length);
    process.stdout.write(`tts ${id} (${parts.length}문장) ... `);
    const files = [];
    for (let s = 0; s < parts.length; s++) {
      const p = path.join(TMP, `${id}-${s}.mp3`);
      await say(parts[s], rates[s], p);
      files.push(p);
    }
    joinWithBreaths(files, breathsFor(parts.length), dst);
    console.log(`${probe(dst).toFixed(2)}s`);
    made++;
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log(`\n${made}개 생성 · voice=${VOICE} · tempo=${TEMPO >= 0 ? "+" : ""}${TEMPO}`);
buildTimeline(root, { source: `tts:${VOICE} per-sentence tempo${TEMPO}` });
