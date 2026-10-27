/**
 * "Core로 본 TSMC 3분기 실적" — ~34s story: setup → ask → answer → payoff.
 * Booth-film style (gold on black, one serif caption per scene, a transition on every cut),
 * with a different effect per scene so it stays lively: document tilt-in, pages stacking, typing,
 * progress checks, count-ups, a range bar, bars, a cursor click into the source, a stamp slam.
 * The ask and the proof are shown sharp (not blurred). "4.8%" is never shown.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { Lockup } from "./Lockup";
import { C, MONO, SANS, SERIF } from "./theme";
import { TRANSITION_FRAMES, TransitionKind } from "./timeline";
import { presentationFor } from "./transitions";
import { AnswerPage } from "./tsmc";
import { CaptionTiming, Card3D, CornerMark, DarkCard3D, Headline, Illustrative, Tag, clamp01, fadeIn, useCount, useEnter, useTyped } from "./ui";

const FPS = 30;
const QUESTION = "TSMC reported 3Q26 results on Oct 15. How did the quarter do against its guidance, what is the 4Q26 guide, and what does it mean for our position?";

/* ------------------------------------------------------------------ shared pieces */

const Glow: React.FC<{ y?: string; a?: number }> = ({ y = "55%", a = 0.09 }) => (
  <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% ${y}, rgba(212,175,55,${a}), rgba(0,0,0,0) 60%)` }} />
);

/** Core's answer page pushed back as a blurred stage. */
const PageStage: React.FC<{ cy?: number }> = ({ cy = 520 }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 120], [0, -30], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden", perspective: 2000 }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1480, height: 1262, transform: `translate(-50%, -50%) translateY(${540 - cy + drift}px) rotateY(-7deg) rotateX(4deg) scale(1.32)`, filter: "brightness(0.32) saturate(0.6) blur(5px)" }}>
        <AnswerPage frame={100000} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%), linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 32%)" }} />
    </AbsoluteFill>
  );
};

const Label: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 4, color: dark ? C.gold : "#6b6f7a", textTransform: "uppercase" }}>{children}</div>
);

const Cite: React.FC<{ n: number }> = ({ n }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 24, padding: "0 6px", marginLeft: 6, borderRadius: 5, background: "#4f46e5", color: "#fff", fontFamily: SANS, fontSize: 15, fontWeight: 700, verticalAlign: "2px" }}>{n}</span>
);

const Cursor: React.FC<{ x: number; y: number; click?: number }> = ({ x, y, click = 0 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, zIndex: 5 }}>
    {click > 0 ? <div style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: 999, border: `2.5px solid ${C.gold}`, opacity: 1 - click, transform: `scale(${0.4 + click * 1.4})` }} /> : null}
    <svg width="30" height="34" viewBox="0 0 26 30" style={{ position: "absolute", left: -2, top: -2, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))" }}>
      <path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </div>
);

/** The press release as a document card (scenes 1 and 11). */
const Release: React.FC<{ delay: number; stamp?: number }> = ({ delay, stamp = 0 }) => {
  const e = useEnter(delay, 15);
  const flash = stamp > 0 ? interpolate(stamp, [0, 0.3, 1], [0, 0.35, 0]) : 0;
  return (
    <div style={{ position: "relative", width: 1040, opacity: clamp01(e * 1.4), transform: `perspective(1800px) rotateX(${(1 - e) * 16}deg) translateY(${(1 - e) * 60}px)`, transformOrigin: "50% 80%" }}>
      <div style={{ padding: "44px 52px 40px", background: "#f6f5f1", color: "#15171c", borderRadius: 14, boxShadow: "0 40px 120px rgba(0,0,0,0.75)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 4, color: "#6b6f7a", textTransform: "uppercase" }}>Press release · investor.tsmc.com</div>
          <div style={{ fontFamily: SANS, fontSize: 18, color: "#6b6f7a" }}>October 15, 2026</div>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 48, marginTop: 18, lineHeight: 1.15 }}>TSMC Reports Third Quarter EPS of NT$29.43</div>
        <div style={{ height: 1, background: "#d8dae0", margin: "26px 0 18px" }} />
        <div style={{ fontFamily: SANS, fontSize: 21, color: "#4a4e58", lineHeight: 1.5 }}>
          Hsinchu, Taiwan, R.O.C. – TSMC today announced consolidated revenue of US$46.72 billion, up 16.2% from the previous quarter and 41.2% from a year earlier, for the third quarter ended September 30, 2026 …
        </div>
      </div>
      {stamp > 0 ? (
        <>
          <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: `rgba(212,175,55,${flash})` }} />
          <div style={{ position: "absolute", right: 40, top: 150, transform: `rotate(-11deg) scale(${interpolate(stamp, [0, 1], [2.2, 1])})`, opacity: clamp01(stamp * 2), transformOrigin: "50% 50%" }}>
            <div style={{ padding: "14px 26px", border: `5px solid ${C.gold}`, borderRadius: 10, color: C.gold, fontFamily: MONO, fontWeight: 700, fontSize: 64, letterSpacing: 6, lineHeight: 1, background: "rgba(246,245,241,0.85)", boxShadow: `0 0 40px ${C.goldGlow}` }}>
              BEAT ✓
            </div>
            <div style={{ marginTop: 10, textAlign: "center", fontFamily: MONO, fontSize: 18, letterSpacing: 4, color: "#8a6d1c", background: "rgba(246,245,241,0.92)", padding: "4px 10px", borderRadius: 4 }}>READ BY CORE IN 45 S</div>
          </div>
        </>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ scenes */

type S = { id: string; dur: number; in?: TransitionKind; tag?: string; headline?: string; body: React.FC<{ t: CaptionTiming }> };

/** 1 · THE NEWS */
const News: React.FC<{ t: CaptionTiming }> = ({ t }) => (
  <AbsoluteFill style={{ background: C.black }}>
    <Glow />
    <div style={{ position: "absolute", left: 0, right: 0, top: 360, display: "flex", justifyContent: "center" }}>
      <Release delay={t.enter + 4} />
    </div>
  </AbsoluteFill>
);

/** 2 · pages stacking up */
const Pages: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const n = 10;
  const count = Math.min(n, Math.max(0, Math.floor((frame - t.enter - 6) / 4) + 1));
  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden" }}>
      <Glow a={0.06} />
      {Array.from({ length: n }).map((_, i) => {
        const at = t.enter + 6 + i * 4;
        const e = fadeIn(frame, at, 6);
        const rot = ((i * 37) % 11) - 5;
        const dx = ((i * 53) % 90) - 45;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 640 + dx,
              top: 360 + i * 22,
              width: 640,
              height: 460,
              background: "#f6f5f1",
              borderRadius: 8,
              boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
              opacity: e,
              transform: `translateY(${(1 - e) * -240}px) rotate(${rot}deg)`,
              padding: "26px 30px",
              color: "#4a4e58",
              fontFamily: SANS,
              fontSize: 16,
            }}
          >
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
      <div style={{ position: "absolute", right: 150, top: 400, textAlign: "right" }}>
        <div style={{ fontFamily: SERIF, fontSize: 180, lineHeight: 1, color: C.gold2, textShadow: `0 0 50px ${C.goldGlow}` }}>{count}</div>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 6, color: C.white2 }}>PAGES</div>
      </div>
    </AbsoluteFill>
  );
};

/** 3 · THE ASK — sharp, no blur */
const Ask: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const typed = useTyped(QUESTION, t.enter + 8, 78);
  const run = useEnter(t.enter + 8 + Math.ceil((QUESTION.length / 78) * FPS) + 4, 14);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Glow y="60%" a={0.12} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center" }}>
        <DarkCard3D delay={t.enter} width={1240} style={{ padding: "30px 36px 30px", border: `1px solid ${C.goldSoft}`, boxShadow: `0 40px 120px rgba(0,0,0,0.75), 0 0 80px ${C.goldGlow}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <span style={{ width: 9, height: 9, background: C.gold, transform: "rotate(45deg)", display: "inline-block" }} />
            <Tag size={15}>Core · Ask · TSMC</Tag>
          </div>
          <div style={{ minHeight: 140, padding: "22px 26px", background: "rgba(255,255,255,0.04)", border: `1px solid ${typed.done ? C.goldSoft : C.line}`, borderRadius: 12, fontFamily: SANS, fontSize: 32, color: C.white, lineHeight: 1.4 }}>
            {typed.shown}
            <span style={{ display: "inline-block", width: 3, height: 32, background: C.gold, marginLeft: 6, verticalAlign: "-0.15em", opacity: typed.cursor || !typed.done ? 1 : 0 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <div style={{ padding: "12px 28px", borderRadius: 10, background: C.gold, color: C.black, fontFamily: SANS, fontWeight: 700, fontSize: 22, opacity: clamp01(run * 1.3), transform: `scale(${0.9 + 0.1 * run})`, boxShadow: `0 0 ${24 + 12 * Math.sin(frame / 4)}px ${C.goldGlow}` }}>Ask</div>
          </div>
        </DarkCard3D>
      </div>
    </AbsoluteFill>
  );
};

/** 4 · Core at work */
const STEPS: [string, string][] = [
  ["The release", "TSMC 3Q26 results · Oct 15"],
  ["Last quarter's forecast", "3Q26 guidance · Jul 16"],
  ["Your portfolio", "TSMC position · demo fund"],
];
const Working: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const secs = Math.round(interpolate(frame, [t.enter + 6, t.enter + 70], [0, 45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const sources = useCount(9, t.enter + 30, (v) => `${Math.round(v)}`);
  const bar = interpolate(frame, [t.enter + 6, t.enter + 74], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <PageStage cy={330} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center" }}>
        <DarkCard3D delay={t.enter + 2} width={1100} style={{ padding: "28px 36px 30px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <Tag size={16}>Core is working</Tag>
            <span style={{ fontFamily: MONO, fontSize: 20, letterSpacing: 2, color: C.white2 }}>
              Worked for <span style={{ color: C.gold2 }}>{secs} s</span> · <span style={{ color: C.gold2 }}>{sources}</span> sources
            </span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 18 }}>
            <div style={{ width: `${bar}%`, height: "100%", background: C.gold, boxShadow: `0 0 16px ${C.goldGlow}` }} />
          </div>
          {STEPS.map(([k, v], i) => {
            const at = t.enter + 12 + i * 18;
            const e = useEnter(at, 16);
            const done = frame > at + 16;
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 18, padding: "11px 0", opacity: clamp01(e * 1.4), transform: `translateX(${(1 - e) * -16}px)` }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, border: `1.5px solid ${C.gold}`, background: done ? C.gold : "transparent", color: C.black, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS }}>{done ? "✓" : ""}</span>
                <span style={{ fontFamily: SANS, fontSize: 30, color: C.white, width: 420 }}>{k}</span>
                <span style={{ fontFamily: MONO, fontSize: 16, letterSpacing: 2, color: C.white3 }}>{v}</span>
              </div>
            );
          })}
        </DarkCard3D>
      </div>
      <Illustrative />
    </AbsoluteFill>
  );
};

/** 5 · THE ANSWER: the verdict first */
const Verdict: React.FC<{ t: CaptionTiming }> = ({ t }) => (
  <AbsoluteFill>
    <PageStage cy={330} />
    <CornerMark />
    <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center" }}>
      <Card3D delay={t.enter + 2} width={1240} style={{ padding: "34px 44px 32px" }}>
        <Label>Core · first sentence of the answer</Label>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: 1.25, color: "#111318", marginTop: 14 }}>
          TSMC beat its 3Q26 guidance and guided 4Q26 sharply higher with margins holding, which supports keeping the long.
        </div>
      </Card3D>
    </div>
    <Illustrative />
  </AbsoluteFill>
);

/** 6 · revenue vs forecast */
const Revenue: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const actual = useCount(46.72, t.enter + 18, (v) => `$${v.toFixed(2)}B`);
  const dot = useEnter(t.enter + 30, 14);
  const px = (v: number) => ((v - 43) / 5) * 100;
  return (
    <AbsoluteFill>
      <PageStage cy={560} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center", gap: 26 }}>
        <Card3D delay={t.enter + 2} width={560} style={{ padding: "30px 36px 28px" }}>
          <Label>Forecast · Jul 16</Label>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 60, color: "#4a4e58", marginTop: 8, lineHeight: 1.05 }}>$44.6–45.8B</div>
          <div style={{ position: "relative", height: 40, marginTop: 22 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 14, height: 8, background: "#eceef3", borderRadius: 99 }} />
            <div style={{ position: "absolute", left: `${px(44.6)}%`, width: `${px(45.8) - px(44.6)}%`, top: 8, height: 20, background: "#c9ccd6", borderRadius: 6 }} />
          </div>
        </Card3D>
        <Card3D delay={t.enter + 12} width={620} tiltY={10} style={{ padding: "30px 36px 28px", background: "#111318", color: C.white, border: `1px solid ${C.goldSoft}` }}>
          <Label dark>Actual · Oct 15</Label>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 84, color: C.gold2, marginTop: 8, lineHeight: 1.05 }}>{actual}</div>
          <div style={{ position: "relative", height: 40, marginTop: 10 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 14, height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 99 }} />
            <div style={{ position: "absolute", left: `${px(44.6)}%`, width: `${px(45.8) - px(44.6)}%`, top: 8, height: 20, background: "rgba(255,255,255,0.2)", borderRadius: 6 }} />
            <div style={{ position: "absolute", left: `${px(46.72)}%`, top: 18, width: 24, height: 24, borderRadius: 999, background: C.gold, boxShadow: `0 0 22px ${C.goldGlow}`, transform: `translate(-50%, -50%) scale(${dot})` }} />
          </div>
          <div style={{ fontFamily: SANS, fontSize: 20, color: C.white2, marginTop: 2, opacity: clamp01(dot * 1.4) }}>above the top of the range</div>
        </Card3D>
      </div>
      <Illustrative />
    </AbsoluteFill>
  );
};

/** 7 · next quarter's guide */
const Guide: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const lo = useCount(52.3, t.enter + 16, (v) => v.toFixed(1));
  const hi = useCount(54.3, t.enter + 22, (v) => v.toFixed(1));
  const arrow = useEnter(t.enter + 28, 14);
  return (
    <AbsoluteFill>
      <PageStage cy={560} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 390, display: "flex", justifyContent: "center", gap: 26, alignItems: "stretch" }}>
        <Card3D delay={t.enter + 2} width={450} style={{ padding: "30px 36px" }}>
          <Label>This quarter · 3Q26</Label>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, marginTop: 10, color: "#4a4e58" }}>$46.72B</div>
        </Card3D>
        <div style={{ display: "flex", alignItems: "center", fontFamily: SANS, fontSize: 64, color: C.gold2, opacity: clamp01(arrow * 1.4), transform: `translateX(${(arrow - 1) * 20}px)` }}>→</div>
        <Card3D delay={t.enter + 10} width={660} tiltY={10} style={{ padding: "30px 40px", background: "#111318", color: C.white, border: `1px solid ${C.goldSoft}` }}>
          <Label dark>Next quarter · 4Q26 guide</Label>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 84, marginTop: 8, color: C.gold2, lineHeight: 1.05 }}>${lo}–{hi}B</div>
        </Card3D>
      </div>
      <Illustrative />
    </AbsoluteFill>
  );
};

/** 8 · 2nm share */
const N2: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const a = useCount(3, t.enter + 12, (v) => `${Math.round(v)}%`);
  const b = useCount(8, t.enter + 26, (v) => `${Math.round(v)}%`);
  const ba = useEnter(t.enter + 12, 20);
  const bb = useEnter(t.enter + 26, 20);
  const Col: React.FC<{ label: string; v: string; h: number; gold?: boolean }> = ({ label, v, h, gold }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 220 }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 60, color: gold ? C.gold2 : "#4a4e58" }}>{v}</div>
      <div style={{ width: 120, height: 200, display: "flex", alignItems: "flex-end" }}>
        <div style={{ width: "100%", height: `${h}%`, background: gold ? C.gold : "#c9ccd6", borderRadius: 8, boxShadow: gold ? `0 0 26px ${C.goldGlow}` : "none" }} />
      </div>
      <Label>{label}</Label>
    </div>
  );
  return (
    <AbsoluteFill>
      <PageStage cy={1000} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, display: "flex", justifyContent: "center" }}>
        <Card3D delay={t.enter + 2} width={900} style={{ padding: "28px 40px 26px" }}>
          <Label>2nm share of wafer revenue</Label>
          <div style={{ display: "flex", justifyContent: "center", gap: 120, marginTop: 8 }}>
            <Col label="2Q26" v={a} h={(3 / 8) * 100 * ba} />
            <Col label="3Q26" v={b} h={100 * bb} gold />
          </div>
        </Card3D>
      </div>
      <Illustrative />
    </AbsoluteFill>
  );
};

/** 9 · FOR YOUR FUND */
const Fund: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const pos = useCount(8.6, t.enter + 14, (v) => `$${v.toFixed(1)}M`);
  const nav = useCount(3.8, t.enter + 20, (v) => `${v.toFixed(1)}%`);
  const move = useCount(864, t.enter + 26, (v) => `$${Math.round(v)}K`);
  return (
    <AbsoluteFill>
      <PageStage cy={560} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center" }}>
        <DarkCard3D delay={t.enter + 2} width={1180} style={{ padding: "34px 40px", border: `1px solid ${C.goldSoft}`, boxShadow: `0 40px 120px rgba(0,0,0,0.75), 0 0 60px ${C.goldGlow}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Tag size={15}>Your position · TSMC (2330.TW)</Tag>
            <span style={{ padding: "6px 12px", border: `1.5px solid ${C.gold}`, borderRadius: 4, fontFamily: MONO, fontSize: 14, letterSpacing: 4, color: C.gold }}>DEMO FUND</span>
          </div>
          <div style={{ display: "flex", gap: 70, marginTop: 16 }}>
            {[
              ["we're long", pos],
              ["of NAV", nav],
              ["per 10% move", move],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 76, color: C.gold2, lineHeight: 1.05 }}>{v}</div>
                <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: C.white3, textTransform: "uppercase", marginTop: 6 }}>{k}</div>
              </div>
            ))}
          </div>
        </DarkCard3D>
      </div>
      <Illustrative />
    </AbsoluteFill>
  );
};

/** 10 · THE PROOF — sharp: cursor clicks a citation, the source sentence opens */
const Proof: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const ease = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  // the ③ chip sits at the right end of the "Actual" header cell: card left 340 + 40 pad + 280 + 1/2 of (1240-80-280-250)=315 → ≈ 340+40+280+140 = 800; y = card top 300 + 30 + 28 + 25 ≈ 383
  const cx = interpolate(frame, [t.enter + 20, t.enter + 44], [1420, 1084], ease);
  const cy = interpolate(frame, [t.enter + 20, t.enter + 44], [820, 392], ease);
  const click = interpolate(frame, [t.enter + 48, t.enter + 62], [0, 1], ease);
  const panel = useEnter(t.enter + 56, 15);
  const hl = fadeIn(frame, t.enter + 72, 10);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Glow y="45%" a={0.1} />
      <CornerMark />
      <div style={{ position: "absolute", left: 340, top: 300, width: 1240 }}>
        <Card3D delay={t.enter + 2} width={1240} tiltY={0} style={{ padding: "28px 40px 24px" }}>
          <Label>Guided vs printed · 3Q26</Label>
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 1fr 250px", fontFamily: SANS, fontSize: 23, marginTop: 12, borderTop: "1px solid #e5e7eb" }}>
            {[["Metric", <span key="a">Guidance <Cite n={5} /></span>, <span key="b">Actual <Cite n={3} /></span>, "Result"], ["Revenue", "US$44.6–45.8B", "US$46.72B", "Above the range"], ["Gross margin", "65–67%", "66.4%", "Inside the range"]].map((row, r) => (
              <React.Fragment key={r}>
                {row.map((cell, c) => (
                  <div key={c} style={{ padding: "0 14px", height: 50, display: "flex", alignItems: "center", borderBottom: "1px solid #e5e7eb", color: r === 0 ? "#6b6f7a" : c === 3 && String(cell).startsWith("Above") ? "#15803d" : "#111318", fontWeight: r === 0 ? 500 : c === 0 || (c === 3 && String(cell).startsWith("Above")) ? 700 : 400, background: r === 0 ? "#fafafa" : "transparent" }}>
                    {cell}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </Card3D>
      </div>
      <div style={{ position: "absolute", left: 340, top: 560, width: 1240, opacity: clamp01(panel * 1.4), transform: `translateY(${(1 - panel) * 40}px)` }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "22px 30px 24px", boxShadow: `0 40px 120px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px ${C.goldDim}`, display: "flex", gap: 22 }}>
          <div style={{ width: 4, background: C.gold, borderRadius: 2, flexShrink: 0 }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: "#6b6f7a", textTransform: "uppercase" }}>
              <Cite n={3} /> Public · 3Q26 earnings release · investor.tsmc.com · page 1
            </div>
            <div style={{ fontFamily: SANS, fontSize: 26, lineHeight: 1.4, color: "#2a2e38", marginTop: 10 }}>
              TSMC today announced consolidated revenue of{" "}
              <span style={{ background: `rgba(212,175,55,${0.4 * hl})`, borderRadius: 3, padding: "0 3px" }}>US$46.72 billion, up 16.2% from the previous quarter and 41.2% from a year earlier</span>, for the third quarter ended September 30, 2026.
            </div>
          </div>
        </div>
      </div>
      {frame >= t.enter + 16 ? <Cursor x={cx} y={cy} click={click} /> : null}
      <Illustrative />
    </AbsoluteFill>
  );
};

/** 11 · payoff: the release again, stamped */
const Payoff: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const stamp = useEnter(t.enter + 22, 22);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Glow />
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, display: "flex", justifyContent: "center" }}>
        <Release delay={t.enter} stamp={stamp} />
      </div>
    </AbsoluteFill>
  );
};

/** 12 · end card */
const End: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const head = useEnter(t.enter + 2, 16);
  const lock = useEnter(t.enter + 16, 14);
  const btn = useEnter(t.enter + 30, 14);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Glow y="45%" a={0.12} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, textAlign: "center", fontFamily: SERIF, fontSize: 150, color: C.white, lineHeight: 1, opacity: clamp01(head * 1.3), transform: `translateY(${(1 - head) * 20}px)` }}>Ask. It’s done.</div>
      <div style={{ position: "absolute", left: "50%", top: 500, transform: `translateX(-50%) scale(${0.9 + 0.1 * lock})`, opacity: clamp01(lock * 1.3) }}>
        <Lockup size={64} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 720, display: "flex", justifyContent: "center", opacity: clamp01(btn * 1.3) }}>
        <div style={{ padding: "18px 44px", borderRadius: 999, background: C.gold, color: C.black, fontFamily: SANS, fontWeight: 700, fontSize: 30, boxShadow: `0 0 30px ${C.goldGlow}` }}>Request demo</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 820, textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: 5, color: C.white2, opacity: fadeIn(frame, t.enter + 40, 10) }}>treasurer.net/core</div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ cut */

export const GOLD_SCENES: S[] = [
  { id: "news", dur: 3.2, tag: "The news", headline: "TSMC just reported earnings.", body: News },
  { id: "pages", dur: 3.2, in: "slide", headline: "Ten pages of numbers. Your PM wants one answer.", body: Pages },
  { id: "ask", dur: 3.6, in: "goldwipe", tag: "The ask", headline: "Ask Core.", body: Ask },
  { id: "working", dur: 3.4, in: "fade", headline: "It reads the release, last quarter's forecast, and your book.", body: Working },
  { id: "verdict", dur: 3.4, in: "goldwipe", tag: "The answer", headline: "The verdict comes first.", body: Verdict },
  { id: "revenue", dur: 3.4, in: "slide", headline: "Revenue beat the top of its own forecast.", body: Revenue },
  { id: "guide", dur: 3.0, in: "wipe", headline: "And it expects even more next quarter.", body: Guide },
  { id: "n2", dur: 3.0, in: "slide", headline: "The reason: its newest 2nm chips.", body: N2 },
  { id: "fund", dur: 3.2, in: "slideup", tag: "For your fund", headline: "What it means for your position.", body: Fund },
  { id: "proof", dur: 4.2, in: "goldwipe", tag: "The proof", headline: "Every number, one click from the source.", body: Proof },
  { id: "payoff", dur: 3.4, in: "fade", headline: "Core. Earnings, read.", body: Payoff },
  { id: "end", dur: 3.2, in: "fade", body: End },
];

const frames = (s: S) => Math.round(s.dur * FPS);
const trIn = (s: S) => (s.in ? TRANSITION_FRAMES[s.in] : 0);
export const GOLD_FRAMES = GOLD_SCENES.reduce((a, s, i) => a + frames(s) - (i > 0 ? trIn(s) : 0), 0);

const timingFor = (i: number): CaptionTiming => {
  const s = GOLD_SCENES[i];
  const next = GOLD_SCENES[i + 1];
  return { enter: i > 0 ? trIn(s) : 0, exitAt: frames(s) - (next ? trIn(next) : 0) - 6, inLen: 9, outLen: 6 };
};

export const TsmcGold: React.FC = () => (
  <AbsoluteFill style={{ background: C.black }}>
    <TransitionSeries>
      {GOLD_SCENES.flatMap((s, i) => {
        const t = timingFor(i);
        const Body = s.body;
        const nodes: React.ReactNode[] = [];
        if (i > 0 && s.in) {
          nodes.push(<TransitionSeries.Transition key={`t-${s.id}`} presentation={presentationFor(s.in)} timing={linearTiming({ durationInFrames: trIn(s) })} />);
        }
        nodes.push(
          <TransitionSeries.Sequence key={s.id} durationInFrames={frames(s)}>
            <Body t={t} />
            {s.headline ? <Headline tag={s.tag} text={s.headline} timing={t} /> : null}
          </TransitionSeries.Sequence>
        );
        return nodes;
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
