/**
 * audio/<sceneId>-NN.mp3|wav 가 이미 존재한다고 보고
 *   1) 큐별 길이 측정 → src/timing.json
 *   2) 슬롯에 맞춰 배치한 나레이션 트랙 → audio/narration.wav
 *   3) out-subtitles.srt
 * 를 만든다. TTS로 뽑았든 사람이 녹음했든 이 단계는 동일하다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const FPS = 30;

export const probe = (file) => {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file], { encoding: "utf8" });
  const d = parseFloat((r.stdout || "").trim());
  return Number.isFinite(d) ? d : 0;
};

export const ffmpeg = (args) => {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr?.slice(-1800) || "ffmpeg failed");
};

const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(
    Math.floor(ms / 1000) % 60
  )},${p(ms % 1000, 3)}`;
};

export const cueFile = (root, sceneId, i) => {
  const base = path.join(root, "audio", `${sceneId}-${String(i + 1).padStart(2, "0")}`);
  for (const ext of [".mp3", ".wav", ".m4a"]) if (existsSync(base + ext)) return base + ext;
  return null;
};

export function buildTimeline(root, { source = "tts" } = {}) {
  const script = JSON.parse(readFileSync(path.join(root, "src/script.json"), "utf8"));
  const timeline = [];
  const scenes = [];
  let t = 0;

  for (let si = 0; si < script.scenes.length; si++) {
    const scene = script.scenes[si];
    const sceneStart = t;
    const cues = [];
    for (let ci = 0; ci < scene.cues.length; ci++) {
      const file = cueFile(root, scene.id, ci);
      if (!file) throw new Error(`missing audio for ${scene.id} cue ${ci + 1}`);
      const dur = probe(file);
      if (dur < 0.2) throw new Error(`audio too short: ${file}`);
      const cue = { ...scene.cues[ci], file: path.basename(file), start: t, dur };
      cues.push(cue);
      timeline.push({ file, start: t, dur, sub: scene.cues[ci].sub });
      t += dur + (ci === scene.cues.length - 1 ? 0 : script.gapCue);
    }
    if (si < script.scenes.length - 1) t += script.gapScene;
    scenes.push({ id: scene.id, start: sceneStart, end: t, dur: t - sceneStart, cues });
  }
  const total = t + script.tailHold;

  let frameCursor = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const endSec = i === scenes.length - 1 ? total : scenes[i + 1].start;
    const endFrame = Math.round(endSec * FPS);
    s.from = frameCursor;
    s.durationInFrames = Math.max(1, endFrame - frameCursor);
    frameCursor = endFrame;
    for (const c of s.cues) {
      c.fromInScene = Math.round(c.start * FPS) - s.from;
      c.framesInScene = Math.max(1, Math.round((c.start + c.dur) * FPS) - Math.round(c.start * FPS));
    }
  }

  writeFileSync(
    path.join(root, "src/timing.json"),
    JSON.stringify({ fps: FPS, source, total, totalFrames: frameCursor, scenes }, null, 2)
  );

  const inputs = [];
  const parts = [];
  timeline.forEach((c, i) => {
    inputs.push("-i", c.file);
    const ms = Math.round(c.start * 1000);
    parts.push(`[${i}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`);
  });
  const mixIn = timeline.map((_, i) => `[a${i}]`).join("");
  const filter =
    `${parts.join(";")};${mixIn}amix=inputs=${timeline.length}:normalize=0:duration=longest,` +
    `apad,atrim=0:${total.toFixed(3)},alimiter=limit=0.95[out]`;
  ffmpeg(["-y", ...inputs, "-filter_complex", filter, "-map", "[out]",
    "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", path.join(root, "audio/narration.wav")]);

  writeFileSync(
    path.join(root, "out-subtitles.srt"),
    "﻿" + timeline.map((c, i) =>
      `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.start + c.dur)}\n${c.sub.replace(/\*\*/g, "")}\n`).join("\n"),
    "utf8"
  );

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  console.log(`\nsource=${source}  cues=${timeline.length}  total=${total.toFixed(2)}s (${mmss(total)})  frames=${frameCursor}`);
  scenes.forEach((s) => console.log(`  ${s.id.padEnd(14)} ${s.start.toFixed(1).padStart(6)}s  +${s.dur.toFixed(1)}s`));
  return { total, frameCursor, scenes };
}
