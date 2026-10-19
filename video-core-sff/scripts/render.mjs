/**
 * Render out/core-sff-30s.mp4. If public/music.mp3 exists it is mixed in;
 * otherwise the output is silent (the film reads fully with sound off).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const music = existsSync(path.join(root, "public", "music.mp3"));
const out = path.join(root, "out", process.env.OUT || "core-sff-30s.mp4");

// Props go through a file: Windows shells mangle quotes in an inline JSON argument.
mkdirSync(path.join(root, "out"), { recursive: true });
const propsFile = path.join(root, "out", "props.json");
writeFileSync(propsFile, JSON.stringify({ music }));

const args = [
  "remotion", "render", "src/index.ts", process.env.COMP || "Main", out,
  "--concurrency=2",
  `--props=${propsFile}`,
];
if (!music) args.push("--muted");
console.log(music ? "music.mp3 found: mixing in" : "no music.mp3: rendering silent");
const r = spawnSync("npx", args, { cwd: root, stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
