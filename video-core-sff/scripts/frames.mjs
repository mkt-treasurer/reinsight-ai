/** Pull one still from past the midpoint of every scene into out/frames/, plus a contact sheet. */
import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const video = path.join(root, "out", process.argv[2] || "core-sff-30s.mp4");
const dir = path.join(root, "out", "frames");
mkdirSync(dir, { recursive: true });

const cut = JSON.parse(readFileSync(path.join(root, "src", "cut.json"), "utf8"));
const FPS = cut.fps;
const frames = (s) => Math.round((s.from !== undefined ? s.to - s.from : s.dur) * FPS);

let cursor = 0;
const outs = [];
cut.scenes.forEach((s, i) => {
  const tr = i > 0 && s.in ? cut.transitionFrames[s.in] : 0;
  const start = i > 0 ? cursor - tr : 0;
  const n = frames(s);
  cursor = start + n;
  const t = (start + Math.round(n * 0.6)) / FPS;
  const out = path.join(dir, `${String(i + 1).padStart(2, "0")}-${s.id}.jpg`);
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(3), "-i", video, "-frames:v", "1", "-q:v", "2", out], { stdio: "inherit" });
  if (r.status !== 0) process.exit(1);
  console.log(`${path.basename(out).padEnd(16)} @ ${t.toFixed(2)}s   (scene ${(start / FPS).toFixed(2)}–${(cursor / FPS).toFixed(2)}s)`);
  outs.push(out);
});
console.log(`total ${(cursor / FPS).toFixed(2)}s`);

// contact sheet, 4 per row
const cols = 4;
const rows = Math.ceil(outs.length / cols);
const inputs = outs.flatMap((o) => ["-i", o]);
const scaled = outs.map((_, i) => `[${i}]scale=480:-1[s${i}]`).join(";");
const layout = outs.map((_, i) => `${(i % cols) === 0 ? 0 : Array.from({ length: i % cols }, (_, k) => `w${k}`).join("+")}_${Math.floor(i / cols) === 0 ? 0 : Array.from({ length: Math.floor(i / cols) }, (_, k) => `h${k * cols}`).join("+")}`).join("|");
const refs = outs.map((_, i) => `[s${i}]`).join("");
const sheet = path.join(dir, "sheet.jpg");
const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", `${scaled};${refs}xstack=inputs=${outs.length}:layout=${layout}:fill=black`, sheet], { stdio: "inherit" });
if (r.status === 0) console.log(`sheet: ${sheet} (${cols}x${rows})`);
