/**
 * Stand-alone scenes and text overlays, each rendered to its own MP4 (see scripts/render-clips.mjs).
 * Same style system as the main film: black, gold accents, serif captions, typewriter text,
 * glowing number cards over blurred UI, count-up numbers.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Lockup } from "./Lockup";
import { C, MONO, SANS, SERIF } from "./theme";
import { Scene } from "./timeline";
import { Backdrop, Big, Label, PromptBox } from "./scenes/Beats";
import { CornerMark, Headline, Illustrative, Tag, clamp01, fadeIn, useCount, useEnter, useTyped } from "./ui";

const NO_EXIT = { enter: 0, exitAt: 100000 };
const bg = (from: number, to: number): Scene => ({ id: "clip", kind: "beat", from, to });

/** Soft gold glow used on the native (non-footage) scenes. */
const Glow: React.FC<{ y?: string; a?: number }> = ({ y = "55%", a = 0.1 }) => (
  <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% ${y}, rgba(212,175,55,${a}), rgba(0,0,0,0) 60%)` }} />
);

/* ------------------------------------------------------------------ 02_question (2s) */

export const QuestionClip: React.FC = () => {
  const frame = useCurrentFrame();
  const t = useTyped("Did your team see it coming?", 4, 32);
  const rule = useEnter(2, 20);
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Glow />
      <div style={{ position: "absolute", left: "50%", top: 430, width: 240, marginLeft: -120, height: 1, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`, transform: `scaleX(${rule})` }} />
      <div style={{ position: "absolute", left: 160, right: 160, top: 470, textAlign: "center", fontFamily: SERIF, fontSize: 96, color: C.white, lineHeight: 1.1, opacity: fadeIn(frame, 2, 6) }}>
        {t.shown}
        {!t.done ? <span style={{ display: "inline-block", width: 4, height: 76, background: C.gold, marginLeft: 10, verticalAlign: "-0.1em", opacity: t.cursor ? 1 : 0.2 }} /> : null}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 05_typing (2s) */

export const TypingClip: React.FC = () => (
  <AbsoluteFill>
    <Backdrop scene={bg(9.4, 11.4)} />
    <CornerMark />
    <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center" }}>
      <PromptBox label="Core · Ask" delay={2} text="Build a guidance tracker for NVDA" />
    </div>
    <Illustrative />
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ 06_numbers (8s) */

const NumberCard: React.FC<{ delay: number; big: string; label: string; width?: number; tiltY?: number }> = ({ delay, big, label, width = 560, tiltY = 0 }) => {
  const e = useEnter(delay, 15);
  const frame = useCurrentFrame();
  const pulse = 0.75 + 0.25 * Math.sin((frame - delay) / 6);
  return (
    <div
      style={{
        width,
        padding: "34px 38px 32px",
        background: "#0f1014",
        border: `1px solid ${C.goldSoft}`,
        borderRadius: 18,
        boxShadow: `0 40px 120px rgba(0,0,0,0.75), 0 0 ${50 * pulse}px ${C.goldGlow}`,
        opacity: clamp01(e * 1.4),
        transform: `perspective(1800px) rotateX(${(1 - e) * 18}deg) rotateY(${(1 - e) * tiltY}deg) translateY(${(1 - e) * 70}px) scale(${0.94 + 0.06 * e})`,
        transformOrigin: "50% 60%",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Big color={C.gold2} size={92}>{big}</Big>
      <div style={{ fontFamily: SANS, fontSize: 27, color: C.white, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
};

export const NumbersClip: React.FC = () => {
  const D = [6, 72, 140]; // 0.2s, 2.4s, 4.7s
  const beat = useCount(4, D[0] + 4, (v) => `${Math.round(v)} of 4`);
  const low = useCount(1.9, D[1] + 4, (v) => `${v.toFixed(1)}% low`);
  const guide = useCount(108, D[2] + 4, (v) => `$${Math.round(v)}B`);
  const ours = useCount(113, D[2] + 10, (v) => `$${Math.round(v)}B`);
  return (
    <AbsoluteFill>
      <Backdrop scene={bg(14.0, 22.0)} />
      <CornerMark />
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, display: "flex", justifyContent: "center", gap: 28 }}>
        <NumberCard delay={D[0]} big={beat} label="NVIDIA beat its promise every quarter" tiltY={-12} />
        <NumberCard delay={D[1]} big={low} label="Our team's guesses ran a little short" />
        <NumberCard delay={D[2]} big={`${guide} vs ${ours}`} label="NVIDIA's next promise vs our guess" tiltY={12} />
      </div>
      <Illustrative />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 07_trust (3s) */

export const TrustClip: React.FC = () => {
  const frame = useCurrentFrame();
  const card = useEnter(34, 15);
  const cited = useCount(21, 38, (v) => `${Math.round(v)}`);
  const sources = useCount(15, 42, (v) => `${Math.round(v)}`);
  const check = useEnter(40, 12);
  return (
    <AbsoluteFill>
      <Backdrop scene={bg(39.6, 42.6)} />
      <CornerMark />
      <Headline text="It even caught a wrong transcript." typed timing={{ enter: 2, exitAt: 100000 }} size={80} cps={36} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 470,
          display: "flex",
          justifyContent: "center",
          opacity: clamp01(card * 1.4),
          transform: `translateY(${(1 - card) * 50}px) scale(${0.94 + 0.06 * card})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 30,
            padding: "28px 40px",
            background: "#0f1014",
            border: `1px solid ${C.goldSoft}`,
            borderRadius: 18,
            boxShadow: `0 40px 120px rgba(0,0,0,0.75), 0 0 ${40 + 14 * Math.sin(frame / 5)}px ${C.goldGlow}`,
          }}
        >
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: C.gold,
              color: C.black,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 36,
              transform: `scale(${check})`,
              boxShadow: `0 0 24px ${C.goldGlow}`,
            }}
          >
            ✓
          </span>
          <Tag size={26}>Verified</Tag>
          <span style={{ width: 1, height: 44, background: C.goldSoft }} />
          <span style={{ fontFamily: SANS, fontSize: 40, color: C.white }}>
            <span style={{ fontWeight: 700, color: C.gold2 }}>{cited}</span> cited
            <span style={{ color: C.white3, margin: "0 18px" }}>·</span>
            <span style={{ fontWeight: 700, color: C.gold2 }}>{sources}</span> sources
          </span>
        </div>
      </div>
      <Illustrative />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 09_endcard (3.5s) */

export const EndCardClip: React.FC = () => {
  const frame = useCurrentFrame();
  const head = useEnter(2, 16);
  const lock = useEnter(16, 14);
  const btn = useEnter(30, 14);
  const url = fadeIn(frame, 40, 10);
  const sweep = interpolate(frame, [34, 70], [-50, 150], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.black }}>
      <Glow y="45%" a={0.12} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, textAlign: "center", fontFamily: SERIF, fontSize: 150, color: C.white, lineHeight: 1, opacity: clamp01(head * 1.3), transform: `translateY(${(1 - head) * 20}px)` }}>
        Ask. It’s done.
      </div>
      <div style={{ position: "absolute", left: "50%", top: 500, transform: `translateX(-50%) scale(${0.9 + 0.1 * lock})`, opacity: clamp01(lock * 1.3) }}>
        <div style={{ position: "relative" }}>
          <Lockup size={64} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              WebkitMaskImage: `linear-gradient(100deg, rgba(0,0,0,0) ${sweep - 22}%, #000 ${sweep}%, rgba(0,0,0,0) ${sweep + 22}%)`,
              maskImage: `linear-gradient(100deg, rgba(0,0,0,0) ${sweep - 22}%, #000 ${sweep}%, rgba(0,0,0,0) ${sweep + 22}%)`,
            }}
          >
            <Lockup size={64} color={C.gold2} subColor={C.gold2} dot={C.white} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 720, display: "flex", justifyContent: "center", opacity: clamp01(btn * 1.3), transform: `translateY(${(1 - btn) * 16}px)` }}>
        <div style={{ padding: "18px 44px", borderRadius: 999, background: C.gold, color: C.black, fontFamily: SANS, fontWeight: 700, fontSize: 30, boxShadow: `0 0 ${30 + 10 * Math.sin(frame / 5)}px ${C.goldGlow}` }}>
          Request demo
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 820, textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: 5, color: C.white2, opacity: url }}>
        treasurer.net/core
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ overlays: text only on pure black */

export const OverlayHook: React.FC = () => {
  const t = useTyped("NVIDIA beat its own forecast 4 quarters in a row.", 2, 40);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div style={{ position: "absolute", left: 120, right: 120, top: 440, textAlign: "center", fontFamily: SERIF, fontSize: 88, color: C.white, lineHeight: 1.12, textWrap: "balance" }}>
        {t.shown}
        {!t.done ? <span style={{ display: "inline-block", width: 4, height: 70, background: C.gold, marginLeft: 10, verticalAlign: "-0.1em", opacity: t.cursor ? 1 : 0.2 }} /> : null}
      </div>
    </AbsoluteFill>
  );
};

const Phrase: React.FC<{ text: string; delay: number; gold?: boolean }> = ({ text, delay, gold }) => {
  const e = useEnter(delay, 16);
  return (
    <span style={{ display: "inline-block", opacity: clamp01(e * 1.4), transform: `translateY(${(1 - e) * 22}px)`, color: gold ? C.gold2 : C.white, marginRight: 28 }}>{text}</span>
  );
};

export const OverlayProblem: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <div style={{ position: "absolute", left: 120, right: 120, top: 450, textAlign: "center", fontFamily: SERIF, fontSize: 92, lineHeight: 1.15 }}>
      <Phrase text="Every report." delay={2} />
      <Phrase text="Every old note." delay={14} />
      <Phrase text="All by hand." delay={28} gold />
    </div>
  </AbsoluteFill>
);

/** Registered in Root.tsx; the file name is what scripts/render-clips.mjs writes. */
export const CLIPS: { id: string; file: string; seconds: number; component: React.FC }[] = [
  { id: "c02-question", file: "02_question.mp4", seconds: 2, component: QuestionClip },
  { id: "c05-typing", file: "05_typing.mp4", seconds: 2, component: TypingClip },
  { id: "c06-numbers", file: "06_numbers.mp4", seconds: 8, component: NumbersClip },
  { id: "c07-trust", file: "07_trust.mp4", seconds: 3, component: TrustClip },
  { id: "c09-endcard", file: "09_endcard.mp4", seconds: 3.5, component: EndCardClip },
  { id: "overlay-hook", file: "overlay_hook.mp4", seconds: 2, component: OverlayHook },
  { id: "overlay-problem", file: "overlay_problem.mp4", seconds: 2, component: OverlayProblem },
];
