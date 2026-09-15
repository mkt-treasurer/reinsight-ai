/**
 * 영상 길이·씬 구조에 맞춘 배경음악을 직접 합성한다.
 * 외부 음원을 안 쓰므로 저작권·Content ID 위험이 없다.
 *
 *   node scripts/make-bgm.mjs
 *   → bgm/generated-bed.wav
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(path.join(root, "bgm"), { recursive: true });

const SR = 48000;
const timing = JSON.parse(readFileSync(path.join(root, "src/timing.json"), "utf8"));
const TOTAL = timing.total;
const N = Math.ceil(TOTAL * SR);

const BPM = 84;
const BEAT = 60 / BPM;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// i - VI - III - VII (Am), 2마디씩
const PROG = [
  { root: 45, notes: [57, 60, 64, 71] }, // Am add9
  { root: 41, notes: [53, 57, 60, 67] }, // Fmaj7
  { root: 48, notes: [52, 55, 60, 62] }, // Cmaj9
  { root: 43, notes: [55, 59, 62, 69] }, // G
];
const CHORD_LEN = BEAT * 8;

/** 씬별 밀도 — 유보 조건 씬은 눌러주고, 핵심·브랜드 씬은 올린다 */
const INTENSITY = {
  "s1-hook": 0.58, "s2-spread": 0.5, "s3-trial": 0.62, "s4-caveat": 0.38,
  "s5-why": 0.66, "s6-distance": 0.76, "s7-earnings": 0.6,
  "s8-alphalenz": 0.82, "s9-close": 0.6,
};

// 씬 경계에서 튀지 않도록 1.5초 스무딩한 강도 곡선
const intensityAt = (() => {
  const pts = timing.scenes.map((s) => ({
    start: s.from / timing.fps,
    end: (s.from + s.durationInFrames) / timing.fps,
    v: INTENSITY[s.id] ?? 0.6,
  }));
  return (t) => {
    let v = pts[pts.length - 1].v;
    for (const p of pts) if (t >= p.start && t < p.end) { v = p.v; break; }
    // 경계 부드럽게
    for (const p of pts) {
      const d = t - p.start;
      if (d >= -1.5 && d < 1.5) {
        const prev = pts[pts.indexOf(p) - 1];
        if (prev) {
          const k = (d + 1.5) / 3;
          v = prev.v + (p.v - prev.v) * (k * k * (3 - 2 * k));
        }
      }
    }
    return v;
  };
})();

const L = new Float64Array(N);
const R = new Float64Array(N);

// --- 패드: 코드 톤을 살짝 디튠해 쌓고, 코드 전환은 2초 크로스페이드
const CROSS = 2.0;
for (let ci = 0; ci * CHORD_LEN < TOTAL + CHORD_LEN; ci++) {
  const c = PROG[ci % PROG.length];
  const t0 = ci * CHORD_LEN;
  const t1 = t0 + CHORD_LEN;
  const s = Math.max(0, Math.floor((t0 - CROSS) * SR));
  const e = Math.min(N, Math.ceil((t1 + CROSS) * SR));
  for (const [vi, note] of c.notes.entries()) {
    const f = mtof(note);
    const detune = 1 + (vi - 1.5) * 0.0009;
    const pan = (vi - 1.5) / 1.5;            // 보이스를 좌우로 벌려 폭을 만든다
    const phase = vi * 1.7;
    for (let i = s; i < e; i++) {
      const t = i / SR;
      let env = 1;
      if (t < t0) env = Math.max(0, (t - (t0 - CROSS)) / CROSS);
      else if (t > t1 - CROSS) env = Math.max(0, (t1 + CROSS - t) / (CROSS * 2) + 0.5);
      if (t > t1) env = Math.max(0, (t1 + CROSS - t) / CROSS);
      env = env * env * (3 - 2 * env);
      if (env <= 0) continue;
      const vib = 1 + 0.0016 * Math.sin(2 * Math.PI * 0.13 * t + phase);
      const w = 2 * Math.PI * f * detune * vib * t + phase;
      // 기음 + 약한 배음 (너무 순수한 사인은 존재감이 없다)
      const v = Math.sin(w) + 0.24 * Math.sin(2 * w) + 0.08 * Math.sin(3 * w);
      const a = v * env * 0.052 * (0.75 + 0.25 * intensityAt(t));
      L[i] += a * (1 - Math.max(0, pan) * 0.55);
      R[i] += a * (1 + Math.min(0, pan) * 0.55);
    }
  }
}

// --- 서브 베이스: 코드 루트, 아주 느린 숨쉬기
for (let ci = 0; ci * CHORD_LEN < TOTAL + CHORD_LEN; ci++) {
  const c = PROG[ci % PROG.length];
  const f = mtof(c.root - 12);
  const t0 = ci * CHORD_LEN;
  const s = Math.max(0, Math.floor(t0 * SR));
  const e = Math.min(N, Math.ceil((t0 + CHORD_LEN) * SR));
  for (let i = s; i < e; i++) {
    const t = i / SR;
    const local = t - t0;
    const env = Math.min(1, local / 1.2) * Math.min(1, (CHORD_LEN - local) / 1.0);
    if (env <= 0) continue;
    const breathe = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.07 * t);
    const a = Math.sin(2 * Math.PI * f * t) * env * breathe * 0.085 * intensityAt(t);
    L[i] += a; R[i] += a;
  }
}

// --- 플럭: 2박마다 코드 톤 하나, 지수 감쇠. 강도 높은 구간에서만
for (let b = 0; b * BEAT * 2 < TOTAL; b++) {
  const t0 = b * BEAT * 2;
  const inten = intensityAt(t0);
  if (inten < 0.55) continue;
  const c = PROG[Math.floor(t0 / CHORD_LEN) % PROG.length];
  const note = c.notes[(b * 3) % c.notes.length] + 12;
  const f = mtof(note);
  const dur = 2.6;
  const s = Math.floor(t0 * SR);
  const e = Math.min(N, Math.ceil((t0 + dur) * SR));
  const pan = ((b % 4) - 1.5) / 1.5;
  for (let i = s; i < e; i++) {
    const local = (i - s) / SR;
    const env = Math.exp(-local * 2.6) * Math.min(1, local / 0.004);
    const w = 2 * Math.PI * f * (i / SR);
    const a = (Math.sin(w) + 0.3 * Math.sin(2 * w)) * env * 0.034 * (inten - 0.4);
    L[i] += a * (1 - Math.max(0, pan) * 0.5);
    R[i] += a * (1 + Math.min(0, pan) * 0.5);
  }
}

// --- 공기감: 아주 조용한 필터드 노이즈
let nl = 0, nr = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  nl = nl * 0.995 + (Math.random() * 2 - 1) * 0.005;
  nr = nr * 0.995 + (Math.random() * 2 - 1) * 0.005;
  const a = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.031 * t);
  L[i] += nl * 0.55 * a; R[i] += nr * 0.55 * a;
}

// --- 원폴 로우패스: 강도가 낮은 구간일수록 더 어둡게
let lpL = 0, lpR = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const cutoff = 900 + 1500 * intensityAt(t);
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  lpL += k * (L[i] - lpL); L[i] = lpL;
  lpR += k * (R[i] - lpR); R[i] = lpR;
}

// --- 전체 페이드 + 소프트 클립
const fadeIn = 3.0, fadeOut = 4.0;
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let g = 1;
  if (t < fadeIn) g *= (t / fadeIn) ** 1.5;
  if (t > TOTAL - fadeOut) g *= Math.max(0, (TOTAL - t) / fadeOut) ** 1.2;
  L[i] = Math.tanh(L[i] * g * 1.15);
  R[i] = Math.tanh(R[i] * g * 1.15);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0 ? 0.72 / peak : 1;

// --- WAV 16bit stereo
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * norm * 32767))), 44 + i * 4);
  buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * norm * 32767))), 44 + i * 4 + 2);
}
const out = path.join(root, "bgm", "generated-bed.wav");
writeFileSync(out, buf);
console.log(`${out}\n${TOTAL.toFixed(1)}s · ${BPM}BPM · Am add9 - Fmaj7 - Cmaj9 - G · peak ${(peak).toFixed(2)} -> 0.72`);
