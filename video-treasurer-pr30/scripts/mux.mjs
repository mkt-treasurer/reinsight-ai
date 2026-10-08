/**
 * 렌더된 무음 영상에 오디오를 붙여 최종 mp4 를 만든다.
 *
 *   node scripts/mux.mjs              나레이션 + (bgm/ 에 음원이 있으면) 음악
 *   NO_VO=1 node scripts/mux.mjs      나레이션 없이 음악·효과음만
 *   MUSIC_BELOW=20 node scripts/mux.mjs   음악을 나레이션보다 20 LU 아래로
 *
 * 음악 레벨은 고정값이 아니라 나레이션 라우드니스를 재서 상대적으로 맞춘다.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const video = path.join(root, "out", process.env.SILENT || "video-silent.mp4");
const narration = path.join(root, "audio", "narration.wav");
const final = path.join(root, process.env.OUT_NAME || "treasurer-45s-fintech-festival.mp4");

if (!existsSync(video)) {
  throw new Error(`먼저 렌더하세요. 없는 파일: ${video}`);
}

const NO_VO = process.env.NO_VO === "1" || !existsSync(narration);
const DUCK_BELOW = Number(process.env.MUSIC_BELOW || 19);

const probeDur = (f) =>
  parseFloat(
    spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of",
      "default=nw=1:nk=1", f], { encoding: "utf8" }).stdout.trim()
  );

const lufs = (f) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128",
    "-f", "null", "-"], { encoding: "utf8" });
  const m = (r.stderr || "").match(/I:\s*(-?[\d.]+)\s*LUFS/g);
  return m ? parseFloat(m[m.length - 1].match(/(-?[\d.]+)/)[1]) : -18;
};

// bgm/ 에서 음원 하나를 고른다 (score.wav 를 우선)
let bgm = null;
const bgmDir = path.join(root, "bgm");
if (existsSync(bgmDir)) {
  const files = readdirSync(bgmDir).filter((x) => /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(x));
  const preferred = files.find((f) => /^score\./i.test(f)) || files[0];
  if (preferred) bgm = path.join(bgmDir, preferred);
}

if (NO_VO && !bgm) throw new Error("NO_VO 모드인데 bgm/ 에 음원이 없습니다.");

const dur = probeDur(video);
// 나레이션이 끝난 뒤(tailHold 구간)에만 페이드아웃 — 안 그러면 끝말을 물어버린다
const script = JSON.parse(readFileSync(path.join(root, "src/script.json"), "utf8"));
const tail = Math.max(0.6, script.tailHold || 1.0);
const fadeStart = NO_VO ? Math.max(0, dur - 3.0) : Math.max(0, dur - tail + 0.1);
const fadeDur = NO_VO ? 3.0 : Math.max(0.4, tail - 0.2);

const args = ["-y", "-i", video];
let filter;

if (NO_VO) {
  args.push("-stream_loop", "-1", "-i", bgm);
  filter =
    "[1:a]aresample=48000," +
    `atrim=0:${dur.toFixed(3)},` +
    "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000," +
    `afade=t=out:st=${fadeStart.toFixed(2)}:d=${fadeDur.toFixed(2)},` +
    "alimiter=limit=0.97[a]";
  console.log(`나레이션 없음 · 음악+효과음: ${path.basename(bgm)} (${lufs(bgm).toFixed(1)} LUFS)`);
} else if (bgm) {
  args.push("-i", narration, "-stream_loop", "-1", "-i", bgm);
  const ln = lufs(narration);
  const lm = lufs(bgm);
  const gain = ln - DUCK_BELOW - lm;
  console.log(
    `나레이션 ${ln.toFixed(1)} LUFS · 음악 ${lm.toFixed(1)} LUFS → ` +
      `음악 ${gain.toFixed(1)} dB (나레이션 대비 -${DUCK_BELOW} LU)`
  );
  filter =
    "[1:a]aresample=48000,asplit=2[vo][sc];" +
    `[2:a]aresample=48000,volume=${gain.toFixed(2)}dB[m];` +
    "[m][sc]sidechaincompress=threshold=0.02:ratio=6:attack=20:release=500[mduck];" +
    "[vo][mduck]amix=inputs=2:normalize=0:duration=first," +
    "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000," +
    `afade=t=out:st=${fadeStart.toFixed(2)}:d=${fadeDur.toFixed(2)},` +
    "alimiter=limit=0.97[a]";
} else {
  args.push("-i", narration);
  filter =
    "[1:a]aresample=48000,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.97[a]";
}

args.push(
  "-filter_complex", filter,
  "-map", "0:v", "-map", "[a]",
  "-c:v", "copy",
  "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-ac", "2",
  "-shortest", "-movflags", "+faststart",
  final
);

const r = spawnSync("ffmpeg", args, { encoding: "utf8", stdio: "inherit" });
if (r.status !== 0) process.exit(1);
console.log(`\nOUT: ${final}`);
