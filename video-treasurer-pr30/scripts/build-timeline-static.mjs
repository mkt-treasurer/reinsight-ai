/**
 * 나레이션이 없는 영상용 타임라인.
 *
 * 원본(youtube-alphalenz-mrna)은 TTS 오디오 길이를 재서 timing.json 을 만들었지만
 * 이 영상은 자막만 있으므로 script.json 의 cue.sec 이 곧 표시 시간이다.
 * 출력 형식은 동일하게 맞춰서 Captions / Footage / make-score 를 그대로 재사용한다.
 *
 *   node scripts/build-timeline-static.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FPS = 30;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(
    Math.floor(ms / 1000) % 60
  )},${p(ms % 1000, 3)}`;
};

const script = JSON.parse(readFileSync(path.join(root, "src/script.json"), "utf8"));
const flat = [];
const scenes = [];
let t = 0;

for (let si = 0; si < script.scenes.length; si++) {
  const scene = script.scenes[si];
  const sceneStart = t;
  const cues = [];
  for (let ci = 0; ci < scene.cues.length; ci++) {
    const c = scene.cues[ci];
    const dur = Number(c.sec);
    if (!(dur > 0.4)) throw new Error(`${scene.id} cue ${ci + 1}: sec 값이 없거나 너무 짧습니다`);
    cues.push({ ...c, start: t, dur });
    flat.push({ start: t, dur, sub: c.sub });
    t += dur + (ci === scene.cues.length - 1 ? 0 : script.gapCue);
  }
  if (si < script.scenes.length - 1) t += script.gapScene;
  scenes.push({ id: scene.id, start: sceneStart, end: t, dur: t - sceneStart, cues });
}
const total = t + script.tailHold;

// 초 → 정수 프레임. 씬 경계에 빈틈이 생기지 않도록 앞 씬의 끝을 다음 씬의 시작에 붙인다
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
  JSON.stringify({ fps: FPS, source: "static:script.json", total, totalFrames: frameCursor, scenes }, null, 2)
);

writeFileSync(
  path.join(root, "out-subtitles.srt"),
  "﻿" +
    flat
      .map(
        (c, i) =>
          `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.start + c.dur)}\n${c.sub.replace(/\*\*/g, "")}\n`
      )
      .join("\n"),
  "utf8"
);

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
console.log(`\n자막 ${flat.length}개 · 총 ${total.toFixed(2)}s (${mmss(total)}) · ${frameCursor}프레임`);
scenes.forEach((s) =>
  console.log(`  ${s.id.padEnd(12)} ${s.start.toFixed(1).padStart(6)}s  +${s.dur.toFixed(1)}s  (${s.cues.length}컷)`)
);
