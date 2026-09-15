/**
 * 나레이션 없는 버전용 사운드트랙: 음악 + 효과음을 timing.json 에 맞춰 합성한다.
 * 외부 음원을 쓰지 않으므로 저작권·Content ID 위험이 없다.
 *
 *   node scripts/make-score.mjs   -> bgm/score.wav
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
const FPS = timing.fps;

const BPM = 104;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (() => {
  let s = 12345;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
})();

const L = new Float64Array(N);
const R = new Float64Array(N);
const add = (i, l, r) => {
  if (i >= 0 && i < N) {
    L[i] += l;
    R[i] += r;
  }
};

// 씬별 에너지 (0 = 정지, 1 = 풀)
const ENERGY = {
  "s1-hook": 0.45,
  "s2-spread": 0.7,
  "s3-trial": 0.8,
  "s4-caveat": 0.25,
  "s5-why": 0.75,
  "s6-distance": 0.9,
  "s7-earnings": 0.8,
  "s8-alphalenz": 1.0,
  "s9-close": 0.5,
};
const scenes = timing.scenes.map((s) => ({
  id: s.id,
  start: s.from / FPS,
  end: (s.from + s.durationInFrames) / FPS,
  e: ENERGY[s.id] ?? 0.7,
}));
const energyAt = (t) => {
  let cur = scenes[scenes.length - 1];
  for (const s of scenes) {
    if (t >= s.start && t < s.end) {
      cur = s;
      break;
    }
  }
  const i = scenes.indexOf(cur);
  const d = t - cur.start;
  if (i > 0 && d < 1.2) {
    const k = d / 1.2;
    const sm = k * k * (3 - 2 * k);
    return scenes[i - 1].e + (cur.e - scenes[i - 1].e) * sm;
  }
  return cur.e;
};

// 화성: Am - F - C - G, 2마디씩
const PROG = [
  { root: 45, notes: [57, 60, 64, 69] },
  { root: 41, notes: [53, 57, 60, 65] },
  { root: 48, notes: [52, 55, 60, 64] },
  { root: 43, notes: [50, 55, 59, 62] },
];
const chordAt = (t) => PROG[Math.floor(t / (BAR * 2)) % PROG.length];

// ---- 악기 ----
function kick(t0, amp) {
  const s = Math.floor(t0 * SR);
  const len = Math.floor(0.32 * SR);
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const f = 45 + 95 * Math.exp(-x * 42);
    const env = Math.exp(-x * 11) * Math.min(1, x / 0.002);
    const v = Math.sin(2 * Math.PI * f * x) * env * amp;
    add(s + k, v, v);
  }
}

function hat(t0, amp, open) {
  const dur = open ? 0.16 : 0.045;
  const s = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  let hp = 0;
  let prev = 0;
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const n = rnd();
    hp = 0.86 * (hp + n - prev);
    prev = n;
    const env = Math.exp(-x / (dur * 0.32));
    const v = hp * env * amp;
    add(s + k, v * 0.85, v * 1.1);
  }
}

function clap(t0, amp) {
  const s = Math.floor(t0 * SR);
  const len = Math.floor(0.22 * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const n = rnd();
    lp += 0.22 * (n - lp);
    const bp = n - lp;
    let env = Math.exp(-x * 26);
    if (x < 0.02) env *= 0.6 + 0.4 * Math.sin(x * 900);
    const v = bp * env * amp;
    add(s + k, v * 1.05, v * 0.9);
  }
}

function bass(t0, dur, note, amp) {
  const f = mtof(note - 12);
  const s = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const env =
      Math.min(1, x / 0.006) * Math.exp(-x * 2.2) * Math.min(1, (dur - x) / 0.05);
    const w = 2 * Math.PI * f * x;
    const saw =
      Math.sin(w) + 0.5 * Math.sin(2 * w) + 0.28 * Math.sin(3 * w) + 0.15 * Math.sin(4 * w);
    lp += 0.16 * (saw - lp);
    add(s + k, lp * env * amp, lp * env * amp);
  }
}

function pluck(t0, note, amp, pan) {
  const f = mtof(note);
  const s = Math.floor(t0 * SR);
  const len = Math.floor(0.9 * SR);
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const env = Math.exp(-x * 6.5) * Math.min(1, x / 0.003);
    const w = 2 * Math.PI * f * x;
    const v = (Math.sin(w) + 0.35 * Math.sin(2 * w) + 0.12 * Math.sin(3 * w)) * env * amp;
    add(s + k, v * (1 - Math.max(0, pan) * 0.6), v * (1 + Math.min(0, pan) * 0.6));
  }
}

function padSpan(t0, t1, notes, amp) {
  const s = Math.max(0, Math.floor((t0 - 0.6) * SR));
  const e = Math.min(N, Math.ceil((t1 + 0.6) * SR));
  for (const [vi, note] of notes.entries()) {
    const f = mtof(note);
    const pan = (vi - 1.5) / 1.5;
    const ph = vi * 1.9;
    for (let i = s; i < e; i++) {
      const t = i / SR;
      let env = 1;
      if (t < t0) env = (t - (t0 - 0.6)) / 0.6;
      else if (t > t1) env = (t1 + 0.6 - t) / 0.6;
      env = Math.max(0, Math.min(1, env));
      env = env * env * (3 - 2 * env);
      const w = 2 * Math.PI * f * (1 + 0.001 * (vi - 1.5)) * t + ph;
      const v = (Math.sin(w) + 0.2 * Math.sin(2 * w)) * env * amp * energyAt(t);
      add(i, v * (1 - Math.max(0, pan) * 0.5), v * (1 + Math.min(0, pan) * 0.5));
    }
  }
}

// ---- 효과음 ----
function whoosh(t0, amp, dur) {
  const d = dur ?? 0.75;
  const s = Math.floor((t0 - d * 0.55) * SR);
  const len = Math.floor(d * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const p = x / d;
    const cut = 300 + 5200 * Math.sin(Math.PI * p);
    const a = Math.pow(Math.sin(Math.PI * p), 1.6);
    const n = rnd();
    lp += (1 - Math.exp((-2 * Math.PI * cut) / SR)) * (n - lp);
    const v = (n - lp) * a * amp;
    const pan = -1 + 2 * p;
    add(s + k, v * (1 - Math.max(0, pan) * 0.7), v * (1 + Math.min(0, pan) * 0.7));
  }
}

function tick(t0, amp) {
  const s = Math.floor(t0 * SR);
  const len = Math.floor(0.07 * SR);
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const env = Math.exp(-x * 90);
    const v = (Math.sin(2 * Math.PI * 1850 * x) * 0.5 + rnd() * 0.5) * env * amp;
    add(s + k, v, v * 0.95);
  }
}

function riser(t0, dur, amp) {
  const s = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  let lp = 0;
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const p = x / dur;
    const n = rnd();
    const cut = 400 + 6000 * p * p;
    lp += (1 - Math.exp((-2 * Math.PI * cut) / SR)) * (n - lp);
    const tone = Math.sin(2 * Math.PI * (220 + 700 * p * p) * x) * 0.35;
    const v = ((n - lp) * 0.8 + tone) * p * p * amp;
    add(s + k, v, v);
  }
}

function impact(t0, amp) {
  const s = Math.floor(t0 * SR);
  const len = Math.floor(1.6 * SR);
  for (let k = 0; k < len; k++) {
    const x = k / SR;
    const f = 42 + 70 * Math.exp(-x * 20);
    const env = Math.exp(-x * 4.2) * Math.min(1, x / 0.001);
    const boom = Math.sin(2 * Math.PI * f * x) * env;
    const air = rnd() * Math.exp(-x * 16) * 0.22;
    const v = (boom + air) * amp;
    add(s + k, v, v);
  }
}

function chime(t0, notes, amp) {
  notes.forEach((n, i) => {
    const f = mtof(n);
    const s = Math.floor((t0 + i * 0.09) * SR);
    const len = Math.floor(2.4 * SR);
    const pan = i % 2 ? 0.4 : -0.4;
    for (let k = 0; k < len; k++) {
      const x = k / SR;
      const env = Math.exp(-x * 1.9) * Math.min(1, x / 0.004);
      const w = 2 * Math.PI * f * x;
      const v =
        (Math.sin(w) + 0.42 * Math.sin(2.01 * w) + 0.2 * Math.sin(3.02 * w)) * env * amp;
      add(s + k, v * (1 - Math.max(0, pan) * 0.6), v * (1 + Math.min(0, pan) * 0.6));
    }
  });
}

// ---- 패드 ----
for (let c = 0; c * BAR * 2 < TOTAL; c++) {
  const ch = PROG[c % PROG.length];
  padSpan(
    c * BAR * 2,
    (c + 1) * BAR * 2,
    ch.notes.map((n) => n + 12),
    0.03
  );
}

// ---- 드럼 / 베이스 / 아르페지오 ----
const beats = Math.ceil(TOTAL / BEAT);
for (let b = 0; b < beats; b++) {
  const t = b * BEAT;
  const e = energyAt(t);
  const inBar = b % 4;
  const ch = chordAt(t);

  if (e > 0.4) {
    if (inBar === 0 || inBar === 2) kick(t, 0.52 * e);
    if (inBar === 2) clap(t, 0.3 * e);
    if (e > 0.62 && inBar === 3) kick(t + BEAT * 0.5, 0.34 * e);
  }
  if (e > 0.3) {
    hat(t, 0.115 * e, false);
    hat(t + BEAT * 0.5, 0.075 * e, inBar === 3);
  }
  if (e > 0.5) {
    const n = [ch.root, ch.root, ch.root + 7, ch.root][inBar];
    bass(t, BEAT * 0.92, n, 0.26 * e);
    if (e > 0.72) bass(t + BEAT * 0.5, BEAT * 0.42, ch.root, 0.15 * e);
  }
  if (e > 0.55) {
    // 16분 아르페지오 — 이 트랙에서 리듬감을 만드는 층
    for (let s16 = 0; s16 < 4; s16++) {
      if (s16 === 2 && inBar % 2 === 1) continue;
      const idx = (b * 4 + s16) % ch.notes.length;
      const note = ch.notes[idx] + (s16 === 3 ? 24 : 12);
      pluck(t + s16 * BEAT * 0.25, note, 0.062 * (e - 0.35), s16 % 2 ? 0.5 : -0.5);
    }
  }
  if (e > 0.75 && b % 8 === 0) {
    const m = [ch.notes[3] + 12, ch.notes[2] + 12, ch.notes[3] + 12, ch.notes[1] + 24];
    m.forEach((n, i) => pluck(t + i * BEAT * 0.5, n, 0.07 * e, i % 2 ? 0.3 : -0.3));
  }
}

// ---- 효과음 배치 ----
const sfx = [];
timing.scenes.forEach((s, i) => {
  const t = s.from / FPS;
  if (i > 0) {
    whoosh(t, 0.46);
    sfx.push(["whoosh", t]);
  }
  s.cues.forEach((c, ci) => {
    const ct = (s.from + c.fromInScene) / FPS;
    if (i > 0 || ci > 0) {
      tick(ct, 0.13);
      sfx.push(["tick", ct]);
    }
  });
});
riser(0.15, 1.35, 0.4);
sfx.push(["riser", 0.15]);
impact(1.55, 0.72);
sfx.push(["impact", 1.55]);

const s8 = timing.scenes.find((s) => s.id === "s8-alphalenz");
const s9 = timing.scenes.find((s) => s.id === "s9-close");
if (s8) {
  const t = (s8.from + s8.cues[2].fromInScene) / FPS;
  chime(t, [76, 80, 83, 88], 0.2);
  sfx.push(["chime", t]);
}
if (s9) {
  const t = (s9.from + s9.cues[1].fromInScene) / FPS;
  chime(t, [69, 72, 76, 81], 0.26);
  sfx.push(["chime", t]);
}

// ---- 마스터 ----
let lpL = 0;
let lpR = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const cut = 2600 + 4200 * energyAt(t);
  const k = 1 - Math.exp((-2 * Math.PI * cut) / SR);
  lpL += k * (L[i] - lpL);
  L[i] = lpL;
  lpR += k * (R[i] - lpR);
  R[i] = lpR;
}

const fi = 1.2;
const fo = 3.2;
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let g = 1;
  if (t < fi) g *= Math.pow(t / fi, 1.4);
  if (t > TOTAL - fo) g *= Math.pow(Math.max(0, (TOTAL - t) / fo), 1.1);
  L[i] = Math.tanh(L[i] * g * 1.25);
  R[i] = Math.tanh(R[i] * g * 1.25);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0 ? 0.88 / peak : 1;

const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);
const clip = (v) => Math.max(-32767, Math.min(32767, Math.round(v * norm * 32767)));
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(clip(L[i]), 44 + i * 4);
  buf.writeInt16LE(clip(R[i]), 44 + i * 4 + 2);
}

const out = path.join(root, "bgm", "score.wav");
writeFileSync(out, buf);
const count = (k) => sfx.filter((x) => x[0] === k).length;
console.log(out);
console.log(
  `${TOTAL.toFixed(1)}s · ${BPM}BPM · Am-F-C-G · 효과음 ${sfx.length}개 ` +
    `(whoosh ${count("whoosh")} / tick ${count("tick")} / riser ${count("riser")} / impact ${count("impact")} / chime ${count("chime")})`
);
