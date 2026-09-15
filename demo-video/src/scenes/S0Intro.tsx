import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { NavyBackdrop } from "../cards/Interstitial";
import { stage, font } from "../theme";
import { Lang, intro, pick } from "../i18n";
import { fadeUp, pop } from "../util";

const FPS = 30;

export const S0Intro: React.FC<{ lang: Lang }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const eyebrow = fadeUp(frame, 8, 16, 10);
  const line = fadeUp(frame, 34, 20, 16);
  const promise = fadeUp(frame, 168, 18, 14);

  return (
    <NavyBackdrop lang={lang}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 200px" }}>
        {/* eyebrow */}
        <div style={{ fontFamily: font.mono, fontSize: 15, letterSpacing: "0.34em", color: stage.accentBright, textTransform: "uppercase", opacity: eyebrow.opacity, transform: `translateY(${eyebrow.translateY}px)`, marginBottom: 34 }}>
          {pick(intro.eyebrow, lang)}
        </div>

        {/* problem line */}
        <div style={{ fontFamily: font.head, fontSize: 40, fontWeight: 700, color: stage.ink, textAlign: "center", lineHeight: 1.4, letterSpacing: "-0.01em", maxWidth: 1240, opacity: line.opacity, transform: `translateY(${line.translateY}px)` }}>
          {pick(intro.line, lang)}
        </div>

        {/* keyword chips */}
        <div style={{ display: "flex", gap: 18, marginTop: 40 }}>
          {intro.keywords.map((k, i) => {
            const p = pop(frame, 78 + i * 16, FPS);
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 18}px)`, border: `1px solid ${stage.hair}`, background: "rgba(59,130,246,0.06)", padding: "12px 22px", fontFamily: font.body, fontSize: 20, color: stage.ink, fontWeight: 500 }}>
                {pick(k, lang)}
              </div>
            );
          })}
        </div>

        {/* promise */}
        <div style={{ marginTop: 52, fontFamily: font.head, fontSize: 30, fontWeight: 700, color: stage.accentBright, opacity: promise.opacity, transform: `translateY(${promise.translateY}px)` }}>
          {pick(intro.promise, lang)}
        </div>

        {/* 3-part roadmap */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 56 }}>
          {intro.roadmap.map((r, i) => {
            const on = 214 + i * 22;
            const lit = frame >= on;
            const p = fadeUp(frame, on, 14, 8);
            return (
              <React.Fragment key={i}>
                <div style={{ opacity: p.opacity, transform: `translateY(${p.translateY}px)`, padding: "10px 20px", border: `1px solid ${lit ? stage.accent : stage.hair}`, color: lit ? stage.ink : stage.inkFaint, fontFamily: font.mono, fontSize: 15, letterSpacing: "0.04em", background: lit ? "rgba(59,130,246,0.08)" : "transparent" }}>
                  <span style={{ color: stage.accentBright, marginRight: 8 }}>{String(i + 1).padStart(2, "0")}</span>
                  {pick(r, lang)}
                </div>
                {i < intro.roadmap.length - 1 && (
                  <span style={{ color: stage.inkFaint, opacity: interpolate(frame, [on + 8, on + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </AbsoluteFill>
    </NavyBackdrop>
  );
};
