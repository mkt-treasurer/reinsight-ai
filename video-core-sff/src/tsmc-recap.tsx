/**
 * "TSMC's Q3 2026 earnings, read by Core" — an informative EARNINGS RECAP (~41s), not a feature demo.
 * Same look as the story film (near-black navy stage, white cards, serif captions), with:
 * a black caption bar at the top (44px), a persistent "Read by Core" tag top-right, a kicker above
 * each card, and a small source chip under each fact styled like Core's citation badge.
 * Figures are from TSMC's Oct 15, 2026 release and earnings call. Never shows "4.8%" or "(1.4 pts)".
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { Lockup } from "./Lockup";
import { MONO, SERIF } from "./theme";
import { TRANSITION_FRAMES, TransitionKind } from "./timeline";
import { presentationFor } from "./transitions";
import { CaptionTiming, Card3D, clamp01, fadeIn, useCount, useEnter } from "./ui";

const FPS = 30;
const SANS = "Pretendard, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/* palette (same as the story film) */
const BG = "#07090d";
const CREAM = "#efede6";
const MUTED = "#8ea0bd";
const INK = "#15171c";
const INK2 = "#3b3f49";
const GREY = "#6b6f7a";
const LINE = "#e5e7eb";
const INDIGO = "#4f46e5";
const GREEN = "#15803d";
const RED = "#b91c1c";

/* ------------------------------------------------------------------ chrome */

const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(40,60,110,0.18), rgba(0,0,0,0) 60%)" }} />
    {children}
  </AbsoluteFill>
);

/** Black bar at the top: 44px serif caption, persistent "Read by Core" tag on the right. */
const TopBar: React.FC<{ text: string; timing: CaptionTiming }> = ({ text, timing }) => {
  const frame = useCurrentFrame();
  const a = fadeIn(frame, timing.enter, timing.inLen ?? 9) * (1 - fadeIn(frame, timing.exitAt, timing.outLen ?? 6));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 96, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: SERIF, fontSize: 44, color: CREAM, opacity: a, padding: "0 240px", textAlign: "center", whiteSpace: "nowrap" }}>{text}</div>
      <div style={{ position: "absolute", right: 40, top: 0, bottom: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: INDIGO }} />
        <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 4, color: MUTED, textTransform: "uppercase" }}>Read by Core</span>
      </div>
    </div>
  );
};

/** Kicker above a card: "1 · A BEAT". */
const Kicker: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const e = useEnter(delay, 16);
  return (
    <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 6, color: CREAM, textTransform: "uppercase", marginBottom: 14, opacity: clamp01(e * 1.4), transform: `translateY(${(1 - e) * -8}px)` }}>{text}</div>
  );
};

/** Source chip under a fact, styled like Core's citation badge. */
const Chip: React.FC<{ n: number; text: string; delay: number; light?: boolean }> = ({ n, text, delay, light }) => {
  const e = useEnter(delay, 16);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 6px", borderRadius: 999, background: light ? "#f3f4f6" : "rgba(255,255,255,0.08)", opacity: clamp01(e * 1.4), transform: `translateY(${(1 - e) * 8}px)` }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 24, padding: "0 6px", borderRadius: 6, background: INDIGO, color: "#fff", fontFamily: SANS, fontSize: 14, fontWeight: 700 }}>{n}</span>
      <span style={{ fontFamily: SANS, fontSize: 17, color: light ? INK2 : CREAM }}>{text}</span>
    </div>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 4, color: GREY, textTransform: "uppercase" }}>{children}</div>
);

const Pop: React.FC<{ delay: number; width: number; children: React.ReactNode; style?: React.CSSProperties; tiltY?: number }> = ({ delay, width, children, style, tiltY = -6 }) => (
  <Card3D delay={delay} width={width} tiltY={tiltY} style={{ boxShadow: "0 40px 120px rgba(0,0,0,0.7)", ...style }}>
    {children}
  </Card3D>
);

/** Block centred on the stage: kicker, card(s), chip. */
const Block: React.FC<{ top?: number; width: number; children: React.ReactNode }> = ({ top = 340, width, children }) => (
  <div style={{ position: "absolute", left: "50%", top, width, marginLeft: -width / 2 }}>{children}</div>
);

/* ------------------------------------------------------------------ scenes */

type S = { id: string; dur: number; in?: TransitionKind; caption: string; body: React.FC<{ t: CaptionTiming }> };

/** 1 · the release */
const Hero: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const e = useEnter(t.enter + 4, 15);
  return (
    <Stage>
      <Block top={330} width={1040}>
        <div style={{ opacity: clamp01(e * 1.4), transform: `perspective(1800px) rotateX(${(1 - e) * 16}deg) translateY(${(1 - e) * 60}px)`, transformOrigin: "50% 80%" }}>
          <div style={{ padding: "44px 52px 40px", background: "#f6f5f1", color: INK, borderRadius: 14, boxShadow: "0 40px 120px rgba(0,0,0,0.75)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 4, color: GREY, textTransform: "uppercase" }}>Press release · investor.tsmc.com</div>
              <div style={{ fontFamily: SANS, fontSize: 18, color: GREY }}>October 15, 2026</div>
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 48, marginTop: 18, lineHeight: 1.15 }}>TSMC Reports Third Quarter EPS of NT$29.43</div>
            <div style={{ height: 1, background: "#d8dae0", margin: "26px 0 18px" }} />
            <div style={{ fontFamily: SANS, fontSize: 21, color: "#4a4e58", lineHeight: 1.5 }}>
              In US dollars, third quarter revenue was <b style={{ color: INK }}>$46.72 billion</b>, which increased 41.2% year-over-year and increased 16.2% from the previous quarter.
            </div>
          </div>
        </div>
      </Block>
    </Stage>
  );
};

/** 2 · A BEAT */
const Beat: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const actual = useCount(46.72, t.enter + 22, (v) => `$${v.toFixed(2)}B`);
  const dot = useEnter(t.enter + 36, 14);
  const px = (v: number) => ((v - 43) / 5) * 100;
  return (
    <Stage>
      <Block width={1240}>
        <Kicker text="1 · A beat" delay={t.enter + 2} />
        <div style={{ display: "flex", gap: 26 }}>
          <Pop delay={t.enter + 6} width={560} style={{ padding: "30px 36px 28px" }}>
            <Label>Forecast · Jul 16</Label>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 60, color: INK2, marginTop: 8, lineHeight: 1.05 }}>$44.6–45.8B</div>
            <div style={{ position: "relative", height: 40, marginTop: 22 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 14, height: 8, background: "#eceef3", borderRadius: 99 }} />
              <div style={{ position: "absolute", left: `${px(44.6)}%`, width: `${px(45.8) - px(44.6)}%`, top: 8, height: 20, background: "#c9ccd6", borderRadius: 6 }} />
            </div>
          </Pop>
          <Pop delay={t.enter + 16} width={654} tiltY={6} style={{ padding: "30px 36px 28px" }}>
            <Label>Actual · Oct 15</Label>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 84, color: INK, marginTop: 8, lineHeight: 1.05 }}>{actual}</div>
            <div style={{ position: "relative", height: 40, marginTop: 10 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 14, height: 8, background: "#eceef3", borderRadius: 99 }} />
              <div style={{ position: "absolute", left: `${px(44.6)}%`, width: `${px(45.8) - px(44.6)}%`, top: 8, height: 20, background: "#c9ccd6", borderRadius: 6 }} />
              <div style={{ position: "absolute", left: `${px(46.72)}%`, top: 18, width: 24, height: 24, borderRadius: 999, background: GREEN, transform: `translate(-50%, -50%) scale(${dot})` }} />
            </div>
            <div style={{ fontFamily: SANS, fontSize: 22, color: GREEN, fontWeight: 600, marginTop: 2, opacity: clamp01(dot * 1.4) }}>above the top of the range</div>
          </Pop>
        </div>
        <div style={{ marginTop: 18 }}>
          <Chip n={1} text="TSMC 3Q26 earnings release" delay={t.enter + 50} />
        </div>
      </Block>
    </Stage>
  );
};

/** 3 · AI DID THE HEAVY LIFTING */
const AI: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const share = useCount(68, t.enter + 16, (v) => `${Math.round(v)}%`);
  const qoq = useCount(22, t.enter + 26, (v) => `+${Math.round(v)}%`);
  const a = useCount(3, t.enter + 40, (v) => `${Math.round(v)}%`);
  const b = useCount(8, t.enter + 56, (v) => `${Math.round(v)}%`);
  const ba = useEnter(t.enter + 40, 20);
  const bb = useEnter(t.enter + 56, 20);
  const Col: React.FC<{ label: string; v: string; h: number; hi?: boolean }> = ({ label, v, h, hi }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 150 }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: hi ? INK : INK2 }}>{v}</div>
      <div style={{ width: 84, height: 150, display: "flex", alignItems: "flex-end" }}>
        <div style={{ width: "100%", height: `${h}%`, background: hi ? INDIGO : "#c9ccd6", borderRadius: 6 }} />
      </div>
      <Label>{label}</Label>
    </div>
  );
  return (
    <Stage>
      <Block width={1240}>
        <Kicker text="2 · AI did the heavy lifting" delay={t.enter + 2} />
        <div style={{ display: "flex", gap: 26 }}>
          <Pop delay={t.enter + 6} width={700} style={{ padding: "30px 36px 28px" }}>
            <Label>AI / HPC share of revenue · 3Q26</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 8 }}>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 112, color: INK, lineHeight: 1 }}>{share}</div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 36, color: GREEN }}>{qoq}</div>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 22, color: INK2, marginTop: 10 }}>of revenue · vs last quarter</div>
          </Pop>
          <Pop delay={t.enter + 18} width={514} tiltY={6} style={{ padding: "26px 30px 22px" }}>
            <Label>2nm share of wafer revenue</Label>
            <div style={{ display: "flex", justifyContent: "center", gap: 60, marginTop: 6 }}>
              <Col label="2Q26" v={a} h={(3 / 8) * 100 * ba} />
              <Col label="3Q26" v={b} h={100 * bb} hi />
            </div>
          </Pop>
        </div>
        <div style={{ marginTop: 18 }}>
          <Chip n={2} text="Earnings call · p.2" delay={t.enter + 70} />
        </div>
      </Block>
    </Stage>
  );
};

/** 4 · THE CATCH */
const Catch: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const prev = useCount(67.7, t.enter + 14, (v) => `${v.toFixed(1)}%`);
  const now = useCount(66.4, t.enter + 26, (v) => `${v.toFixed(1)}%`);
  const arrow = useEnter(t.enter + 30, 14);
  const line = useEnter(t.enter + 54, 16);
  return (
    <Stage>
      <Block width={1240}>
        <Kicker text="3 · The catch" delay={t.enter + 2} />
        <Pop delay={t.enter + 6} width={1240} tiltY={0} style={{ padding: "30px 40px 30px" }}>
          <Label>Gross margin</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 28, marginTop: 8 }}>
            <div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 64, color: INK2, lineHeight: 1 }}>{prev}</div>
              <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: GREY, marginTop: 8 }}>2Q26</div>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 48, color: RED, opacity: clamp01(arrow * 1.4), transform: `translateX(${(arrow - 1) * 16}px)` }}>→</div>
            <div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 96, color: INK, lineHeight: 1 }}>{now}</div>
              <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: GREY, marginTop: 8 }}>3Q26 · as 2nm ramps</div>
            </div>
          </div>
          <div style={{ height: 1, background: LINE, margin: "22px 0 16px" }} />
          <div style={{ fontFamily: SANS, fontSize: 24, color: INK2, opacity: clamp01(line * 1.4), transform: `translateY(${(1 - line) * 8}px)` }}>
            Overseas fabs: <b style={{ color: INK }}>~2%</b> margin drag now, <b style={{ color: INK }}>3–4%</b> in coming years.
          </div>
        </Pop>
        <div style={{ marginTop: 18 }}>
          <Chip n={3} text="Earnings call · p.3" delay={t.enter + 70} />
        </div>
      </Block>
    </Stage>
  );
};

/** 5 · MORE AHEAD */
const Ahead: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const lo = useCount(52.3, t.enter + 14, (v) => v.toFixed(1));
  const hi = useCount(54.3, t.enter + 20, (v) => v.toFixed(1));
  const growth = useCount(44, t.enter + 30, (v) => `~${Math.round(v)}%`);
  const capLo = useCount(60, t.enter + 44, (v) => `${Math.round(v)}`);
  const capHi = useCount(64, t.enter + 48, (v) => `${Math.round(v)}`);
  const tiles: [string, React.ReactNode, string, number][] = [
    ["4Q26 revenue guide", <>${lo}–{hi}B</>, "vs $46.72B in 3Q", 6],
    ["2026 revenue growth", growth, "in US dollars", 18],
    ["2026 capex", <>${capLo}–{capHi}B</>, "budget reiterated", 30],
  ];
  return (
    <Stage>
      <Block width={1240}>
        <Kicker text="4 · More ahead" delay={t.enter + 2} />
        <div style={{ display: "flex", gap: 22 }}>
          {tiles.map(([k, v, sub, d], i) => (
            <Pop key={k} delay={t.enter + d} width={399} tiltY={i === 0 ? -6 : i === 2 ? 6 : 0} style={{ padding: "26px 30px 24px" }}>
              <Label>{k}</Label>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: i === 1 ? 64 : 52, color: INK, marginTop: 10, lineHeight: 1.05, minHeight: 68 }}>{v}</div>
              <div style={{ fontFamily: SANS, fontSize: 19, color: GREY, marginTop: 8 }}>{sub}</div>
            </Pop>
          ))}
        </div>
        <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
          <Chip n={1} text="Earnings release" delay={t.enter + 64} />
          <Chip n={4} text="Earnings call · p.3–4" delay={t.enter + 70} />
        </div>
      </Block>
    </Stage>
  );
};

/** 6 · THE CEO */
const CEO: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const q1 = useEnter(t.enter + 14, 16);
  const q2 = useEnter(t.enter + 44, 16);
  return (
    <Stage>
      <Block width={1140}>
        <Kicker text="5 · The CEO" delay={t.enter + 2} />
        <Pop delay={t.enter + 6} width={1140} tiltY={0} style={{ padding: "34px 44px 30px" }}>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ width: 4, background: INDIGO, borderRadius: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SANS, fontSize: 36, lineHeight: 1.35, color: INK, opacity: clamp01(q1 * 1.4), transform: `translateY(${(1 - q1) * 8}px)` }}>
                On AI demand: <b>"extremely robust"</b>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 36, lineHeight: 1.35, color: INK, marginTop: 14, opacity: clamp01(q2 * 1.4), transform: `translateY(${(1 - q2) * 8}px)` }}>
                On planning for 2027: <b>"prudent"</b>
              </div>
              <div style={{ height: 1, background: LINE, margin: "22px 0 14px" }} />
              <div style={{ fontFamily: SANS, fontSize: 20, color: GREY }}>C.C. Wei, Chairman &amp; CEO · 3Q26 earnings call</div>
            </div>
          </div>
        </Pop>
        <div style={{ marginTop: 18 }}>
          <Chip n={4} text="Earnings call · p.4, p.7" delay={t.enter + 70} />
        </div>
      </Block>
    </Stage>
  );
};

/** 7 · CORE'S READ: the Core screen, sharp, first sentence highlighted. */
const CoreRead: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const win = useEnter(t.enter + 2, 15);
  const hl = fadeIn(frame, t.enter + 30, 12);
  const list = useEnter(t.enter + 50, 16);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 215, top: 150, width: 1490, opacity: clamp01(win * 1.4), transform: `translateY(${(1 - win) * 40}px)` }}>
        <Kicker text="Core's read" delay={t.enter + 2} />
        <div style={{ height: 760, borderRadius: 14, overflow: "hidden", background: "#1b1d22", boxShadow: "0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)" }}>
          <div style={{ height: 42, background: "#2a2c33", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <span key={c} style={{ width: 11, height: 11, borderRadius: 999, background: c }} />
            ))}
            <span style={{ width: 24 }} />
            <span style={{ fontFamily: SANS, fontSize: 13, color: "#c6c9d2", background: "#1b1d22", borderRadius: 7, padding: "5px 14px", width: 420 }}>force.treasurer.net/#/en/ask</span>
          </div>
          <div style={{ background: "#fff", height: 718, padding: "34px 56px", fontFamily: SANS, color: INK }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ background: "#111", color: "#fff", borderRadius: 14, padding: "16px 24px", fontSize: 21, lineHeight: "30px", maxWidth: 1100 }}>
                TSMC reported 3Q26 results on Oct 15. How did the quarter do against its guidance, what is the 4Q26 guide, and what does it mean for our position?
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 17, color: GREY, marginTop: 28 }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: "#16a34a", color: "#fff", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✓</span>
              Worked for 45 s · 9 sources
            </div>
            <div style={{ marginTop: 18, fontSize: 32, fontWeight: 700, lineHeight: "44px" }}>
              <span style={{ background: `rgba(79,70,229,${0.16 * hl})`, boxShadow: `0 0 0 ${6 * hl}px rgba(79,70,229,${0.16 * hl})`, borderRadius: 4 }}>
                TSMC's 3Q26 was a clean beat and a stronger guide, with margins slipping only as 2nm ramps.
              </span>{" "}
              <span style={{ fontWeight: 400, color: INK2 }}>Revenue came in above the top of the guided range and the 4Q26 guide implies another strong step up in sales.</span>
            </div>
            <div style={{ marginTop: 30, opacity: clamp01(list * 1.4), transform: `translateY(${(1 - list) * 10}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 4, color: GREY, textTransform: "uppercase" }}>What would change the view</div>
              <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
                {["Bigger margin dilution", "Consumer weakness in 2027", "AI overbuild"].map((x) => (
                  <span key={x} style={{ padding: "10px 16px", borderRadius: 10, background: "#f3f4f6", fontSize: 22, color: INK2 }}>{x}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
};

/** 8 · closing line */
const Closing: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const a = useEnter(t.enter + 4, 16);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 440, textAlign: "center", opacity: clamp01(a * 1.4), transform: `translateY(${(1 - a) * 12}px)` }}>
        <div style={{ fontFamily: SERIF, fontSize: 60, color: CREAM, lineHeight: 1.2, padding: "0 240px" }}>Every number from TSMC's own filings.</div>
        <div style={{ fontFamily: SERIF, fontSize: 40, color: MUTED, marginTop: 18 }}>Read by Core in 36 seconds.</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 40 }}>
          <Chip n={1} text="3Q26 earnings release" delay={t.enter + 24} />
          <Chip n={4} text="3Q26 earnings call" delay={t.enter + 30} />
        </div>
      </div>
    </Stage>
  );
};

/** 9 · end card */
const End: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const head = useEnter(t.enter + 2, 16);
  const lock = useEnter(t.enter + 16, 14);
  const btn = useEnter(t.enter + 30, 14);
  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, rgba(40,60,110,0.22), rgba(0,0,0,0) 60%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, textAlign: "center", fontFamily: SERIF, fontSize: 150, color: CREAM, lineHeight: 1, opacity: clamp01(head * 1.3), transform: `translateY(${(1 - head) * 20}px)` }}>Ask. It’s done.</div>
      <div style={{ position: "absolute", left: "50%", top: 500, transform: `translateX(-50%) scale(${0.9 + 0.1 * lock})`, opacity: clamp01(lock * 1.3) }}>
        <Lockup size={64} color={CREAM} subColor="#b9c1d1" dot="#5b7cff" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 720, display: "flex", justifyContent: "center", opacity: clamp01(btn * 1.3) }}>
        <div style={{ padding: "18px 44px", borderRadius: 999, background: CREAM, color: INK, fontFamily: SANS, fontWeight: 700, fontSize: 30 }}>Request demo</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 820, textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: 5, color: MUTED, opacity: fadeIn(frame, t.enter + 40, 10) }}>treasurer.net/core</div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ cut */

export const RECAP_SCENES: S[] = [
  { id: "hero", dur: 3.4, caption: "TSMC's Q3 2026 earnings, read by Core.", body: Hero },
  { id: "beat", dur: 6.0, in: "fade", caption: "Revenue beat its own forecast.", body: Beat },
  { id: "ai", dur: 6.0, in: "slide", caption: "AI chips are now 68% of sales.", body: AI },
  { id: "catch", dur: 6.0, in: "fade", caption: "Margins slipped as new 2nm lines ramp up.", body: Catch },
  { id: "ahead", dur: 6.0, in: "slide", caption: "And it expects even more.", body: Ahead },
  { id: "ceo", dur: 5.0, in: "fade", caption: "In the CEO's words.", body: CEO },
  { id: "core", dur: 5.4, in: "wipe", caption: "Core's read, in one sentence.", body: CoreRead },
  { id: "closing", dur: 3.4, in: "fade", caption: "", body: Closing },
  { id: "end", dur: 3.4, in: "fade", caption: "", body: End },
];

const frames = (s: S) => Math.round(s.dur * FPS);
const trIn = (s: S) => (s.in ? TRANSITION_FRAMES[s.in] : 0);
export const RECAP_FRAMES = RECAP_SCENES.reduce((a, s, i) => a + frames(s) - (i > 0 ? trIn(s) : 0), 0);

const timingFor = (i: number): CaptionTiming => {
  const s = RECAP_SCENES[i];
  const next = RECAP_SCENES[i + 1];
  return { enter: i > 0 ? trIn(s) : 0, exitAt: frames(s) - (next ? trIn(next) : 0) - 6, inLen: 9, outLen: 6 };
};

export const TsmcRecap: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <TransitionSeries>
      {RECAP_SCENES.flatMap((s, i) => {
        const t = timingFor(i);
        const Body = s.body;
        const nodes: React.ReactNode[] = [];
        if (i > 0 && s.in) {
          nodes.push(<TransitionSeries.Transition key={`t-${s.id}`} presentation={presentationFor(s.in)} timing={linearTiming({ durationInFrames: trIn(s) })} />);
        }
        nodes.push(
          <TransitionSeries.Sequence key={s.id} durationInFrames={frames(s)}>
            <Body t={t} />
            {s.id !== "end" ? <TopBar text={s.caption} timing={t} /> : null}
          </TransitionSeries.Sequence>
        );
        return nodes;
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
