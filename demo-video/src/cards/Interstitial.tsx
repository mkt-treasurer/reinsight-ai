import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { stage, font } from "../theme";
import { brand, pick, Lang } from "../i18n";
import { fadeUp } from "../util";

// Shared dark-navy backdrop (wordmark + confidential), reused by every full-screen card.
export const NavyBackdrop: React.FC<{ lang: Lang; children: React.ReactNode }> = ({ lang, children }) => {
  const frame = useCurrentFrame();
  const intro = fadeUp(frame, 0, 14, 8);
  return (
    <AbsoluteFill style={{ backgroundColor: stage.bg, fontFamily: font.body }}>
      <AbsoluteFill style={{ background: `radial-gradient(1100px 620px at 50% 46%, ${stage.glow}, transparent 70%)` }} />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${stage.grid} 1px, transparent 1px), linear-gradient(90deg, ${stage.grid} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(1200px 700px at 50% 50%, #000 55%, transparent 100%)",
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(1500px 900px at 50% 50%, transparent 55%, ${stage.bgDeep} 100%)` }} />
      <div style={{ position: "absolute", top: 44, left: 64, display: "flex", alignItems: "center", gap: 14, opacity: intro.opacity }}>
        <div style={{ width: 10, height: 10, background: stage.accent, transform: "rotate(45deg)" }} />
        <span style={{ fontFamily: font.head, fontWeight: 800, fontSize: 22, letterSpacing: "0.42em", color: stage.ink }}>{brand.wordmark}</span>
      </div>
      <div style={{ position: "absolute", bottom: 42, left: 64, fontFamily: font.mono, fontSize: 12, letterSpacing: "0.28em", color: stage.inkFaint, opacity: intro.opacity }}>
        {pick(brand.confidential, lang)}
      </div>
      <div style={{ position: "absolute", bottom: 42, right: 64, fontFamily: font.mono, fontSize: 12, letterSpacing: "0.24em", color: stage.inkFaint, opacity: intro.opacity }}>
        {brand.site}
      </div>
      {children}
    </AbsoluteFill>
  );
};

// Part title card: big kicker + title + sub.
export const PartTitleCard: React.FC<{ lang: Lang; kicker: string; title: string; sub: string }> = ({ lang, kicker, title, sub }) => {
  const frame = useCurrentFrame();
  const a = fadeUp(frame, 4, 16, 18);
  const bar = interpolate(frame, [8, 24], [0, 96], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <NavyBackdrop lang={lang}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center", opacity: a.opacity, transform: `translateY(${a.translateY}px)` }}>
          <div style={{ fontFamily: font.mono, fontSize: 16, letterSpacing: "0.4em", color: stage.accentBright, textTransform: "uppercase", marginBottom: 22 }}>{kicker}</div>
          <div style={{ fontFamily: font.head, fontSize: 68, fontWeight: 800, color: stage.ink, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{title}</div>
          <div style={{ width: bar, height: 3, background: stage.accent, margin: "26px auto" }} />
          <div style={{ fontSize: 22, color: stage.inkMuted, fontWeight: 500 }}>{sub}</div>
        </div>
      </AbsoluteFill>
    </NavyBackdrop>
  );
};

// Feature intro card: numbered, left-aligned, with a progress ratio.
export const FeatureCard: React.FC<{ lang: Lang; no: string; title: string; sub: string }> = ({ lang, no, title, sub }) => {
  const frame = useCurrentFrame();
  const a = fadeUp(frame, 4, 16, 20);
  const line = interpolate(frame, [10, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <NavyBackdrop lang={lang}>
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 180 }}>
        <div style={{ opacity: a.opacity, transform: `translateY(${a.translateY}px)`, maxWidth: 1200 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
            <span style={{ fontFamily: font.mono, fontSize: 40, fontWeight: 700, color: stage.accent, letterSpacing: "0.04em" }}>{no}</span>
            <div style={{ width: line * 120, height: 2, background: stage.accentDeep, alignSelf: "center" }} />
            <span style={{ fontFamily: font.mono, fontSize: 13, letterSpacing: "0.28em", color: stage.inkFaint, textTransform: "uppercase" }}>FEATURE</span>
          </div>
          <div style={{ fontFamily: font.head, fontSize: 58, fontWeight: 800, color: stage.ink, letterSpacing: "-0.02em", marginTop: 18 }}>{title}</div>
          <div style={{ fontSize: 24, color: stage.inkMuted, marginTop: 16, fontWeight: 500 }}>{sub}</div>
        </div>
      </AbsoluteFill>
    </NavyBackdrop>
  );
};
