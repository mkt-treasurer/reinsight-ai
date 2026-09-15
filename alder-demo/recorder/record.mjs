/**
 * Treasurer × Alder 데모 → MP4 자동 녹화
 * ─────────────────────────────────────────────────────────────────────
 * alder-demo/index.html 을 "수정하지 않고" 그대로 실행해 녹화한다.
 *
 *   1) Playwright 로 설치된 Chrome 을 1920×1080 뷰포트로 실행 (headless)
 *   2) 폰트 로딩 완료(= 시작 버튼 활성) 대기
 *   3) CDP Page.startScreencast 로 프레임 + "프레임별 실제 타임스탬프" 수집
 *   4) "데모 시작" 클릭 → 100초 재생 + 마감 프레임 유지분
 *   5) 타임스탬프 그대로 concat 데뮤서에 넘겨 30fps CFR MP4 로 인코딩
 *
 * ※ Playwright 내장 recordVideo 는 25fps 고정으로 쓰면서 못 따라온 프레임을
 *   버려 영상 길이가 짧아진다(재생이 빨라진다). screencast 는 프레임을 버려도
 *   타임스탬프가 남아 원본 100초 타이밍이 정확히 보존된다.
 *
 * 실행: node record.mjs [--headed] [--dur <ms>] [--quality <1-100>] [--ffmpeg <path>]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync, writeSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE     = dirname(fileURLToPath(import.meta.url));
const ROOT     = resolve(HERE, '..', '..');                 // reinsight-ai/
const DEMO     = resolve(ROOT, 'alder-demo', 'index.html');
const OUT_DIR  = resolve(ROOT, 'output');
const RAW_DIR  = resolve(OUT_DIR, '.raw');
const FRM_DIR  = resolve(RAW_DIR, 'frames');
const LIST     = resolve(RAW_DIR, 'frames.txt');
const OUT_MP4  = resolve(OUT_DIR, 'treasurer-demo.mp4');

const argv    = process.argv.slice(2);
const HEADED  = argv.includes('--headed');
const iDur    = argv.indexOf('--dur');
const iQual   = argv.indexOf('--quality');

const DEMO_MS = iDur  >= 0 ? Number(argv[iDur + 1])  : 100_000;  // 데모 전체 길이
const TAIL_MS = iDur  >= 0 ? 800 : 3_000;                        // 마감 프레임 유지분
const QUALITY = iQual >= 0 ? Number(argv[iQual + 1]) : 92;        // screencast JPEG 품질
const FPS     = 30;
const MAX_FRAMES = 8000;                                          // 안전장치

function findFfmpeg() {
  const i = argv.indexOf('--ffmpeg');
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const w = resolve(process.env.LOCALAPPDATA ?? '',
    'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
    'ffmpeg-9.0-full_build/bin/ffmpeg.exe');
  if (existsSync(w)) return w;
  return 'ffmpeg';
}
const FFMPEG  = findFfmpeg();
const FFPROBE = FFMPEG.includes('ffmpeg.exe') ? FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe') : 'ffprobe';

const sh  = (bin, args) => execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const log = (m) => console.log(`[rec] ${m}`);

// ══ 1. 환경 점검 ═══════════════════════════════════════════════════
log('환경 점검');
if (!existsSync(DEMO)) { console.error(`FAIL[point=demo] 데모 파일 없음 → ${DEMO}`); process.exit(1); }
log(`  데모     ${DEMO}`);
try {
  log(`  ffmpeg   ${FFMPEG}`);
  log(`           ${sh(FFMPEG, ['-hide_banner', '-version']).split('\n')[0]}`);
} catch (e) {
  console.error(`FAIL[point=ffmpeg] 실행 불가 → ${FFMPEG}\n${e.message}`); process.exit(1);
}

rmSync(RAW_DIR, { recursive: true, force: true });
mkdirSync(FRM_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

// ══ 2. 녹화 ════════════════════════════════════════════════════════
const t0 = Date.now();
const stamps = [];          // 프레임별 벽시계 타임스탬프(초, epoch)
const clock  = [];          // {w: 벽시계, g: 데모 내부 시간} 표본
let frameNo = 0, dropped = 0, browser;

try {
  log(`Chrome 실행 (headless=${!HEADED}, 뷰포트 1920×1080)`);
  browser = await chromium.launch({
    channel: 'chrome',
    headless: !HEADED,
    args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => log(`  ! 페이지 예외: ${e.message}`));

  log('데모 로드');
  await page.goto(pathToFileURL(DEMO).href, { waitUntil: 'load' });

  log('폰트 로딩 대기 (시작 버튼 활성까지)');
  await page.waitForFunction(
    () => { const b = document.querySelector('#startBtn'); return b && !b.disabled; },
    null, { timeout: 20_000 });

  // 프리젠터 컨트롤만 영상에서 감춘다 (HTML 파일은 건드리지 않고 런타임 주입)
  await page.addStyleTag({ content: '#pres{display:none !important}' });

  // ── CDP screencast 시작 ──
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', (f) => {
    // ack 를 먼저 보내 다음 프레임을 막지 않는다
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    if (frameNo >= MAX_FRAMES) { dropped++; return; }
    const fd = openSync(join(FRM_DIR, `f${String(frameNo).padStart(5, '0')}.jpg`), 'w');
    writeSync(fd, Buffer.from(f.data, 'base64'));
    closeSync(fd);
    stamps.push(f.metadata.timestamp);
    frameNo++;
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg', quality: QUALITY, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1,
  });

  log(`데모 시작 클릭 → 재생 종료까지 녹화 (screencast)`);
  await page.click('#startBtn');
  clock.push({ w: Date.now() / 1000, g: 0 });

  /* 데모는 delta-time 기반이라 머신이 바쁘면 실시간보다 느리게 흐른다.
     그래서 "몇 초 기다린다"가 아니라 데모 내부 시계를 계속 표본화하면서
     실제 종료(Demo.ended)까지 기다린다. 이 표본으로 나중에 프레임의
     타임스탬프를 데모 시간으로 환산해 100초 타이밍을 복원한다. */
  const MAX_WAIT = 420_000;
  const tClick = Date.now();
  let lastLog = 0, ended = false;
  while (Date.now() - tClick < MAX_WAIT) {
    await page.waitForTimeout(250);
    const st = await page.evaluate(() => ({
      act: Demo.act().n, g: Demo.globalT(), ended: Demo.ended,
    })).catch(() => null);
    if (!st) break;
    clock.push({ w: Date.now() / 1000, g: st.g / 1000 });
    const el = Date.now() - tClick;
    if (el - lastLog >= 10_000) {
      lastLog = el;
      log(`  벽시계 ${(el / 1000).toFixed(0)}s · 데모 ${(st.g / 1000).toFixed(0)}s` +
          ` · ACT ${st.act} · 프레임 ${frameNo}`);
    }
    if (st.ended || (iDur >= 0 && st.g >= DEMO_MS)) {   // --dur 은 부분 구간 테스트
      ended = true;
      // 마감 프레임 유지분 확보 후 종료
      await page.waitForTimeout(TAIL_MS);
      clock.push({ w: Date.now() / 1000, g: DEMO_MS / 1000 + TAIL_MS / 1000 });
      break;
    }
  }

  const final = await page.evaluate(() => ({
    act: Demo.act().n, ended: Demo.ended, globalT: Math.round(Demo.globalT() / 1000),
  }));
  const wall = ((Date.now() - tClick) / 1000).toFixed(1);
  log(`재생 종료: ACT ${final.act} · 데모 ${final.globalT}s · 벽시계 ${wall}s · ended=${final.ended}`);
  if (!ended || final.act !== 5) log('  ! 경고: 정상 종료를 확인하지 못했음');

  await cdp.send('Page.stopScreencast').catch(() => {});
  await context.close();
} catch (e) {
  console.error(`FAIL[point=capture] 녹화 실패\n${e.stack || e.message}`);
  if (browser) await browser.close().catch(() => {});
  process.exit(2);
}
await browser.close().catch(() => {});

if (frameNo < 30) { console.error(`FAIL[point=capture] 프레임이 거의 없음 (${frameNo})`); process.exit(3); }

// ── 벽시계 타임스탬프를 "데모 시간"으로 환산 ──────────────────────
// 부하로 데모가 느리게 흘렀어도, 데모 시간축으로 다시 매핑하면
// 결과 영상은 의도한 100초 타이밍을 정확히 갖는다.
function toDemoTime(w) {
  if (clock.length === 0) return w - stamps[0];
  if (w <= clock[0].w) return clock[0].g;
  for (let i = 1; i < clock.length; i++) {
    if (w <= clock[i].w) {
      const a = clock[i - 1], b = clock[i];
      const r = (b.w - a.w) > 1e-6 ? (w - a.w) / (b.w - a.w) : 0;
      return a.g + (b.g - a.g) * r;
    }
  }
  return clock[clock.length - 1].g;
}

const wallSpan = stamps[frameNo - 1] - stamps[0];
const demoT    = stamps.map(toDemoTime);
const demoSpan = demoT[frameNo - 1] - demoT[0];
log(`프레임 ${frameNo}장 · 벽시계 ${wallSpan.toFixed(1)}s → 데모 시간 ${demoSpan.toFixed(1)}s`);
log(`  캡처 ${(frameNo / wallSpan).toFixed(1)} fps → 데모 시간축 환산 ${(frameNo / demoSpan).toFixed(1)} fps`);

/* 마지막 프레임 지속시간으로 전체 길이를 정확히 맞춘다 (마감 화면 유지분).
   정지 화면에서는 Chrome 이 새 프레임을 거의 만들지 않기 때문. */
const target = (DEMO_MS + TAIL_MS) / 1000;
let list = '', acc = 0;
for (let i = 0; i < frameNo; i++) {
  const d = (i < frameNo - 1)
    ? Math.max(0.001, demoT[i + 1] - demoT[i])
    : Math.max(1 / FPS, target - acc);
  acc += d;
  list += `file '${join(FRM_DIR, `f${String(i).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'\n`;
  list += `duration ${d.toFixed(6)}\n`;
}
// concat 데뮤서는 마지막 항목의 duration 을 반영하려면 파일을 한 번 더 적어야 한다
list += `file '${join(FRM_DIR, `f${String(frameNo - 1).padStart(5, '0')}.jpg`).replace(/\\/g, '/')}'\n`;
writeFileSync(LIST, list, 'utf8');

// ══ 3. MP4 인코딩 ══════════════════════════════════════════════════
log(`MP4 인코딩 (H.264 / 30fps CFR / yuv420p / faststart) · 목표 ${target.toFixed(1)}s`);
try {
  sh(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', LIST,
    '-fps_mode', 'cfr', '-r', String(FPS),
    '-vf', `fps=${FPS},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
    '-movflags', '+faststart', '-an', OUT_MP4,
  ]);
} catch (e) {
  console.error(`FAIL[point=encode] MP4 인코딩 실패\n${e.stderr || e.message}`); process.exit(4);
}

// ══ 4. 결과 검증 ═══════════════════════════════════════════════════
if (!existsSync(OUT_MP4)) { console.error('FAIL[point=verify] MP4 미생성'); process.exit(5); }
const size = statSync(OUT_MP4).size;
if (size < 200_000) { console.error(`FAIL[point=verify] MP4 크기 비정상 (${size} bytes)`); process.exit(6); }

let dur = 0, probe = '';
try {
  probe = sh(FFPROBE, ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
    '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1', OUT_MP4]).trim();
  dur = Number(/duration=([\d.]+)/.exec(probe)?.[1] ?? 0);
} catch { probe = '(ffprobe 생략)'; }

const expect = target;
const drift  = dur - expect;
log(`길이 검증: 기대 ${expect.toFixed(1)}s / 실제 ${dur.toFixed(2)}s (오차 ${drift >= 0 ? '+' : ''}${drift.toFixed(2)}s)`);
const ok = Math.abs(drift) <= 1.5;

// 프레임 임시 파일 정리
rmSync(FRM_DIR, { recursive: true, force: true });
rmSync(LIST, { force: true });

console.log('\n════════════════════════════════════════════════');
console.log(ok ? ' MP4 생성 완료' : ' MP4 생성됨 (길이 오차 확인 필요)');
console.log(`  경로   ${OUT_MP4}`);
console.log(`  크기   ${(size / 1048576).toFixed(2)} MB (${size.toLocaleString()} bytes)`);
console.log(`  길이   ${dur.toFixed(2)}s  (데모 100s + 마감 ${TAIL_MS / 1000}s)`);
console.log(`  소요   ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log('  ─ ffprobe ─');
console.log(probe.split('\n').map((l) => '  ' + l).join('\n'));
console.log('════════════════════════════════════════════════');
if (!ok) process.exit(7);
