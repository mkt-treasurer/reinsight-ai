/**
 * "Core로 본 TSMC 3분기 실적" — ~39s, in the feel of the "Core · check a rumor" LinkedIn film:
 * light stage, the real Core answer page full-frame, a black top bar with a small caption,
 * one continuous camera that zooms into five points, spotlight on the part being discussed,
 * a cursor that clicks a citation open, then a black end card.
 *
 * The answer page is rebuilt natively from Core's actual answer (sharper to zoom than a screenshot).
 * Left out on purpose: the broker/consensus paragraph (licensed data) and "% vs midpoint" (Core's
 * figure used the low end of the range). The position line is stamped DEMO FUND.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Lockup } from "./Lockup";
import { C, SERIF } from "./theme";
import { fadeIn, useEnter, useTyped } from "./ui";

const SANS = "Pretendard, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const INK = "#15171c";
const INK2 = "#3b3f49";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const INDIGO = "#4f46e5";
const INDIGO_SOFT = "#eef0ff";

/* ------------------------------------------------------------------ timeline */

type Seg = { from: number; to: number; cap: string; s: number; cx: number; cy: number; spot?: [number, number, number, number] };
const SEGS: Seg[] = [
  { from: 0, to: 105, cap: "TSMC reported Q3 on Oct 15. One question to Core.", s: 1.0, cx: 740, cy: 480 },
  { from: 105, to: 225, cap: "Answer first. The bottom line is the first sentence.", s: 1.3, cx: 740, cy: 330, spot: [56, 198, 1368, 104] },
  { from: 225, to: 390, cap: "It connects the dots across documents: July's forecast, October's result.", s: 1.3, cx: 740, cy: 850, spot: [56, 736, 1368, 222] },
  { from: 390, to: 540, cap: "It knows your fund, not just the company.", s: 1.3, cx: 740, cy: 575, spot: [56, 490, 1368, 54] },
  { from: 540, to: 690, cap: "It's honest about what it doesn't know.", s: 1.35, cx: 740, cy: 1040, spot: [56, 1092, 1368, 92] },
  { from: 690, to: 900, cap: "Every number is checkable. Click one, see the sentence it came from.", s: 1.3, cx: 740, cy: 1000, spot: [56, 1188, 700, 54] },
  { from: 900, to: 990, cap: "Fast. It worked for 45 seconds.", s: 2.2, cx: 480, cy: 176, spot: [56, 154, 360, 44] },
  { from: 990, to: 1065, cap: "Core. Earnings, read.", s: 0.8, cx: 740, cy: 640 },
  { from: 1065, to: 1170, cap: "", s: 0.8, cx: 740, cy: 640 },
];
export const TSMC_FRAMES = SEGS[SEGS.length - 1].to;
const MOVE = 18; // frames the camera takes to travel at the start of a segment
const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const camera = (frame: number) => {
  const fs: number[] = [];
  const S: number[] = [];
  const X: number[] = [];
  const Y: number[] = [];
  SEGS.forEach((g, i) => {
    const arrive = i === 0 ? 0 : g.from + MOVE;
    fs.push(arrive, g.to);
    S.push(g.s, g.s);
    X.push(g.cx, g.cx);
    Y.push(g.cy, g.cy);
  });
  // de-duplicate equal consecutive frames (seg.to == next.from)
  const f2: number[] = [];
  const s2: number[] = [];
  const x2: number[] = [];
  const y2: number[] = [];
  fs.forEach((f, i) => {
    if (i > 0 && f <= f2[f2.length - 1]) return;
    f2.push(f);
    s2.push(S[i]);
    x2.push(X[i]);
    y2.push(Y[i]);
  });
  return { s: interpolate(frame, f2, s2, ease), cx: interpolate(frame, f2, x2, ease), cy: interpolate(frame, f2, y2, ease) };
};

/* ------------------------------------------------------------------ pieces */

const Cite: React.FC<{ n: number; id?: string }> = ({ n }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 22,
      height: 22,
      padding: "0 5px",
      marginLeft: 4,
      borderRadius: 5,
      background: INDIGO,
      color: "#fff",
      fontFamily: SANS,
      fontSize: 14,
      fontWeight: 700,
      verticalAlign: "2px",
    }}
  >
    {n}
  </span>
);

const Abs: React.FC<{ x: number; y: number; w?: number; children: React.ReactNode; style?: React.CSSProperties; o?: number }> = ({ x, y, w, children, style, o = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, opacity: o, ...style }}>{children}</div>
);

/** A soft spotlight: darkens everything but the box, with a thin indigo edge. */
const Spot: React.FC<{ box: [number, number, number, number]; a: number }> = ({ box: [x, y, w, h], a }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      borderRadius: 10,
      boxShadow: `0 0 0 9999px rgba(20,22,28,${0.42 * a}), 0 0 0 2px rgba(79,70,229,${0.9 * a}), 0 18px 50px rgba(0,0,0,${0.25 * a})`,
      background: `rgba(255,255,255,${0.0})`,
      pointerEvents: "none",
    }}
  />
);

const Cursor: React.FC<{ x: number; y: number; click?: number }> = ({ x, y, click = 0 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
    {click > 0 ? <div style={{ position: "absolute", left: -18, top: -18, width: 36, height: 36, borderRadius: 999, border: `2px solid ${INDIGO}`, opacity: 1 - click, transform: `scale(${0.4 + click * 1.4})` }} /> : null}
    <svg width="26" height="30" viewBox="0 0 26 30" style={{ position: "absolute", left: -2, top: -2, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}>
      <path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </div>
);

/* ------------------------------------------------------------------ the answer page */

const QUESTION = "TSMC reported 3Q26 results on Oct 15. How did the quarter do against its guidance, what is the 4Q26 guide, and what does it mean for our position?";

export const AnswerPage: React.FC<{ frame: number }> = ({ frame }) => {
  const tChars = Math.max(0, Math.floor(((frame - 8) / 30) * 64));
  const typed = { shown: QUESTION.slice(0, tChars), done: tChars >= QUESTION.length, cursor: Math.floor(frame / 8) % 2 === 0 };
  // the answer renders in, top to bottom, from frame 105
  const A = (at: number) => fadeIn(frame, 105 + at, 10);
  const rise = (at: number) => (1 - fadeIn(frame, 105 + at, 12)) * 10;
  const seg5 = frame >= 690;
  // cursor path for the click (segment 6): from the verified bar up to the [3] chip in the revenue row
  const cx = interpolate(frame, [760, 800], [700, 1005], ease);
  const cy = interpolate(frame, [760, 800], [1215, 793], ease);
  const click = interpolate(frame, [806, 822], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const panel = useEnter(818, 16);
  const hl = fadeIn(frame, 840, 10);
  const stamp = useEnter(430, 14);

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1480, height: 1262, background: "#fff", borderRadius: 12, boxShadow: "0 30px 90px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)", fontFamily: SANS, color: INK, overflow: "hidden" }}>
      {/* question pill */}
      <Abs x={190} y={44} w={1100}>
        <div style={{ background: "#111", color: "#fff", borderRadius: 14, padding: "16px 24px", fontSize: 22, lineHeight: "30px", minHeight: 92, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
          {typed.shown}
          {!typed.done ? <span style={{ display: "inline-block", width: 2, height: 22, background: "#fff", marginLeft: 4, verticalAlign: "-4px", opacity: typed.cursor ? 1 : 0.2 }} /> : null}
        </div>
      </Abs>

      {/* worked for */}
      <Abs x={70} y={160} o={A(0)} style={{ transform: `translateY(${rise(0)}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, color: MUTED, height: 34 }}>
          <span style={{ width: 20, height: 20, borderRadius: 999, background: "#16a34a", color: "#fff", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✓</span>
          Worked for 45 s · 9 sources
        </div>
      </Abs>

      {/* headline */}
      <Abs x={70} y={210} w={1340} o={A(10)} style={{ transform: `translateY(${rise(10)}px)` }}>
        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: "40px" }}>
          TSMC beat its 3Q26 guidance and guided 4Q26 sharply higher with margins holding, which supports keeping the long.
        </div>
      </Abs>

      {/* paragraph */}
      <Abs x={70} y={305} w={1340} o={A(20)} style={{ transform: `translateY(${rise(20)}px)` }}>
        <div style={{ fontSize: 24, lineHeight: "36px", color: INK2 }}>
          3Q26 revenue came in above the top of the guided range. Gross margin landed inside its range and operating margin beat its range. The 4Q26 guide implies another strong step up in sales, with the gross margin range unchanged and the operating margin range a little higher
          <Cite n={3} />
          <Cite n={4} />
          <Cite n={5} />. We hold 117,000 shares at NT$2,400.00, worth $8.64M or +3.8% of NAV, with about $1.88M of unrealized gain. It lost $115.5K on the day it was last priced
          <Cite n={2} />.
        </div>
      </Abs>

      {/* tracker line */}
      <Abs x={70} y={500} o={A(32)} style={{ transform: `translateY(${rise(32)}px)` }}>
        <div style={{ fontSize: 19, color: MUTED, height: 34, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: INK, fontWeight: 600 }}>2330.TW</span> guidance tracker · 1 reported, 1 open <span style={{ color: LINE }}>|</span> we're long <b style={{ color: INK }}>$8.6M</b> · 3.8% of NAV · a 10% move ≈ $864.3K
        </div>
      </Abs>
      {/* demo stamp near the position line */}
      <Abs x={1150} y={494} o={Math.min(1, stamp * 1.4)} style={{ transform: `rotate(-6deg) scale(${0.7 + 0.3 * stamp})` }}>
        <div style={{ padding: "5px 10px", border: `2px solid ${C.gold}`, borderRadius: 4, fontFamily: "Consolas, monospace", fontSize: 14, letterSpacing: 3, color: "#8a6d1c", background: "rgba(255,255,255,0.9)" }}>DEMO FUND</div>
      </Abs>

      {/* two cards */}
      <Abs x={70} y={560} o={A(40)} style={{ transform: `translateY(${rise(40)}px)` }}>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ width: 660, height: 150, border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 14, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>Printed above the guided range</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 44, fontWeight: 700 }}>1</span>
              <span style={{ fontSize: 20, color: MUTED }}>of 1</span>
            </div>
            <div style={{ fontSize: 16, color: MUTED, marginTop: 4 }}>$46.72B vs a $44.6–45.8B range</div>
          </div>
          <div style={{ width: 660, height: 150, border: `1px solid ${LINE}`, borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 14, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>4Q26 guide · open</div>
            <div style={{ fontSize: 34, fontWeight: 700, lineHeight: "40px", marginTop: 8 }}>
              US$52.3 billion to US$54.3 billion <Cite n={4} />
            </div>
          </div>
        </div>
      </Abs>

      {/* guided vs printed table: two source numbers from two different reports */}
      <Abs x={70} y={745} w={1340} o={A(52)} style={{ transform: `translateY(${rise(52)}px)` }}>
        <div style={{ fontSize: 14, letterSpacing: 2, color: MUTED, textTransform: "uppercase", height: 26 }}>Guided vs printed · 3Q26</div>
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 1fr 260px", fontSize: 20, borderTop: `1px solid ${LINE}` }}>
          {[
            ["Metric", <span key="h2">Guidance · Jul 16 report <Cite n={5} /></span>, <span key="h3">Actual · Oct 15 release <Cite n={3} /></span>, "Result"],
            ["Revenue", "US$44.6–45.8B", "US$46.72B", <b key="r1" style={{ color: "#15803d" }}>Above the range</b>],
            ["Gross margin", "65–67%", "66.4%", <span key="r2">Inside the range</span>],
            ["Operating margin", "guided range", "printed", <b key="r3" style={{ color: "#15803d" }}>Above the range</b>],
          ].map((row, r) => (
            <React.Fragment key={r}>
              {row.map((cell, c) => (
                <div key={c} style={{ padding: "0 14px", height: 44, display: "flex", alignItems: "center", borderBottom: `1px solid ${LINE}`, color: r === 0 ? MUTED : INK, fontWeight: r === 0 ? 500 : c === 0 ? 600 : 400, background: r === 0 ? "#fafafa" : "transparent" }}>
                  {cell}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </Abs>

      {/* bullets */}
      <Abs x={70} y={975} w={1340} o={A(64)} style={{ transform: `translateY(${rise(64)}px)` }}>
        <div style={{ display: "flex", gap: 14, fontSize: 24, lineHeight: "36px", color: INK2 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: "#f3f4f6", color: MUTED, fontSize: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 4 }}>1</span>
          <div>
            <b style={{ color: INK }}>The beat came from leading-edge mix.</b> 2nm grew from 3% of wafer revenue in 2Q26 to 8% in 3Q26
            <Cite n={6} />
            <Cite n={3} />. Management expects 4Q to be supported by "the steep ramp-up of our 2-nanometer technology"
            <Cite n={3} />.
          </div>
        </div>
      </Abs>
      <Abs x={70} y={1100} w={1340} o={A(74)} style={{ transform: `translateY(${rise(74)}px)` }}>
        <div style={{ display: "flex", gap: 14, fontSize: 24, lineHeight: "36px", color: INK2 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: "#f3f4f6", color: MUTED, fontSize: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 4 }}>2</span>
          <div>
            <b style={{ color: INK }}>What we don't have.</b> The firm has no internal research note on TSMC, so this answer rests on public filings and the book. Whether to add is up to the PM.
          </div>
        </div>
      </Abs>

      {/* verified bar */}
      <Abs x={70} y={1195} o={A(86)} style={{ transform: `translateY(${rise(86)}px)` }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, height: 40, padding: "0 16px", border: `1px solid ${LINE}`, borderRadius: 999, fontSize: 18, color: INK2, background: "#fafafa" }}>
          <span style={{ width: 22, height: 22, borderRadius: 999, background: "#16a34a", color: "#fff", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✓</span>
          <b style={{ color: INK }}>Verified</b> · 9 cited · 2 computed · 9 sources
        </div>
      </Abs>

      {/* source panel, opened by the click */}
      {seg5 ? (
        <Abs x={880} y={975} w={580} o={Math.min(1, panel * 1.4)} style={{ transform: `translateX(${(1 - panel) * 80}px)` }}>
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,0.28)", padding: "18px 22px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: MUTED }}>
              <Cite n={3} /> <span style={{ letterSpacing: 2, textTransform: "uppercase" }}>Public</span> · 3Q26 Earnings Release · investor.tsmc.com
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>TSMC Reports Third Quarter EPS of NT$29.43</div>
            <div style={{ fontSize: 17, lineHeight: "27px", color: INK2, marginTop: 10 }}>
              In US dollars, third quarter revenue was{" "}
              <span style={{ background: `rgba(79,70,229,${0.18 * hl})`, boxShadow: `0 0 0 ${3 * hl}px rgba(79,70,229,${0.18 * hl})`, borderRadius: 3, fontWeight: 700 }}>$46.72 billion</span>
              , which increased 41.2% year-over-year and increased 16.2% from the previous quarter.
            </div>
            <div style={{ marginTop: 12, fontSize: 14, color: MUTED }}>Page 1 · opened from citation 3</div>
          </div>
        </Abs>
      ) : null}

      {/* citation callouts for the table: two different reports */}
      {frame >= 250 && frame < 390 ? (
        <>
          <Callout x={470} y={700} text="July 17 · 3Q26 guidance report" at={252} frame={frame} />
          <Callout x={880} y={700} text="October 15 · 3Q26 results release" at={270} frame={frame} />
        </>
      ) : null}

      {seg5 && frame < 900 ? <Cursor x={cx} y={cy} click={click} /> : null}
    </div>
  );
};

const Callout: React.FC<{ x: number; y: number; text: string; at: number; frame: number }> = ({ x, y, text, at, frame }) => {
  const a = fadeIn(frame, at, 8);
  return (
    <Abs x={x} y={y} o={a} style={{ transform: `translateY(${(1 - a) * 8}px)` }}>
      <div style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: INDIGO, color: "#fff", fontSize: 15, fontWeight: 600, boxShadow: "0 8px 20px rgba(79,70,229,0.35)", whiteSpace: "nowrap" }}>{text}</div>
      <div style={{ width: 2, height: 30, background: INDIGO, marginLeft: 14 }} />
    </Abs>
  );
};

/* ------------------------------------------------------------------ stage */

export const Tsmc: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camera(frame);
  const seg = SEGS.find((g) => frame >= g.from && frame < g.to) ?? SEGS[SEGS.length - 1];
  const segIdx = SEGS.indexOf(seg);
  const spotA = seg.spot ? fadeIn(frame, seg.from + MOVE - 4, 10) * (1 - fadeIn(frame, seg.to - 8, 6)) : 0;
  const capA = fadeIn(frame, seg.from + 2, 8) * (1 - fadeIn(frame, seg.to - 6, 5));
  const endA = fadeIn(frame, 1065, 14);
  const endHead = useEnter(1082, 16);
  const endLock = useEnter(1096, 14);

  return (
    <AbsoluteFill style={{ background: "#e9ebef", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.6), rgba(0,0,0,0) 60%)" }} />

      {/* page under a continuous camera */}
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${960 - cam.cx * cam.s}px, ${572 - cam.cy * cam.s}px) scale(${cam.s})` }}>
        <div style={{ position: "relative", width: 1480, height: 1262 }}>
          <AnswerPage frame={frame} />
          {seg.spot && spotA > 0 ? <Spot box={seg.spot} a={spotA} /> : null}
        </div>
      </div>

      {/* top bar caption */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 64, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: SANS, fontSize: 28, color: "#fff", opacity: capA, letterSpacing: 0.2 }}>{seg.cap}</div>
      </div>
      <div style={{ position: "absolute", right: 28, bottom: 22, fontFamily: "Consolas, monospace", fontSize: 16, letterSpacing: 1, color: "rgba(0,0,0,0.4)" }}>Illustrative · demo fund</div>

      {/* end card */}
      {segIdx >= SEGS.length - 1 || endA > 0 ? (
        <AbsoluteFill style={{ background: "#000", opacity: endA }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", fontFamily: SERIF, fontSize: 120, color: "#fff", opacity: Math.min(1, endHead * 1.3), transform: `translateY(${(1 - endHead) * 16}px)` }}>Ask. It’s done.</div>
          <div style={{ position: "absolute", left: "50%", top: 600, transform: `translateX(-50%) scale(${0.9 + 0.1 * endLock})`, opacity: Math.min(1, endLock * 1.3) }}>
            <Lockup size={60} />
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
