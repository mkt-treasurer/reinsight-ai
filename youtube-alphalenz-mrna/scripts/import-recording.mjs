/**
 * 사람이 녹음한 파일을 가져와 큐 단위로 정리한다.
 *
 * audio/rec/ 에 아래 셋 중 아무 방식으로나 넣으면 된다.
 *   1) 문장별   s2-spread-01.wav, s2-spread-02.wav ...   (가장 확실)
 *   2) 씬별     s1-hook.wav, s2-spread.wav ...           (문장 사이 쉼으로 자동 분할)
 *   3) 통짜     all.wav                                  (전체를 자동 분할)
 * 섞어서 넣어도 된다. 문장별 파일이 있으면 그게 우선한다.
 *
 * 각 클립은 하이패스 + 노이즈 게이트 + 디에서 + -18 LUFS 정규화를 거쳐
 * audio/<sceneId>-NN.mp3 로 저장되고, 이어서 timing.json / narration.wav / srt 를 만든다.
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTimeline, probe, ffmpeg } from "./build-timeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REC = path.join(root, "audio", "rec");
const AUDIO = path.join(root, "audio");
mkdirSync(REC, { recursive: true });

const script = JSON.parse(readFileSync(path.join(root, "src/script.json"), "utf8"));
const EXT = [".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".webm"];

const find = (stem) => {
  for (const e of EXT) {
    const f = path.join(REC, stem + e);
    if (existsSync(f)) return f;
  }
  return null;
};

const pad = (i) => String(i + 1).padStart(2, "0");

/**
 * 무음 구간을 전부 찾은 뒤 "가장 긴 쉼 N-1개"를 끊는 지점으로 고른다.
 * 문장 안의 자연스러운 쉼(마침표 뒤 0.3초 등)까지 세면 개수가 맞을 리 없으므로,
 * 개수를 맞추려 하지 말고 길이 순위로 고르는 편이 훨씬 안정적이다.
 */
function splitBySilence(file, wantCount) {
  const dur = probe(file);
  if (wantCount === 1) return { segs: [[0, dur]], margin: Infinity, shortestChosen: 0, longestRejected: 0 };

  const r = spawnSync("ffmpeg", ["-i", file, "-af", "silencedetect=noise=-33dB:d=0.20", "-f", "null", "-"], { encoding: "utf8" });
  const log = r.stderr || "";
  const starts = [...log.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => parseFloat(m[1]));
  const ends = [...log.matchAll(/silence_end: (-?[\d.]+)/g)].map((m) => parseFloat(m[1]));

  const gaps = [];
  for (let i = 0; i < starts.length; i++) {
    const s0 = starts[i];
    const e0 = Number.isFinite(ends[i]) ? ends[i] : dur;
    if (s0 > 0.2 && e0 < dur - 0.2) gaps.push({ s: s0, e: e0, len: e0 - s0 });
  }
  if (gaps.length < wantCount - 1) return null;

  const byLen = [...gaps].sort((a, b) => b.len - a.len);
  const chosen = byLen.slice(0, wantCount - 1).sort((a, b) => a.s - b.s);
  const shortestChosen = Math.min(...chosen.map((g) => g.len));
  const longestRejected = byLen.length > wantCount - 1 ? byLen[wantCount - 1].len : 0;

  const segs = [];
  let cur = 0;
  for (const g of chosen) {
    segs.push([Math.max(0, cur - 0.08), g.s + 0.16]);
    cur = g.e;
  }
  segs.push([Math.max(0, cur - 0.08), dur]);
  return { segs, margin: shortestChosen - longestRejected, shortestChosen, longestRejected };
}

function reportSplit(label, r) {
  const ambiguous = r.margin !== Infinity && r.margin < 0.18;
  const detail = `끊은 쉼 최소 ${r.shortestChosen.toFixed(2)}s / 안 끊은 쉼 최대 ${r.longestRejected.toFixed(2)}s`;
  console.log(`${label}: ${r.segs.length}개로 분할  (${detail})${ambiguous ? "   경계가 애매합니다 — 아래 길이를 꼭 확인하세요" : ""}`);
}

/** 방송용 톤으로 정리: 럼블 제거 · 노이즈 게이트 · 디에서 · -18 LUFS */
function clean(src, dst, seg) {
  const trim = seg ? ["-ss", seg[0].toFixed(3), "-to", seg[1].toFixed(3)] : [];
  ffmpeg(["-y", ...trim, "-i", src, "-af",
    "highpass=f=85,afftdn=nr=10:nf=-28,deesser=i=0.3,loudnorm=I=-18:TP=-2:LRA=9,aresample=48000",
    "-c:a", "libmp3lame", "-q:a", "2", "-ac", "1", dst]);
}

function main() {
  const have = readdirSync(REC).filter((f) => EXT.includes(path.extname(f).toLowerCase()));
  if (have.length === 0) {
    console.error("\n녹음 파일이 없습니다. audio/rec/ 에 넣어주세요.  자세한 방법은 RECORDING.md\n");
    process.exit(1);
  }

  const allCues = script.scenes.flatMap((s) => s.cues.map((c, i) => ({ scene: s.id, i, ...c })));
  const jobs = [];

  // 1) 문장별 파일이 있으면 무조건 그것부터 쓴다
  const perCueTaken = new Set();
  for (const c of allCues) {
    const f = find(`${c.scene}-${pad(c.i)}`);
    if (f) {
      jobs.push({ out: `${c.scene}-${pad(c.i)}`, src: f });
      perCueTaken.add(`${c.scene}-${pad(c.i)}`);
    }
  }

  // 2) 남은 것을 씬별 파일에서 채운다
  for (const scene of script.scenes) {
    const missing = scene.cues.map((_, i) => `${scene.id}-${pad(i)}`).filter((k) => !perCueTaken.has(k));
    if (missing.length === 0) continue;
    const sceneFile = find(scene.id);
    if (!sceneFile) continue;
    if (missing.length !== scene.cues.length) {
      console.error(`\n${scene.id}: 씬 파일과 문장 파일이 섞여 있습니다. 둘 중 하나로 통일해 주세요.\n`);
      process.exit(1);
    }
    const r = splitBySilence(sceneFile, scene.cues.length);
    if (!r) {
      console.error(`\n${scene.id} 를 ${scene.cues.length}개 문장으로 나누지 못했습니다. 문장 사이를 1초 이상 쉬어주세요.\n`);
      process.exit(1);
    }
    reportSplit(scene.id, r);
    r.segs.forEach((seg, i) => {
      jobs.push({ out: `${scene.id}-${pad(i)}`, src: sceneFile, seg });
      perCueTaken.add(`${scene.id}-${pad(i)}`);
    });
  }

  // 3) 그래도 남으면 통짜 파일에서 채운다
  const stillMissing = allCues.filter((c) => !perCueTaken.has(`${c.scene}-${pad(c.i)}`));
  if (stillMissing.length > 0) {
    const whole = find("all");
    if (!whole) {
      console.error(`\n다음 문장의 녹음이 없습니다:\n  ${stillMissing.map((c) => `${c.scene}-${pad(c.i)}`).join("\n  ")}\n`);
      process.exit(1);
    }
    if (stillMissing.length !== allCues.length) {
      console.error(`\nall.wav 는 전체를 담고 있어야 합니다. 일부만 다시 녹음하려면 문장별 파일로 넣어주세요.\n`);
      process.exit(1);
    }
    const r = splitBySilence(whole, allCues.length);
    if (!r) {
      console.error(`\nall.wav 를 ${allCues.length}개 문장으로 나누지 못했습니다. 문장 사이를 1초 이상 쉬어주세요.\n`);
      process.exit(1);
    }
    reportSplit("all", r);
    allCues.forEach((c, k) => jobs.push({ out: `${c.scene}-${pad(c.i)}`, src: whole, seg: r.segs[k] }));
  }

  for (const f of readdirSync(AUDIO)) {
    if (/^s\d.*\.(mp3|wav|m4a)$/i.test(f)) rmSync(path.join(AUDIO, f));
  }

  console.log("");
  const order = new Map(allCues.map((c, k) => [`${c.scene}-${pad(c.i)}`, k]));
  jobs.sort((a, b) => order.get(a.out) - order.get(b.out));
  for (const j of jobs) {
    const dst = path.join(AUDIO, `${j.out}.mp3`);
    clean(j.src, dst, j.seg);
    const cue = allCues[order.get(j.out)];
    const d = probe(dst);
    const syl = (cue.vo.match(/[가-힣]/g) || []).length;
    const rate = syl / d;
    const warn = d < 1.0 || rate > 9 || rate < 2.4 ? "  <-- 확인" : "";
    console.log(`  ${j.out.padEnd(16)} ${d.toFixed(2).padStart(6)}s  ${rate.toFixed(1)}음절/초  ${cue.sub.slice(0, 34)}${warn}`);
  }

  buildTimeline(root, { source: "recording" });
  console.log("\n'확인' 표시가 붙은 줄은 잘못 잘렸을 수 있습니다.");
  console.log("그 문장만 다시 녹음해서 audio/rec/<이름>.wav 로 넣고 다시 실행하면 그것만 교체됩니다.");
}

main();
