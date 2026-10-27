import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MONO, SERIF } from "./theme";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const fadeIn = (frame: number, start: number, len: number) =>
  interpolate(frame, [start, start + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Spring that starts at `delay` frames; 0→1. */
export const useEnter = (delay: number, damping = 16) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 140, mass: 0.8 } });
};

/** Typewriter: how much of `text` is visible at this frame, plus a blinking cursor flag. */
export const useTyped = (text: string, start: number, cps = 22) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = Math.max(0, Math.floor(((frame - start) / fps) * cps));
  const done = chars >= text.length;
  const cursor = Math.floor(frame / 8) % 2 === 0;
  return { shown: text.slice(0, chars), done, cursor, started: frame >= start };
};

/** Number counting up from 0 to `to` on a spring, formatted by `fmt`. */
export const useCount = (to: number, delay: number, fmt: (v: number) => string) => {
  const e = useEnter(delay, 30);
  return fmt(to * e);
};

/** Gold mono tag. */
export const Tag: React.FC<{ children: React.ReactNode; size?: number; color?: string }> = ({ children, size = 17, color = C.gold }) => (
  <span
    style={{
      fontFamily: MONO,
      fontSize: size,
      letterSpacing: 5,
      color,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

/** Gold numbered circle, the same one used in the PM message. */
export const NumCircle: React.FC<{ n: number; size?: number }> = ({ n, size = 36 }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: C.gold,
      color: C.black,
      fontFamily: MONO,
      fontSize: size * 0.53,
      fontWeight: 700,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 0 18px ${C.goldGlow}`,
      flexShrink: 0,
    }}
  >
    {n}
  </span>
);

/** "① ANSWER" style label: numbered circles + 28px gold mono text. */
export const TagRow: React.FC<{ tag: string; nums?: number[]; size?: number }> = ({ tag, nums, size = 28 }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
    {nums?.map((n) => (
      <NumCircle key={n} n={n} size={size * 1.3} />
    ))}
    <Tag size={size}>{tag}</Tag>
  </div>
);

export type CaptionTiming = { enter: number; exitAt: number; inLen?: number; outLen?: number };

/**
 * One serif headline at the top of a scene, with a label above it.
 * Fades in over `inLen` (0.3s) starting at `enter`, and fades out over `outLen` (0.2s) at `exitAt`,
 * so captions of neighbouring scenes never overlap. Optionally typed.
 */
export const Headline: React.FC<{
  tag?: string;
  nums?: number[];
  text: string;
  typed?: boolean;
  timing: CaptionTiming;
  size?: number;
  cps?: number;
}> = ({ tag, nums, text, typed = false, timing, size = 70, cps = 30 }) => {
  const frame = useCurrentFrame();
  const { enter, exitAt, inLen = 9, outLen = 6 } = timing;
  const inA = fadeIn(frame, enter, inLen);
  const outA = 1 - fadeIn(frame, exitAt, outLen);
  const rise = (1 - inA) * 14;
  const t = useTyped(text, enter + 3, cps);
  const body = typed ? t.shown : text;
  return (
    <div
      style={{
        position: "absolute",
        left: 160,
        right: 160,
        top: 84,
        textAlign: "center",
        opacity: inA * outA,
        transform: `translateY(${rise}px)`,
      }}
    >
      {tag ? (
        <div style={{ marginBottom: 18 }}>
          <TagRow tag={tag} nums={nums} />
        </div>
      ) : null}
      <div
        style={{
          fontFamily: SERIF,
          fontSize: size,
          lineHeight: 1.12,
          color: C.white,
          textShadow: "0 4px 40px rgba(0,0,0,0.8)",
          maxWidth: 1400,
          margin: "0 auto",
          textWrap: "balance",
        }}
      >
        {body}
        {typed && !t.done ? (
          <span style={{ display: "inline-block", width: 3, height: size * 0.8, background: C.gold, marginLeft: 8, verticalAlign: "-0.1em", opacity: t.cursor ? 1 : 0.2 }} />
        ) : null}
      </div>
    </div>
  );
};

/** Small corner lockup so the brand is on screen during footage. */
export const CornerMark: React.FC = () => (
  <div style={{ position: "absolute", left: 84, top: 56, display: "flex", alignItems: "center", gap: 12 }}>
    <span style={{ width: 9, height: 9, background: C.gold, transform: "rotate(45deg)", display: "inline-block" }} />
    <Tag size={15}>Core by Treasurer</Tag>
  </div>
);

export const Illustrative: React.FC = () => (
  <div
    style={{
      position: "absolute",
      right: 40,
      bottom: 32,
      fontFamily: MONO,
      fontSize: 18,
      letterSpacing: 1,
      color: C.white,
      opacity: 0.4,
    }}
  >
    Illustrative data
  </div>
);

/** 3D card wrapper: flies in from below with a perspective tilt that settles flat. */
export const Card3D: React.FC<{
  delay: number;
  width: number;
  children: React.ReactNode;
  tiltX?: number;
  tiltY?: number;
  style?: React.CSSProperties;
}> = ({ delay, width, children, tiltX = 18, tiltY = -10, style }) => {
  const e = useEnter(delay, 15);
  const frame = useCurrentFrame();
  const idleY = Math.sin((frame - delay) / 22) * 1.2; // gentle float once settled
  return (
    <div
      style={{
        width,
        opacity: clamp01(e * 1.4),
        transform: `perspective(1800px) rotateX(${(1 - e) * tiltX}deg) rotateY(${(1 - e) * tiltY + idleY}deg) translateY(${(1 - e) * 70}px) scale(${0.94 + 0.06 * e})`,
        transformOrigin: "50% 60%",
        background: "#ffffff",
        color: "#111318",
        borderRadius: 18,
        boxShadow: `0 40px 120px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px ${C.goldDim}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Dark card variant for the chat / check UI. */
export const DarkCard3D: React.FC<React.ComponentProps<typeof Card3D>> = (p) => (
  <Card3D {...p} style={{ background: C.ink2, color: C.white, border: `1px solid ${C.line}`, ...p.style }} />
);
