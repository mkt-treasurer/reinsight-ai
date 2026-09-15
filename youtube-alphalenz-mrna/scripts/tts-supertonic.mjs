/**
 * Supertonic 3 (로컬 ONNX) 로 나레이션을 만든다. API 키·로그인 없음.
 *
 * 사전 준비: ../../supertonic 에 저장소 + assets(모델) + nodejs/node_modules
 *
 *   node scripts/tts-supertonic.mjs
 *   VOICE=M3 node scripts/tts-supertonic.mjs
 *   SPEED=1.18 node scripts/tts-supertonic.mjs      # 클수록 빠름
 *   node scripts/tts-supertonic.mjs --force
 *
 * Edge TTS 와 달리 모델이 문단 억양을 스스로 처리하므로 큐를 통째로 합성한다.
 * (Edge 에서는 평평해져서 문장별로 쪼개 호흡을 끼워야 했다)
 */
import { readFileSync, existsSync, mkdirSync, rmSync, readdirSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTimeline, probe, cueFile, ffmpeg } from "./build-timeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** 프로젝트를 옮겨도 찾을 수 있게 후보를 순서대로 훑는다 */
const ST = (() => {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    process.env.SUPERTONIC_DIR,
    path.resolve(root, "..", "..", "supertonic"),
    path.resolve(root, "..", "supertonic"),
    home && path.join(home, "Downloads", "supertonic"),
    home && path.join(home, "supertonic"),
    "C:\\dev\\supertonic",
  ].filter(Boolean);
  const hit = candidates.find((c) => existsSync(path.join(c, "nodejs", "example_onnx.js")));
  if (hit) return hit;
  console.error(
    `\nsupertonic 을 못 찾았습니다. 찾아본 곳:\n  ${candidates.join("\n  ")}\n\n` +
      `SUPERTONIC_DIR 로 직접 지정하세요.\n`
  );
  process.exit(1);
})();
const NODEJS = path.join(ST, "nodejs");
const AUDIO = path.join(root, "audio");
const WORK = path.join(root, "out", "st-work");

const VOICE = process.env.VOICE || "F2";
const SPEED = process.env.SPEED || "1.05";
const FORCE = process.argv.includes("--force");

for (const [label, p] of [
  ["supertonic 저장소", NODEJS],
  ["모델(assets/onnx)", path.join(ST, "assets", "onnx", "vocoder.onnx")],
  ["보이스 프리셋", path.join(ST, "assets", "voice_styles", `${VOICE}.json`)],
  ["node_modules", path.join(NODEJS, "node_modules")],
]) {
  if (!existsSync(p)) {
    console.error(`\n${label} 없음: ${p}\n설치 안내는 SUPERTONIC.md 참고\n`);
    process.exit(1);
  }
}

mkdirSync(AUDIO, { recursive: true });

/** 한 문단을 합성해 wav 경로를 돌려준다 */
function synth(text) {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  const r = spawnSync(
    process.execPath,
    [
      "example_onnx.js",
      "--n-test", "1",
      "--lang", "ko",
      "--text", text,
      "--voice-style", path.join("..", "assets", "voice_styles", `${VOICE}.json`),
      "--speed", String(SPEED),
      "--save-dir", WORK,
    ],
    { cwd: NODEJS, encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "").slice(-600));
  const wav = readdirSync(WORK).find((f) => f.endsWith(".wav"));
  if (!wav) throw new Error("wav 생성 안 됨:\n" + (r.stdout || "").slice(-400));
  return path.join(WORK, wav);
}

const script = JSON.parse(readFileSync(path.join(root, "src/script.json"), "utf8"));
let made = 0;
const t0 = Date.now();

for (const scene of script.scenes) {
  for (let ci = 0; ci < scene.cues.length; ci++) {
    if (cueFile(root, scene.id, ci) && !FORCE) continue;
    const id = `${scene.id}-${String(ci + 1).padStart(2, "0")}`;
    const dst = path.join(AUDIO, `${id}.mp3`);
    process.stdout.write(`supertonic ${id} ... `);
    const wav = synth(scene.cues[ci].vo);
    // 앞뒤 무음을 정리하고 -18 LUFS 로 맞춘다
    ffmpeg([
      "-y", "-i", wav,
      "-af",
      "silenceremove=start_periods=1:start_silence=0.06:start_threshold=-45dB:" +
        "stop_periods=-1:stop_silence=0.12:stop_threshold=-45dB," +
        "aresample=48000,loudnorm=I=-18:TP=-2:LRA=9",
      "-c:a", "libmp3lame", "-q:a", "2", "-ac", "1", dst,
    ]);
    console.log(`${probe(dst).toFixed(2)}s`);
    made++;
  }
}

rmSync(WORK, { recursive: true, force: true });
console.log(
  `\n${made}개 생성 · voice=${VOICE} · speed=${SPEED} · ${((Date.now() - t0) / 1000).toFixed(0)}초 소요`
);
buildTimeline(root, { source: `supertonic:${VOICE} speed${SPEED}` });
