/**
 * src/shots.json 의 검색어대로 Pexels / Pixabay 에서 B-roll 을 받아
 * 1920x1080 · 무음 · h264 로 정규화해 public/media/ 에 넣는다.
 * 출처·라이선스는 public/media/manifest.json 에 기록된다.
 *
 *   node scripts/fetch-media.mjs          # 없는 것만 받음
 *   node scripts/fetch-media.mjs --force  # 전부 다시 받음
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = path.join(root, "public", "media");
const TMP = path.join(root, "out", "media-raw");
mkdirSync(MEDIA, { recursive: true });
mkdirSync(TMP, { recursive: true });

const FORCE = process.argv.includes("--force");

// .env
const env = {};
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const PEXELS = env.PEXELS_API_KEY || process.env.PEXELS_API_KEY;
const PIXABAY = env.PIXABAY_API_KEY || process.env.PIXABAY_API_KEY;

if (!PEXELS && !PIXABAY) {
  console.error(`\nAPI 키가 없습니다. .env 파일을 만들고 키를 넣어주세요:\n`);
  console.error(readFileSync(path.join(root, ".env.example"), "utf8"));
  process.exit(1);
}

const UA = { "User-Agent": "alphalenz-video/1.0" };

function getJSON(url, headers = {}) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { ...UA, ...headers } }, (r) => {
      if (r.statusCode >= 300 && r.headers.location)
        return getJSON(r.headers.location, headers).then(res, rej);
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => {
        try { res(JSON.parse(d)); } catch (e) { rej(new Error(`${r.statusCode}: ${d.slice(0, 160)}`)); }
      });
    }).on("error", rej);
  });
}

function download(url, file) {
  return new Promise((res, rej) => {
    https.get(url, { headers: UA }, (r) => {
      if (r.statusCode >= 300 && r.headers.location)
        return download(r.headers.location, file).then(res, rej);
      if (r.statusCode !== 200) return rej(new Error("HTTP " + r.statusCode));
      const w = createWriteStream(file);
      r.pipe(w);
      w.on("finish", () => w.close(() => res(file)));
      w.on("error", rej);
    }).on("error", rej);
  });
}

async function searchPexels(q) {
  if (!PEXELS) return [];
  const u = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&size=medium`;
  const j = await getJSON(u, { Authorization: PEXELS });
  return (j.videos || []).map((v) => {
    const f = (v.video_files || [])
      .filter((x) => x.width >= 1600 && x.file_type === "video/mp4")
      .sort((a, b) => a.width - b.width)[0];
    return f && {
      provider: "pexels", id: String(v.id), url: f.link, duration: v.duration,
      w: f.width, h: f.height, page: v.url,
      author: v.user?.name || "", authorUrl: v.user?.url || "",
      license: "Pexels License (상업적 사용 가능 · 출처 표기 불필요)",
    };
  }).filter(Boolean);
}

async function searchPixabay(q) {
  if (!PIXABAY) return [];
  const u = `https://pixabay.com/api/videos/?key=${PIXABAY}&q=${encodeURIComponent(q)}&per_page=12&safesearch=true`;
  const j = await getJSON(u);
  return (j.hits || []).map((v) => {
    const f = v.videos?.large?.width >= 1600 ? v.videos.large : v.videos?.medium;
    return f && f.url && {
      provider: "pixabay", id: String(v.id), url: f.url, duration: v.duration,
      w: f.width, h: f.height, page: v.pageURL,
      author: v.user || "", authorUrl: `https://pixabay.com/users/${v.user}-${v.user_id}/`,
      license: "Pixabay Content License (상업적 사용 가능 · 출처 표기 불필요)",
    };
  }).filter(Boolean);
}

const pick = (list, minDur = 6) => {
  const ok = list.filter((c) => c.duration >= minDur);
  return (ok.length ? ok : list).sort((a, b) => Math.abs(a.duration - 12) - Math.abs(b.duration - 12))[0];
};

function normalize(src, dst, seconds) {
  const r = spawnSync("ffmpeg", ["-y", "-i", src, "-t", String(seconds),
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setpts=1.18*PTS,fps=30,format=yuv420p",
    "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-g", "10", "-keyint_min", "10", "-sc_threshold", "0", "-movflags", "+faststart", dst],
    { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr?.slice(-800) || "ffmpeg failed");
}

async function main() {
  const shots = JSON.parse(readFileSync(path.join(root, "src/shots.json"), "utf8"));
  const timing = JSON.parse(readFileSync(path.join(root, "src/timing.json"), "utf8"));
  const sceneDur = Object.fromEntries(timing.scenes.map((s) => [s.id, s.durationInFrames / timing.fps]));

  const manifest = existsSync(path.join(MEDIA, "manifest.json"))
    ? JSON.parse(readFileSync(path.join(MEDIA, "manifest.json"), "utf8"))
    : { clips: {} };

  console.log(`providers: ${[PEXELS && "pexels", PIXABAY && "pixabay"].filter(Boolean).join(", ")}\n`);

  for (const [sceneId, list] of Object.entries(shots.scenes)) {
    const per = (sceneDur[sceneId] || 12) / list.length + 1.2;
    for (const shot of list) {
      const dst = path.join(MEDIA, `${shot.id}.mp4`);
      if (existsSync(dst) && !FORCE) { console.log(`  skip ${shot.id}`); continue; }
      let cands = [];
      for (const q of [shot.q, shot.alt].filter(Boolean)) {
        cands = [...(await searchPexels(q)), ...(await searchPixabay(q))];
        if (cands.length) { shot.usedQuery = q; break; }
      }
      const c = pick(cands, Math.min(per, 10));
      if (!c) { console.log(`  MISS ${shot.id}  "${shot.q}"`); continue; }
      const raw = path.join(TMP, `${shot.id}.mp4`);
      await download(c.url, raw);
      normalize(raw, dst, Math.min(c.duration, Math.max(per, 5)));
      try { unlinkSync(raw); } catch {}
      manifest.clips[shot.id] = {
        scene: sceneId, query: shot.usedQuery, provider: c.provider,
        page: c.page, author: c.author, authorUrl: c.authorUrl, license: c.license,
        seconds: Math.min(c.duration, Math.max(per, 5)),
      };
      console.log(`  ok   ${shot.id.padEnd(6)} ${c.provider.padEnd(8)} ${c.w}x${c.h} ${c.duration}s  ${c.author}`);
    }
  }

  writeFileSync(path.join(MEDIA, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(path.join(root, "src/media.json"), JSON.stringify(manifest, null, 2));
  const lines = Object.entries(manifest.clips).map(([id, m]) =>
    `${id}\t${m.provider}\t${m.author}\t${m.page}\t${m.license}`);
  writeFileSync(path.join(root, "CREDITS.txt"),
    "영상 출처 (라이선스상 표기 의무는 없으나 기록용)\n\n" + lines.join("\n") + "\n");
  console.log(`\n${Object.keys(manifest.clips).length}개 클립 · public/media/ · 출처는 CREDITS.txt`);
}

main().catch((e) => { console.error(e); process.exit(1); });
