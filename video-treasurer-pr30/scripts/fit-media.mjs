/**
 * 클립을 씬 길이에 정확히 맞춘다 — 루프 없이 한 번에 흐르게.
 *
 *   node scripts/fit-media.mjs
 *
 * 짧은 영상을 반복 재생하면 마지막 프레임에서 멈췄다가 튀는 게 보인다.
 * 그래서 재생 속도를 늦춰(setpts) 씬 길이를 한 번에 덮도록 다시 인코딩한다.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(root, "public", "media");
const timing = JSON.parse(readFileSync(path.join(root, "src/timing.json"), "utf8"));
const dur = Object.fromEntries(
  timing.scenes.map((s) => [s.id, (s.durationInFrames + 12) / timing.fps])
);

/** 클립 → 덮어야 할 씬 */
const FIT = [
  { id: "collect-a", scene: "s1-collect" },
  { id: "mis-a", scene: "s2-mismatch" },
];

const probe = (f) =>
  parseFloat(
    spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of",
      "default=nw=1:nk=1", f], { encoding: "utf8" }).stdout.trim()
  );

const manifestPath = path.join(MEDIA, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

for (const { id, scene } of FIT) {
  const src = path.join(MEDIA, `${id}.mp4`);
  if (!existsSync(src)) {
    console.log(`  skip ${id} — 파일 없음`);
    continue;
  }
  const have = probe(src);
  const need = dur[scene];
  if (!need) {
    console.log(`  skip ${id} — 씬 ${scene} 없음`);
    continue;
  }
  const factor = need / have;
  const tmp = path.join(MEDIA, `${id}.fit.mp4`);

  // 이미 충분히 길면 자르기만, 짧으면 느리게 늘린다
  const pts = factor > 1 ? factor : 1;
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-i", src, "-vf", `setpts=${pts.toFixed(4)}*PTS,fps=30`, "-t", need.toFixed(2),
      "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
      "-g", "10", "-keyint_min", "10", "-sc_threshold", "0", "-movflags", "+faststart", tmp],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    console.error(`  FAIL ${id}\n${(r.stderr || "").slice(-600)}`);
    continue;
  }
  spawnSync("cmd", ["/c", "move", "/y", tmp, src], { encoding: "utf8" });
  const after = probe(src);
  manifest.clips[id] = { ...(manifest.clips[id] || {}), scene, seconds: after };
  console.log(`  ok ${id.padEnd(10)} ${have.toFixed(1)}s → ${after.toFixed(1)}s  (x${pts.toFixed(2)})`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
writeFileSync(path.join(root, "src/media.json"), JSON.stringify(manifest, null, 2));
console.log("\n씬 길이에 맞췄습니다 — 루프 없음");
