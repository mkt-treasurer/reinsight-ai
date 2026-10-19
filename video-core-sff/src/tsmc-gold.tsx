/**
 * "Core로 본 TSMC 3분기 실적" — ~36s, in the booth film's style (v10): gold on black, one serif
 * headline per scene, Core's answer page pushed back as a blurred stage, one native card in front,
 * a transition on every cut. The thesis is stated first, then four points, then the end card.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { Lockup } from "./Lockup";
import { C, MONO, SANS, SERIF } from "./theme";
import { TRANSITION_FRAMES, TransitionKind } from "./timeline";
import { presentationFor } from "./transitions";
import { Intro } from "./scenes/Intro";
import { AnswerPage } from "./tsmc";
import { CaptionTiming, Card3D, CornerMark, DarkCard3D, Headline, Illustrative, Tag, clamp01, fadeIn, useCount, useEnter } from "./ui";

const FPS = 30;

/* ------------------------------------------------------------------ stage: the answer page, pushed back */

const PageStage: React.FC<{ cy?: number }> = ({ cy = 520 }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 180], [0, -40], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden", perspective: 2000 }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 1480,
          height: 1262,
          transform: `translate(-50%, -50%) translateY(${540 - cy + drift}px) rotateY(-7deg) rotateX(4deg) scale(1.32)`,
          transformOrigin: "50% 50%",
          filter: "brightness(0.32) saturate(0.6) blur(5px)",
        }}
      >
        <AnswerPage frame={100000} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%), linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 32%)" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ scenes */

type TScene = { id: string; dur: number; in?: TransitionKind; tag?: string; nums?: number[]; headline?: string; typed?: boolean; body: React.FC<{ t: CaptionTiming }> };

/** What this is about. */
const Thesis: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const chip = useEnter(t.enter + 4, 16);
  const rule = useEnter(t.enter + 60, 20);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 50%, rgba(212,175,55,0.09), rgba(0,0,0,0) 60%)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 236, display: "flex", justifyContent: "center", opacity: clamp01(chip * 1.4), transform: `translateY(${(1 - chip) * -10}px)` }}>
        <div style={{ padding: "10px 18px", border: `1px solid ${C.goldSoft}`, borderRadius: 4 }}>
          <Tag size={16}>TSMC · 3Q26 · reported Oct 15</Tag>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", fontFamily: SERIF, fontSize: 92, lineHeight: 1.12, color: C.white, padding: "0 200px", textWrap: "balance", opacity: fadeIn(frame, t.enter + 10, 10) }}>
        When earnings land, Core gives the PM the answer first.
      </div>
      <div style={{ position: "absolute", left: "50%", top: 600, width: 280, marginLeft: -140, height: 1, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`, transform: `scaleX(${rule})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 636, textAlign: "center", fontFamily: SERIF, fontSize: 56, fontStyle: "italic", color: C.gold2, opacity: fadeIn(frame, t.enter + 66, 12) }}>
        And makes it an answer you can trust.
      </div>
    </AbsoluteFill>
  );
};

/** Answer first: the bold first sentence, on its own. */
const First: React.FC<{ t: CaptionTiming }> = ({ t }) => (
  <AbsoluteFill>
    <PageStage cy={330} />
    <CornerMark />
    <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center" }}>
      <Card3D delay={t.enter + 4} width={1240} style={{ padding: "36px 44px 34px" }}>
        <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 4, color: "#6b6f7a", textTransform: "uppercase" }}>Core · first sentence of the answer</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: 1.25, color: "#111318", marginTop: 14 }}>
          TSMC beat its 3Q26 guidance and guided 4Q26 sharply higher with margins holding, which supports keeping the long.
        </div>
        <div style={{ fontFamily: SANS, fontSize: 22, color: "#6b6f7a", marginTop: 16 }}>Worked for 45 s · 9 sources</div>
      </Card3D>
    </div>
    <Illustrative />
  </AbsoluteFill>
);

const Cite: React.FC<{ n: number }> = ({ n }) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 24, padding: "0 6px", marginLeft: 6, borderRadius: 5, background: "#4f46e5", color: "#fff", fontFamily: SANS, fontSize: 15, fontWeight: 700, verticalAlign: "2px" }}>{n}</span>
);

/** Point 1: July's forecast and October's result in one table. */
const Connects: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const l1 = useEnter(t.enter + 30, 16);
  const l2 = useEnter(t.enter + 44, 16);
  const rows: [string, string, string, string][] = [
    ["Revenue", "US$44.6–45.8B", "US$46.72B", "Above the range"],
    ["Gross margin", "guided range", "66.4%", "Inside the range"],
    ["Operating margin", "guided range", "printed", "Above the range"],
  ];
  return (
    <AbsoluteFill>
      <PageStage cy={850} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center" }}>
        <Card3D delay={t.enter + 4} width={1280} style={{ padding: "30px 40px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 4, color: "#6b6f7a", textTransform: "uppercase" }}>Guided vs printed · 3Q26</div>
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ padding: "6px 12px", borderRadius: 8, background: "#eef0ff", color: "#4f46e5", fontFamily: SANS, fontSize: 16, fontWeight: 600, opacity: clamp01(l1 * 1.4), transform: `translateY(${(1 - l1) * 8}px)` }}>
                <Cite n={5} /> Jul 17 · guidance report
              </span>
              <span style={{ padding: "6px 12px", borderRadius: 8, background: "#eef0ff", color: "#4f46e5", fontFamily: SANS, fontSize: 16, fontWeight: 600, opacity: clamp01(l2 * 1.4), transform: `translateY(${(1 - l2) * 8}px)` }}>
                <Cite n={3} /> Oct 15 · results release
              </span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 1fr 250px", fontFamily: SANS, fontSize: 23, marginTop: 16, borderTop: "1px solid #e5e7eb" }}>
            {[["Metric", <span key="a">Guidance <Cite n={5} /></span>, <span key="b">Actual <Cite n={3} /></span>, "Result"], ...rows].map((row, r) => (
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
      <Illustrative />
    </AbsoluteFill>
  );
};

/** Point 2: it knows your fund. */
const Fund: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const pos = useCount(8.6, t.enter + 16, (v) => `$${v.toFixed(1)}M`);
  const nav = useCount(3.8, t.enter + 22, (v) => `${v.toFixed(1)}%`);
  const move = useCount(864, t.enter + 28, (v) => `$${Math.round(v)}K`);
  const note = useEnter(t.enter + 50, 16);
  return (
    <AbsoluteFill>
      <PageStage cy={560} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <DarkCard3D delay={t.enter + 4} width={1180} style={{ padding: "34px 40px", border: `1px solid ${C.goldSoft}`, boxShadow: `0 40px 120px rgba(0,0,0,0.75), 0 0 60px ${C.goldGlow}` }}>
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
        <div style={{ width: 1180, fontFamily: SERIF, fontSize: 34, fontStyle: "italic", color: C.white2, textAlign: "center", opacity: clamp01(note * 1.4), transform: `translateY(${(1 - note) * 12}px)` }}>
          A general AI can summarize the release. It doesn't know what you hold.
        </div>
      </div>
      <Illustrative />
    </AbsoluteFill>
  );
};

/** Point 3: it says what it doesn't know. */
const Honest: React.FC<{ t: CaptionTiming }> = ({ t }) => (
  <AbsoluteFill>
    <PageStage cy={1100} />
    <CornerMark />
    <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center" }}>
      <Card3D delay={t.enter + 4} width={1240} style={{ padding: "36px 44px" }}>
        <div style={{ display: "flex", gap: 22 }}>
          <div style={{ width: 4, background: C.gold, borderRadius: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 4, color: "#6b6f7a", textTransform: "uppercase" }}>From the answer</div>
            <div style={{ fontFamily: SANS, fontSize: 36, lineHeight: 1.3, color: "#111318", marginTop: 12 }}>
              "The firm has no internal research note on TSMC, so this answer rests on public filings and the book. <b>Whether to add is up to the PM.</b>"
            </div>
          </div>
        </div>
      </Card3D>
    </div>
    <Illustrative />
  </AbsoluteFill>
);

/** Point 4: every number sourced, and fast. */
const Sourced: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const cited = useCount(9, t.enter + 14, (v) => `${Math.round(v)}`);
  const comp = useCount(2, t.enter + 20, (v) => `${Math.round(v)}`);
  const src = useCount(9, t.enter + 26, (v) => `${Math.round(v)}`);
  const secs = useCount(45, t.enter + 30, (v) => `${Math.round(v)} s`);
  const hl = fadeIn(useCurrentFrame(), t.enter + 52, 10);
  return (
    <AbsoluteFill>
      <PageStage cy={1000} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <div style={{ display: "flex", gap: 22 }}>
          <DarkCard3D delay={t.enter + 4} width={760} style={{ padding: "28px 34px", border: `1px solid ${C.goldSoft}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ width: 40, height: 40, borderRadius: 999, background: C.gold, color: C.black, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 22 }}>✓</span>
              <Tag size={22}>Verified</Tag>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 36, color: C.white, marginTop: 14 }}>
              <b style={{ color: C.gold2 }}>{cited}</b> cited · <b style={{ color: C.gold2 }}>{comp}</b> computed · <b style={{ color: C.gold2 }}>{src}</b> sources
            </div>
          </DarkCard3D>
          <DarkCard3D delay={t.enter + 12} width={400} tiltY={10} style={{ padding: "28px 34px", border: `1px solid ${C.goldSoft}` }}>
            <Tag size={15}>Worked for</Tag>
            <div style={{ fontFamily: SERIF, fontSize: 96, color: C.gold2, lineHeight: 1, marginTop: 10 }}>{secs}</div>
          </DarkCard3D>
        </div>
        <Card3D delay={t.enter + 36} width={1182} tiltY={0} style={{ padding: "22px 30px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: "#6b6f7a", textTransform: "uppercase" }}>
            <Cite n={3} /> Public · 3Q26 earnings release · investor.tsmc.com
          </div>
          <div style={{ fontFamily: SANS, fontSize: 24, lineHeight: 1.4, color: "#2a2e38", marginTop: 10 }}>
            TSMC today announced consolidated revenue of{" "}
            <span style={{ background: `rgba(212,175,55,${0.35 * hl})`, borderRadius: 3, padding: "0 2px" }}>US$46.72 billion, up 16.2% from the previous quarter and 41.2% from a year earlier</span>, for the third quarter ended September 30, 2026.
          </div>
        </Card3D>
      </div>
      <Illustrative />
    </AbsoluteFill>
  );
};

/** End card. */
const End: React.FC<{ t: CaptionTiming }> = ({ t }) => {
  const frame = useCurrentFrame();
  const head = useEnter(t.enter + 2, 16);
  const lock = useEnter(t.enter + 16, 14);
  const btn = useEnter(t.enter + 30, 14);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 45%, rgba(212,175,55,0.12), rgba(0,0,0,0) 60%)` }} />
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

const IntroBody: React.FC<{ t: CaptionTiming }> = () => <Intro />;

export const GOLD_SCENES: TScene[] = [
  { id: "intro", dur: 2.0, body: IntroBody },
  { id: "thesis", dur: 5.0, in: "fade", body: Thesis },
  { id: "first", dur: 5.4, in: "goldwipe", tag: "Answer first", headline: "The first sentence is the call.", body: First },
  { id: "connects", dur: 5.6, in: "slide", tag: "It connects the documents", nums: [1], headline: "July's forecast, October's result. One table.", body: Connects },
  { id: "fund", dur: 5.4, in: "wipe", tag: "It knows your fund", nums: [2], headline: "Not just the company. Your position.", body: Fund },
  { id: "honest", dur: 5.0, in: "goldwipe", tag: "It says what it doesn't know", nums: [3], headline: "No internal note on TSMC. The call stays with the PM.", body: Honest },
  { id: "sourced", dur: 5.6, in: "slideup", tag: "Every number sourced", nums: [4], headline: "Click a number, see the sentence. All in 45 seconds.", body: Sourced },
  { id: "end", dur: 4.0, in: "fade", body: End },
];

const frames = (s: TScene) => Math.round(s.dur * FPS);
const trIn = (s: TScene) => (s.in ? TRANSITION_FRAMES[s.in] : 0);
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
            {s.headline ? <Headline tag={s.tag} nums={s.nums} text={s.headline} timing={t} /> : null}
          </TransitionSeries.Sequence>
        );
        return nodes;
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
