/**
 * NCP CLOVA Voice 로 나레이션을 만든다. (클로바더빙은 공개 API 가 없어서 이걸 쓴다)
 *
 *   .env
 *     CLOVA_CLIENT_ID=...
 *     CLOVA_CLIENT_SECRET=...
 *
 *   node scripts/tts-clova.mjs                 # 없는 것만 생성
 *   SPEAKER=njinho node scripts/tts-clova.mjs  # 화자 지정
 *   node scripts/tts-clova.mjs --force         # 전부 다시 생성
 *   node scripts/tts-clova.mjs --probe         # 짧은 문장 하나로 키·화자만 확인
 *
 * 화자는 콘솔의 CLOVA Voice 문서에 있는 목록을 그대로 쓴다.
 * 대화체 대본이라 아나운서형(nara 등)보다 자연스러운 쪽이 어울린다.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTimeline, probe, cueFile } from "./build-timeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO = path.join(root, "audio");
mkdirSync(AUDIO, { recursive: true });

const env = {};
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
const ID = env.CLOVA_CLIENT_ID || process.env.CLOVA_CLIENT_ID;
const SECRET = env.CLOVA_CLIENT_SECRET || process.env.CLOVA_CLIENT_SECRET;

if (!ID || !SECRET) {
  console.error(`
CLOVA Voice 키가 없습니다. .env 에 넣어주세요:

  CLOVA_CLIENT_ID=...
  CLOVA_CLIENT_SECRET=...

발급: console.ncloud.com -> Services -> AI·NAVER API -> CLOVA Voice 이용 신청
      -> AI·NAVER API -> Application 등록 (CLOVA Voice 체크) -> Client ID / Secret
`);
  process.exit(1);
}

const SPEAKER = process.env.SPEAKER || env.CLOVA_SPEAKER || "nara";
const SPEED = process.env.SPEED || "-1";   // -5(빠름) ~ 5(느림), 0 이 기본
const PITCH = process.env.PITCH || "0";
const FORCE = process.argv.includes("--force");
const PROBE_ONLY = process.argv.includes("--probe");

const ENDPOINT = "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts";

function synth(text, file) {
  const body = new URLSearchParams({
    speaker: SPEAKER,
    text,
    format: "mp3",
    speed: String(SPEED),
    pitch: String(PITCH),
    volume: "0",
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      ENDPOINT,
      {
        method: "POST",
        headers: {
          "X-NCP-APIGW-API-KEY-ID": ID,
          "X-NCP-APIGW-API-KEY": SECRET,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}: ${buf.toString("utf8").slice(0, 300)}`));
          }
          writeFileSync(file, buf);
          resolve(buf.length);
        });
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

async function withRetry(text, file) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await synth(text, file);
      if (existsSync(file) && probe(file) > 0.3) return;
      throw new Error("빈 오디오");
    } catch (e) {
      // 인증·잘못된 화자는 재시도해도 같으니 바로 올린다
      if (/HTTP 40[013]/.test(e.message) || attempt === 4) {
        try { if (existsSync(file)) unlinkSync(file); } catch {}
        throw e;
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function main() {
  if (PROBE_ONLY) {
    const f = path.join(root, "out", "clova-probe.mp3");
    mkdirSync(path.dirname(f), { recursive: true });
    await withRetry("알파렌즈 음성 테스트입니다.", f);
    console.log(`OK  speaker=${SPEAKER} speed=${SPEED} -> ${f} (${probe(f).toFixed(2)}s)`);
    return;
  }

  const script = JSON.parse(readFileSync(path.join(root, "src/script.json"), "utf8"));
  let made = 0;
  for (const scene of script.scenes) {
    for (let ci = 0; ci < scene.cues.length; ci++) {
      const existing = cueFile(root, scene.id, ci);
      if (existing && !FORCE) continue;
      const file = path.join(AUDIO, `${scene.id}-${String(ci + 1).padStart(2, "0")}.mp3`);
      process.stdout.write(`clova ${scene.id}-${ci + 1} ... `);
      await withRetry(scene.cues[ci].vo, file);
      console.log(`ok ${probe(file).toFixed(2)}s`);
      made++;
    }
  }
  console.log(`\n${made}개 생성 (speaker=${SPEAKER}, speed=${SPEED})`);
  buildTimeline(root, { source: `clova:${SPEAKER} speed${SPEED}` });
}

main().catch((e) => {
  console.error("\n" + e.message);
  if (/HTTP 401|HTTP 403/.test(e.message)) console.error("→ 키가 틀렸거나 CLOVA Voice 이용 신청이 안 된 상태입니다.");
  if (/HTTP 400/.test(e.message)) console.error(`→ 화자 이름(${SPEAKER})이 목록에 없을 수 있습니다. SPEAKER=... 로 바꿔보세요.`);
  process.exit(1);
});
