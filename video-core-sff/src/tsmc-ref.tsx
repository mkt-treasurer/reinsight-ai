/**
 * "Core로 본 TSMC 3분기 실적" — the v4 story (same 12 scenes, same copy, same effects) restyled
 * after the "SK hynix rumor check" film: near-black navy stage, Core's page inside a browser window,
 * the page dims while a white card pops out with a "| label", captions bottom-centre in serif,
 * a tiny gold mono kicker, an orange-gold stamp, and the same outro: dust → CORE sphere wordmark →
 * TREASURER. → black.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { MONO, SERIF } from "./theme";
import { TRANSITION_FRAMES, TransitionKind } from "./timeline";
import { presentationFor } from "./transitions";
import { AnswerPage } from "./tsmc";
import { CaptionTiming, Card3D, clamp01, fadeIn, useCount, useEnter, useTyped } from "./ui";

const FPS = 30;
const SANS = "Pretendard, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const QUESTION = "TSMC reported 3Q26 results on Oct 15. How did the quarter do against its guidance, what is the 4Q26 guide, and what does it mean for our position?";

/* reference palette */
const BG = "#07090d";
const CREAM = "#efede6";
const MUTED = "#8ea0bd";
const GREEN = "#22c55e";
const GOLD = "#d4a24a"; // kept for reference only; no longer used on screen
const INK = "#15171c";
const INK2 = "#3b3f49";
const GREY = "#6b6f7a";
const LINE = "#e5e7eb";
const INDIGO = "#4f46e5";

/* ------------------------------------------------------------------ stage pieces */

const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, rgba(40,60,110,0.18), rgba(0,0,0,0) 60%)" }} />
    {children}
  </AbsoluteFill>
);

/** Core's answer page inside a browser window; `dim` darkens it while a card pops out. */
const Browser: React.FC<{ pageFrame: number; dim?: number }> = ({ pageFrame, dim = 0 }) => (
  <div style={{ position: "absolute", left: 215, top: 108, width: 1490, height: 880, borderRadius: 14, overflow: "hidden", background: "#1b1d22", boxShadow: "0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)" }}>
    <div style={{ height: 42, background: "#2a2c33", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span key={c} style={{ width: 11, height: 11, borderRadius: 999, background: c }} />
      ))}
      <span style={{ width: 24 }} />
      <span style={{ fontFamily: SANS, fontSize: 13, color: "#c6c9d2", background: "#1b1d22", borderRadius: 7, padding: "5px 14px", width: 420 }}>force.treasurer.net/#/en/ask</span>
    </div>
    <div style={{ position: "absolute", left: 5, top: 50, width: 1480, height: 830, overflow: "hidden" }}>
      <div style={{ transform: "scale(0.99)", transformOrigin: "0 0" }}>
        <AnswerPage frame={pageFrame} />
      </div>
    </div>
    <div style={{ position: "absolute", inset: 0, background: `rgba(10,12,16,${dim})` }} />
  </div>
);

/** "| Label" above a popped-out card, as in the reference. */
const PopLabel: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const e = useEnter(delay, 16);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, opacity: clamp01(e * 1.4), transform: `translateX(${(1 - e) * -10}px)` }}>
      <span style={{ width: 3, height: 26, background: CREAM, borderRadius: 2 }} />
      <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>{text}</span>
    </div>
  );
};

/** Caption at the bottom, serif, with an optional tiny gold kicker above it. */
const Caption: React.FC<{ text: string; tag?: string; timing: CaptionTiming }> = ({ text, tag, timing }) => {
  const frame = useCurrentFrame();
  const a = fadeIn(frame, timing.enter, timing.inLen ?? 9) * (1 - fadeIn(frame, timing.exitAt, timing.outLen ?? 6));
  return (
    <div style={{ position: "absolute", left: 160, right: 160, top: 34, textAlign: "center", opacity: a }}>
      <div style={{ fontFamily: SERIF, fontSize: 34, color: CREAM, lineHeight: 1.2 }}>{text}</div>
    </div>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 4, color: GREY, textTransform: "uppercase" }}>{children}</div>
);

const Cite: React.FC<{ n: number }> = ({ n }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 24, padding: "0 6px", marginLeft: 6, borderRadius: 5, background: INDIGO, color: "#fff", fontFamily: SANS, fontSize: 15, fontWeight: 700, verticalAlign: "2px" }}>{n}</span>
);

const Cursor: React.FC<{ x: number; y: number; click?: number }> = ({ x, y, click = 0 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, zIndex: 5 }}>
    {click > 0 ? <div style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: 999, border: `2.5px solid ${CREAM}`, opacity: 1 - click, transform: `scale(${0.4 + click * 1.4})` }} /> : null}
    <svg width="30" height="34" viewBox="0 0 26 30" style={{ position: "absolute", left: -2, top: -2, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))" }}>
      <path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </div>
);

/** Card wrapper in the reference's look: white, soft shadow, no gold glow. */
const Pop: React.FC<{ delay: number; width: number; children: React.ReactNode; style?: React.CSSProperties; tiltY?: number }> = ({ delay, width, children, style, tiltY = -6 }) => (
  <Card3D delay={delay} width={width} tiltY={tiltY} style={{ boxShadow: "0 40px 120px rgba(0,0,0,0.7)", ...style }}>
    {children}
  </Card3D>
);

/** The press release as a document card (scenes 1 and 11). */
const Release: React.FC<{ delay: number; stamp?: number }> = ({ delay, stamp = 0 }) => {
  const e = useEnter(delay, 15);
  return (
    <div style={{ position: "relative", width: 1040, opacity: clamp01(e * 1.4), transform: `perspective(1800px) rotateX(${(1 - e) * 16}deg) translateY(${(1 - e) * 60}px)`, transformOrigin: "50% 80%" }}>
      <div style={{ padding: "44px 52px 40px", background: "#f6f5f1", color: INK, borderRadius: 14, boxShadow: "0 40px 120px rgba(0,0,0,0.75)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 4, color: GREY, textTransform: "uppercase" }}>Press release · investor.tsmc.com</div>
          <div style={{ fontFamily: SANS, fontSize: 18, color: GREY }}>October 15, 2026</div>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 48, marginTop: 18, lineHeight: 1.15 }}>TSMC Reports Third Quarter EPS of NT$29.43</div>
        <div style={{ height: 1, background: "#d8dae0", margin: "26px 0 18px" }} />
        <div style={{ fontFamily: SANS, fontSize: 21, color: "#4a4e58", lineHeight: 1.5 }}>
          Hsinchu, Taiwan, R.O.C. – TSMC today announced consolidated revenue of US$46.72 billion, up 16.2% from the previous quarter and 41.2% from a year earlier, for the third quarter ended September 30, 2026 …
        </div>
      </div>
      {stamp > 0 ? (
        <div style={{ position: "absolute", right: 40, top: 150, transform: `rotate(-11deg) scale(${interpolate(stamp, [0, 1], [2.2, 1])})`, opacity: clamp01(stamp * 2), transformOrigin: "50% 50%" }}>
          <div style={{ padding: "12px 24px", border: `4px solid ${GREEN}`, borderRadius: 8, color: "#15803d", fontFamily: MONO, fontWeight: 700, fontSize: 60, letterSpacing: 6, lineHeight: 1, background: "rgba(246,245,241,0.85)" }}>BEAT ✓</div>
          <div style={{ marginTop: 10, textAlign: "center", fontFamily: MONO, fontSize: 17, letterSpacing: 4, color: "#15803d", background: "rgba(246,245,241,0.92)", padding: "4px 10px", borderRadius: 4 }}>READ BY CORE IN 45 S</div>
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ scenes (same content and effects as v4) */

type S = { id: string; dur: number; in?: TransitionKind; tag?: string; caption?: string; body: React.FC<{ t: CaptionTiming }> };

/** 1 · THE NEWS */
const News: React.FC<{ t: CaptionTiming }> = ({ t }) => (
  <Stage>
    <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center" }}>
      <Release delay={t.enter + 4} />
    </div>
  </Stage>
);

/** 2 · pages stacking up */
const Pages: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const n = 10;
  const count = Math.min(n, Math.max(0, Math.floor((frame - t.enter - 6) / 4) + 1));
  return (
    <Stage>
      {Array.from({ length: n }).map((_, i) => {
        const at = t.enter + 6 + i * 4;
        const e = fadeIn(frame, at, 6);
        const rot = ((i * 37) % 11) - 5;
        const dx = ((i * 53) % 90) - 45;
        return (
          <div key={i} style={{ position: "absolute", left: 640 + dx, top: 300 + i * 22, width: 640, height: 460, background: "#f6f5f1", borderRadius: 8, boxShadow: "0 30px 70px rgba(0,0,0,0.6)", opacity: e, transform: `translateY(${(1 - e) * -240}px) rotate(${rot}deg)`, padding: "26px 30px", color: "#4a4e58", fontFamily: SANS, fontSize: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, color: "#8a8f9a" }}>3Q26 EARNINGS RELEASE · PAGE {i + 1}</div>
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <div key={r} style={{ height: 10, background: "#dcdee3", borderRadius: 5, marginTop: 16, width: `${60 + ((r * 29 + i * 7) % 40)}%` }} />
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 24 }}>
              {[0, 1, 2, 3, 4, 5].map((c) => (
                <div key={c} style={{ height: 14, background: "#e6e8ee", borderRadius: 4 }} />
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", right: 150, top: 340, textAlign: "right" }}>
        <div style={{ fontFamily: SERIF, fontSize: 180, lineHeight: 1, color: CREAM }}>{count}</div>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 6, color: MUTED }}>PAGES</div>
      </div>
    </Stage>
  );
};

/** 3 · THE ASK — typed into the real page, sharp */
const Ask: React.FC<{ t: CaptionTiming }> = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <Browser pageFrame={frame} />
    </Stage>
  );
};

/** 4 · Core at work */
const STEPS: [string, string][] = [
  ["The release", "TSMC 3Q26 results · Oct 15"],
  ["Last quarter's forecast", "3Q26 guidance · Jul 17"],
  ["Your book", "TSMC position · demo fund"],
];
const Working: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const secs = Math.round(interpolate(frame, [t.enter + 6, t.enter + 70], [0, 45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const sources = useCount(9, t.enter + 30, (v) => `${Math.round(v)}`);
  const bar = interpolate(frame, [t.enter + 6, t.enter + 74], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Stage>
      <Browser pageFrame={100} dim={0.62} />
      <div style={{ position: "absolute", left: 410, top: 330, width: 1100 }}>
        <PopLabel text="Core is working" delay={t.enter + 2} />
        <Pop delay={t.enter + 2} width={1100} style={{ padding: "26px 34px 28px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <Label>Reading</Label>
            <span style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 2, color: INK2 }}>
              Worked for <b style={{ color: INK }}>{secs} s</b> · <b style={{ color: INK }}>{sources}</b> sources
            </span>
          </div>
          <div style={{ height: 6, background: "#eceef3", borderRadius: 99, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ width: `${bar}%`, height: "100%", background: INDIGO }} />
          </div>
          {STEPS.map(([k, v], i) => {
            const at = t.enter + 12 + i * 18;
            const e = useEnter(at, 16);
            const done = frame > at + 16;
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 18, padding: "10px 0", opacity: clamp01(e * 1.4), transform: `translateX(${(1 - e) * -16}px)` }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, border: `1.5px solid ${INDIGO}`, background: done ? INDIGO : "transparent", color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS }}>{done ? "✓" : ""}</span>
                <span style={{ fontFamily: SANS, fontSize: 28, color: INK, width: 420 }}>{k}</span>
                <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 2, color: GREY }}>{v}</span>
              </div>
            );
          })}
        </Pop>
      </div>
    </Stage>
  );
};

/** 5 · THE ANSWER */
const Verdict: React.FC<{ t: CaptionTiming }> = ({ t }) => (
  <Stage>
    <Browser pageFrame={100000} dim={0.62} />
    <div style={{ position: "absolute", left: 340, top: 350, width: 1240 }}>
      <PopLabel text="The verdict" delay={t.enter + 2} />
      <Pop delay={t.enter + 2} width={1240} style={{ padding: "30px 40px 30px" }}>
        <Label>Core · first sentence of the answer</Label>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: 1.25, color: INK, marginTop: 12 }}>
          TSMC beat its 3Q26 guidance and guided 4Q26 sharply higher with margins holding, which supports keeping the long.
        </div>
      </Pop>
    </div>
  </Stage>
);

/** 6 · revenue vs forecast */
const Revenue: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const actual = useCount(46.72, t.enter + 18, (v) => `$${v.toFixed(2)}B`);
  const dot = useEnter(t.enter + 30, 14);
  const px = (v: number) => ((v - 43) / 5) * 100;
  return (
    <Stage>
      <Browser pageFrame={100000} dim={0.62} />
      <div style={{ position: "absolute", left: 355, top: 340, width: 1210 }}>
        <PopLabel text="Revenue vs forecast" delay={t.enter + 2} />
        <div style={{ display: "flex", gap: 26 }}>
          <Pop delay={t.enter + 2} width={560} style={{ padding: "28px 34px 26px" }}>
            <Label>Forecast · Jul 17</Label>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 58, color: INK2, marginTop: 8, lineHeight: 1.05 }}>$44.6–45.8B</div>
            <div style={{ position: "relative", height: 40, marginTop: 20 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 14, height: 8, background: "#eceef3", borderRadius: 99 }} />
              <div style={{ position: "absolute", left: `${px(44.6)}%`, width: `${px(45.8) - px(44.6)}%`, top: 8, height: 20, background: "#c9ccd6", borderRadius: 6 }} />
            </div>
          </Pop>
          <Pop delay={t.enter + 12} width={624} tiltY={6} style={{ padding: "28px 34px 26px" }}>
            <Label>Actual · Oct 15</Label>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 80, color: INK, marginTop: 8, lineHeight: 1.05 }}>{actual}</div>
            <div style={{ position: "relative", height: 40, marginTop: 8 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 14, height: 8, background: "#eceef3", borderRadius: 99 }} />
              <div style={{ position: "absolute", left: `${px(44.6)}%`, width: `${px(45.8) - px(44.6)}%`, top: 8, height: 20, background: "#c9ccd6", borderRadius: 6 }} />
              <div style={{ position: "absolute", left: `${px(46.72)}%`, top: 18, width: 24, height: 24, borderRadius: 999, background: "#15803d", transform: `translate(-50%, -50%) scale(${dot})` }} />
            </div>
            <div style={{ fontFamily: SANS, fontSize: 20, color: "#15803d", fontWeight: 600, marginTop: 2, opacity: clamp01(dot * 1.4) }}>above the top of the range</div>
          </Pop>
        </div>
      </div>
    </Stage>
  );
};

/** 7 · next quarter's guide */
const Guide: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const lo = useCount(52.3, t.enter + 16, (v) => v.toFixed(1));
  const hi = useCount(54.3, t.enter + 22, (v) => v.toFixed(1));
  const arrow = useEnter(t.enter + 28, 14);
  return (
    <Stage>
      <Browser pageFrame={100000} dim={0.62} />
      <div style={{ position: "absolute", left: 345, top: 350, width: 1230 }}>
        <PopLabel text="Next quarter" delay={t.enter + 2} />
        <div style={{ display: "flex", gap: 26, alignItems: "stretch" }}>
          <Pop delay={t.enter + 2} width={450} style={{ padding: "28px 34px" }}>
            <Label>This quarter · 3Q26</Label>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, marginTop: 10, color: INK2 }}>$46.72B</div>
          </Pop>
          <div style={{ display: "flex", alignItems: "center", fontFamily: SANS, fontSize: 64, color: CREAM, opacity: clamp01(arrow * 1.4), transform: `translateX(${(arrow - 1) * 20}px)` }}>→</div>
          <Pop delay={t.enter + 10} width={660} tiltY={6} style={{ padding: "28px 36px" }}>
            <Label>Next quarter · 4Q26 guide</Label>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 80, marginTop: 8, color: INK, lineHeight: 1.05 }}>${lo}–{hi}B</div>
          </Pop>
        </div>
      </div>
    </Stage>
  );
};

/** 8 · 2nm share */
const N2: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const a = useCount(3, t.enter + 12, (v) => `${Math.round(v)}%`);
  const b = useCount(8, t.enter + 26, (v) => `${Math.round(v)}%`);
  const ba = useEnter(t.enter + 12, 20);
  const bb = useEnter(t.enter + 26, 20);
  const Col: React.FC<{ label: string; v: string; h: number; hi?: boolean }> = ({ label, v, h, hi }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 220 }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 58, color: hi ? INK : INK2 }}>{v}</div>
      <div style={{ width: 120, height: 190, display: "flex", alignItems: "flex-end" }}>
        <div style={{ width: "100%", height: `${h}%`, background: hi ? INDIGO : "#c9ccd6", borderRadius: 8 }} />
      </div>
      <Label>{label}</Label>
    </div>
  );
  return (
    <Stage>
      <Browser pageFrame={100000} dim={0.62} />
      <div style={{ position: "absolute", left: 510, top: 330, width: 900 }}>
        <PopLabel text="The reason" delay={t.enter + 2} />
        <Pop delay={t.enter + 2} width={900} style={{ padding: "26px 40px 24px" }}>
          <Label>2nm share of wafer revenue</Label>
          <div style={{ display: "flex", justifyContent: "center", gap: 120, marginTop: 6 }}>
            <Col label="2Q26" v={a} h={(3 / 8) * 100 * ba} />
            <Col label="3Q26" v={b} h={100 * bb} hi />
          </div>
        </Pop>
      </div>
    </Stage>
  );
};

/** 9 · FOR YOUR FUND */
const Fund: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const pos = useCount(8.6, t.enter + 14, (v) => `$${v.toFixed(1)}M`);
  const nav = useCount(3.8, t.enter + 20, (v) => `${v.toFixed(1)}%`);
  const move = useCount(864, t.enter + 26, (v) => `$${Math.round(v)}K`);
  return (
    <Stage>
      <Browser pageFrame={100000} dim={0.62} />
      <div style={{ position: "absolute", left: 370, top: 350, width: 1180 }}>
        <PopLabel text="Your position" delay={t.enter + 2} />
        <Pop delay={t.enter + 2} width={1180} style={{ padding: "30px 38px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label>Your position · TSMC (2330.TW)</Label>
            <span style={{ padding: "5px 11px", border: `1.5px solid ${GREY}`, borderRadius: 4, fontFamily: MONO, fontSize: 13, letterSpacing: 4, color: GREY }}>DEMO FUND</span>
          </div>
          <div style={{ display: "flex", gap: 70, marginTop: 14 }}>
            {[
              ["we're long", pos],
              ["of NAV", nav],
              ["per 10% move", move],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 74, color: INK, lineHeight: 1.05 }}>{v}</div>
                <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: GREY, textTransform: "uppercase", marginTop: 6 }}>{k}</div>
              </div>
            ))}
          </div>
        </Pop>
      </div>
    </Stage>
  );
};

/** 10 · THE PROOF — sharp: cursor clicks a citation, the source sentence opens */
const Proof: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const ease = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const cx = interpolate(frame, [t.enter + 20, t.enter + 44], [1420, 1084], ease);
  const cy = interpolate(frame, [t.enter + 20, t.enter + 44], [820, 392], ease);
  const click = interpolate(frame, [t.enter + 48, t.enter + 62], [0, 1], ease);
  const panel = useEnter(t.enter + 56, 15);
  const hl = fadeIn(frame, t.enter + 72, 10);
  return (
    <Stage>
      <Browser pageFrame={100000} dim={0.62} />
      <div style={{ position: "absolute", left: 340, top: 330, width: 1240 }}>
        <Pop delay={t.enter + 2} width={1240} tiltY={0} style={{ padding: "28px 40px 24px" }}>
          <Label>Guided vs printed · 3Q26</Label>
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 1fr 250px", fontFamily: SANS, fontSize: 23, marginTop: 12, borderTop: `1px solid ${LINE}` }}>
            {[["Metric", <span key="a">Guidance <Cite n={5} /></span>, <span key="b">Actual <Cite n={3} /></span>, "Result"], ["Revenue", "US$44.6–45.8B", "US$46.72B", "Above the range"], ["Gross margin", "guided range", "66.4%", "Inside the range"]].map((row, r) => (
              <React.Fragment key={r}>
                {row.map((cell, c) => (
                  <div key={c} style={{ padding: "0 14px", height: 50, display: "flex", alignItems: "center", borderBottom: `1px solid ${LINE}`, color: r === 0 ? GREY : c === 3 && String(cell).startsWith("Above") ? "#15803d" : INK, fontWeight: r === 0 ? 500 : c === 0 || (c === 3 && String(cell).startsWith("Above")) ? 700 : 400, background: r === 0 ? "#fafafa" : "transparent" }}>
                    {cell}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: 340, top: 590, width: 1240, opacity: clamp01(panel * 1.4), transform: `translateY(${(1 - panel) * 40}px)` }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "22px 30px 24px", boxShadow: "0 40px 120px rgba(0,0,0,0.7)", display: "flex", gap: 22 }}>
          <div style={{ width: 4, background: INDIGO, borderRadius: 2, flexShrink: 0 }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY, textTransform: "uppercase" }}>
              <Cite n={3} /> Public · 3Q26 earnings release · investor.tsmc.com · page 1
            </div>
            <div style={{ fontFamily: SANS, fontSize: 26, lineHeight: 1.4, color: INK2, marginTop: 10 }}>
              TSMC today announced consolidated revenue of{" "}
              <span style={{ background: `rgba(79,70,229,${0.18 * hl})`, borderRadius: 3, padding: "0 3px" }}>US$46.72 billion, up 16.2% from the previous quarter and 41.2% from a year earlier</span>, for the third quarter ended September 30, 2026.
            </div>
          </div>
        </div>
      </div>
      {frame >= t.enter + 16 ? <Cursor x={cx} y={cy} click={click} /> : null}
    </Stage>
  );
};

/** 11 · payoff: the release again, stamped */
const Payoff: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const stamp = useEnter(t.enter + 22, 22);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center" }}>
        <Release delay={t.enter} stamp={stamp} />
      </div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ 12 · outro, as in the reference */

const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** CORE with the sphere O, and TREASURER. below. */
const SphereWordmark: React.FC<{ size?: number }> = ({ size = 190 }) => {
  const letter: React.CSSProperties = { fontFamily: SANS, fontWeight: 500, fontSize: size * 1.38, lineHeight: 1, color: CREAM, letterSpacing: size * 0.36 };
  const d = size * 1.0;
  return (
    <div style={{ display: "flex", alignItems: "center", paddingLeft: size * 0.36 }}>
      <span style={letter}>C</span>
      <span style={{ position: "relative", width: d, height: d, marginRight: size * 0.36, display: "inline-block", borderRadius: 999, overflow: "hidden", background: CREAM }}>
        {/* grey inner rim */}
        <span style={{ position: "absolute", inset: d * 0.1, borderRadius: 999, background: "#9aa0ab" }} />
        {/* the dark globe with dots */}
        <span style={{ position: "absolute", inset: d * 0.17, borderRadius: 999, background: "radial-gradient(circle at 40% 35%, #2a3658 0%, #141c33 45%, #0b1020 100%)" }} />
        <span style={{ position: "absolute", inset: d * 0.17, borderRadius: 999, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.75) 1.4px, transparent 2px)", backgroundSize: `${d * 0.12}px ${d * 0.12}px`, opacity: 0.8 }} />
        {/* cream crescent closing the lower-left, with a grey edge */}
        <span style={{ position: "absolute", left: -d * 0.58, top: d * 0.32, width: d * 1.06, height: d * 1.06, borderRadius: 999, background: "#9aa0ab" }} />
        <span style={{ position: "absolute", left: -d * 0.55, top: d * 0.35, width: d, height: d, borderRadius: 999, background: CREAM }} />
      </span>
      <span style={letter}>R</span>
      <span style={{ ...letter, letterSpacing: 0 }}>E</span>
    </div>
  );
};

const End: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const f = frame - t.enter;
  const dust = fadeIn(f, 0, 12) * (1 - fadeIn(f, 44, 14));
  const mark = fadeIn(f, 40, 16);
  const scale = interpolate(mark, [0, 1], [0.94, 1]);
  const treas = fadeIn(f, 62, 12);
  const out = 1 - fadeIn(f, 118, 10);
  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 46%, rgba(50,80,150,0.22), rgba(0,0,0,0) 55%)", opacity: mark }} />
      {Array.from({ length: 160 }).map((_, i) => {
        const ox = rnd(i, 1) * 1920;
        const oy = rnd(i, 2) * 1080;
        const g = fadeIn(f, 10, 40); // gather toward the centre
        const x = ox + (960 - ox) * g * 0.85;
        const y = oy + (520 - oy) * g * 0.85;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: 2, height: 2, borderRadius: 999, background: "#dfe6f5", opacity: dust * (0.3 + 0.7 * rnd(i, 3)) }} />;
      })}
      {/* the reference film's own end card, full-res frame (public/core-endcard.png) */}
      <Img src={staticFile("core-endcard.png")} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, opacity: mark * out, transform: `scale(${scale})`, filter: `blur(${(1 - mark) * 8}px)` }} />
      {treas < 0 ? null : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ cut (same scenes, same durations as v4) */

export const REF_SCENES: S[] = [
  { id: "news", dur: 3.2, caption: "TSMC just reported earnings.", body: News },
  { id: "pages", dur: 3.2, in: "slide", caption: "Ten pages of numbers. Your PM wants one answer.", body: Pages },
  { id: "ask", dur: 3.6, in: "fade", caption: "Ask Core.", body: Ask },
  { id: "working", dur: 3.4, in: "fade", caption: "It reads the release, last quarter's forecast, and your book.", body: Working },
  { id: "verdict", dur: 3.4, in: "fade", caption: "The verdict comes first.", body: Verdict },
  { id: "revenue", dur: 3.4, in: "slide", caption: "Revenue beat the top of its own forecast.", body: Revenue },
  { id: "guide", dur: 3.0, in: "wipe", caption: "And it expects even more next quarter.", body: Guide },
  { id: "n2", dur: 3.0, in: "slide", caption: "The reason: its newest 2nm chips.", body: N2 },
  { id: "fund", dur: 3.2, in: "slideup", caption: "What it means for your position.", body: Fund },
  { id: "proof", dur: 4.2, in: "fade", caption: "Every number, one click from the source.", body: Proof },
  { id: "payoff", dur: 3.4, in: "fade", caption: "Core. Earnings, read.", body: Payoff },
  { id: "end", dur: 4.6, in: "fade", body: End },
];

const frames = (s: S) => Math.round(s.dur * FPS);
const trIn = (s: S) => (s.in ? TRANSITION_FRAMES[s.in] : 0);
export const REF_FRAMES = REF_SCENES.reduce((a, s, i) => a + frames(s) - (i > 0 ? trIn(s) : 0), 0);

const timingFor = (i: number): CaptionTiming => {
  const s = REF_SCENES[i];
  const next = REF_SCENES[i + 1];
  return { enter: i > 0 ? trIn(s) : 0, exitAt: frames(s) - (next ? trIn(next) : 0) - 6, inLen: 9, outLen: 6 };
};

export const TsmcRef: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <TransitionSeries>
      {REF_SCENES.flatMap((s, i) => {
        const t = timingFor(i);
        const Body = s.body;
        const nodes: React.ReactNode[] = [];
        if (i > 0 && s.in) {
          nodes.push(<TransitionSeries.Transition key={`t-${s.id}`} presentation={presentationFor(s.in)} timing={linearTiming({ durationInFrames: trIn(s) })} />);
        }
        nodes.push(
          <TransitionSeries.Sequence key={s.id} durationInFrames={frames(s)}>
            <Body t={t} />
            {s.caption ? <Caption tag={s.tag} text={s.caption} timing={t} /> : null}
          </TransitionSeries.Sequence>
        );
        return nodes;
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
