/**
 * Render every stand-alone clip in src/clips.tsx to out/clips/<file>.mp4 (1920x1080, 30fps, silent),
 * then grab one still from each at 60% for a quick check.
 *
 *   node scripts/render-clips.mjs            all clips
 *   node scripts/render-clips.mjs 06 hook    only clips whose file name contains "06" or "hook"
 */
import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out", "clips");
mkdirSync(outDir, { recursive: true });

// Read the clip table out of clips.tsx without a bundler: id / file / seconds per line.
const src = readFileSync(path.join(root, "src", "clips.tsx"), "utf8");
const clips = [...src.matchAll(/\{ id: "([^"]+)", file: "([^"]+)", seconds: ([\d.]+)/g)].map((m) => ({ id: m[1], file: m[2], seconds: Number(m[3]) }));
const filter = process.argv.slice(2);
const todo = filter.length ? clips.filter((c) => filter.some((f) => c.file.includes(f))) : clips;

for (const c of todo) {
  const out = path.join(outDir, c.file);
  console.log(`\n▶ ${c.id} → ${c.file} (${c.seconds}s)`);
  const r = spawnSync("npx", ["remotion", "render", "src/index.ts", c.id, out, "--muted", "--concurrency=2"], { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const still = out.replace(/\.mp4$/, ".jpg");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", (c.seconds * 0.6).toFixed(2), "-i", out, "-frames:v", "1", "-q:v", "2", still], { stdio: "inherit" });
}
console.log(`\nDone: ${todo.map((c) => c.file).join(", ")}`);
