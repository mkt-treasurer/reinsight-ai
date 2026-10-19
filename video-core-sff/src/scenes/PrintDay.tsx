import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, MONO, SANS } from "../theme";
import { CaptionTiming, Headline, NumCircle, Tag, clamp01, fadeIn, useEnter } from "../ui";

const QUESTIONS = ["What did we have for Q3?", "And were we right last quarter?", "Also this GB300 thing on X, real?"];

const Question: React.FC<{ n: number; text: string; delay: number }> = ({ n, text, delay }) => {
  const e = useEnter(delay, 15);
  const underline = useEnter(delay + 6, 22);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: clamp01(e * 1.4), transform: `translateX(${(1 - e) * 30}px)` }}>
      <span style={{ display: "inline-flex", transform: `scale(${0.6 + 0.4 * e})` }}>
        <NumCircle n={n} />
      </span>
      <span style={{ position: "relative", fontFamily: SANS, fontSize: 42, color: C.white, lineHeight: 1.2 }}>
        {text}
        <span style={{ position: "absolute", left: 0, right: 0, bottom: -4, height: 3, background: C.gold, opacity: 0.7, transform: `scaleX(${underline})`, transformOrigin: "left" }} />
      </span>
    </div>
  );
};

/** 7:10 am. Print day. The PM has three questions; all three stay up for 3s+. */
export const PrintDay: React.FC<{ timing: CaptionTiming }> = ({ timing }) => {
  const frame = useCurrentFrame();
  const card = useEnter(6, 15);
  const line1 = fadeIn(frame, 10, 8);
  const tick = Math.floor(frame / 30) % 60;
  const clock = `7:10:${String(tick).padStart(2, "0")} AM`;
  const banner = useEnter(10, 18);
  const vignette = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 60%, rgba(212,175,55,0.08), rgba(0,0,0,0) 60%)`, opacity: vignette }} />

      <div style={{ position: "absolute", left: 84, top: 56, display: "flex", alignItems: "center", gap: 14, opacity: fadeIn(frame, 0, 10) }}>
        <span style={{ width: 9, height: 9, background: C.gold, transform: "rotate(45deg)", display: "inline-block" }} />
        <span style={{ fontFamily: MONO, fontSize: 17, letterSpacing: 4, color: C.gold }}>{clock}</span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 84,
          top: 50,
          padding: "8px 16px",
          border: `1px solid ${C.goldSoft}`,
          borderRadius: 4,
          opacity: clamp01(banner * 1.3),
          transform: `translateY(${(1 - banner) * -10}px)`,
        }}
      >
        <Tag size={15}>Before the numbers drop</Tag>
      </div>

      <Headline text="7:10 am. Print day. The PM has three questions." typed timing={timing} size={76} cps={34} />

      {/* chat card, flown in with a perspective tilt */}
      <div
        style={{
          position: "absolute",
          left: 320,
          right: 320,
          top: 360,
          padding: "40px 44px 44px",
          background: C.ink2,
          border: `1px solid ${C.line}`,
          borderLeft: `3px solid ${C.gold}`,
          borderRadius: 14,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          opacity: clamp01(card * 1.3),
          transform: `perspective(1800px) rotateX(${(1 - card) * 22}deg) translateY(${(1 - card) * 60}px) scale(${0.95 + 0.05 * card})`,
          transformOrigin: "50% 80%",
        }}
      >
        <div style={{ display: "flex", gap: 22 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${C.gold}, #8a6d1c)`,
              color: C.black,
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            PM
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, fontFamily: SANS }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: C.white }}>Portfolio manager</span>
              <span style={{ fontSize: 20, color: C.white3 }}>7:10 AM · #nvda-desk</span>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 40, color: C.white, opacity: line1 }}>NVDA prints tonight.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 6 }}>
              {QUESTIONS.map((q, i) => (
                <Question key={i} n={i + 1} text={q} delay={16 + i * 9} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
