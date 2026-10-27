/**
 * Fetch the two Singapore b-roll clips the MAS film uses (Pexels, free for commercial use, no credit required)
 * and re-encode them as all-keyframe 1080p so Remotion's seeks never miss (see README "Source prep").
 *
 *   PEXELS_API_KEY=... node scripts/fetch-sg-broll.mjs
 *
 * The key is also read from ../video-wooricard-fss/.env if present. Output: public/clips/sg-<id>.mp4 (gitignored).
 */
import { existsSync, mkdirSync, readFileSync, createWriteStream } from "node:fs";
import { spawnSync } from "node:child_process";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLIPS = [
  { id: 30570498, note: "Singapore city skyline at night, reflections — Timo Volz", url: "https://www.pexels.com/video/30570498/" },
  { id: 33702866, note: "Aerial view of Singapore's skyline (CBD) — Florian Delée", url: "https://www.pexels.com/video/33702866/" },
];

let key = process.env.PEXELS_API_KEY;
const envFile = path.join(root, "..", "video-wooricard-fss", ".env");
if (!key && existsSync(envFile)) {
  const m = readFileSync(envFile, "utf8").match(/^\s*PEXELS_API_KEY\s*=\s*(.+)\s*$/m);
  if (m) key = m[1].replace(/^["']|["']$/g, "");
}
if (!key) {
  console.error("PEXELS_API_KEY is not set");
  process.exit(1);
}

const getJSON = (url) =>
  new Promise((res, rej) =>
    https
      .get(url, { headers: { Authorization: key } }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            res(JSON.parse(d));
          } catch {
            rej(new Error(`${r.statusCode}: ${d.slice(0, 200)}`));
          }
        });
      })
      .on("error", rej)
  );

const download = (url, file) =>
  new Promise((res, rej) =>
    https
      .get(url, (r) => {
        if (r.statusCode >= 300 && r.headers.location) return download(r.headers.location, file).then(res, rej);
        if (r.statusCode !== 200) return rej(new Error("HTTP " + r.statusCode));
        const w = createWriteStream(file);
        r.pipe(w);
        w.on("finish", () => w.close(() => res(file)));
        w.on("error", rej);
      })
      .on("error", rej)
  );

mkdirSync(path.join(root, "public", "clips"), { recursive: true });
mkdirSync(path.join(root, "out"), { recursive: true });

for (const c of CLIPS) {
  const out = path.join(root, "public", "clips", `sg-${c.id}.mp4`);
  if (existsSync(out) && !process.argv.includes("--force")) {
    console.log(`skip ${c.id} (exists)`);
    continue;
  }
  const v = await getJSON(`https://api.pexels.com/videos/videos/${c.id}`);
  const f = (v.video_files || []).filter((x) => x.width >= 1600 && x.file_type === "video/mp4").sort((a, b) => a.width - b.width)[0];
  if (!f) throw new Error(`no 1080p file for ${c.id}`);
  const raw = path.join(root, "out", `sg-raw-${c.id}.mp4`);
  console.log(`download ${c.id}: ${c.note}`);
  await download(f.link, raw);
  const r = spawnSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", raw, "-t", "12", "-vf", "fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv420p", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-g", "1", "-keyint_min", "1", "-movflags", "+faststart", out],
    { stdio: "inherit" }
  );
  if (r.status !== 0) process.exit(1);
  console.log(`  -> ${path.relative(root, out)}`);
}
