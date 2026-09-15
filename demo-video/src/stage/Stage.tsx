import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { stage, font, WIDTH } from "../theme";
import { brand, pick, Lang } from "../i18n";
import { fadeUp } from "../util";

// Dark-navy TREASURER stage: grid texture, blue glow, wordmark, confidential.
export const Stage: React.FC<{
  lang: Lang;
  children: React.ReactNode;
  sceneIndex: number;
  sceneCount: number;
}> = ({ lang, children, sceneIndex, sceneCount }) => {
  const frame = useCurrentFrame();
  const intro = fadeUp(frame, 2, 20, 12);

  return (
    <AbsoluteFill style={{ backgroundColor: stage.bg, fontFamily: font.body }}>
      {/* radial glow behind content */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 620px at 50% 44%, ${stage.glow}, transparent 70%)`,
        }}
      />
      {/* faint grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${stage.grid} 1px, transparent 1px), linear-gradient(90deg, ${stage.grid} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(1200px 700px at 50% 46%, #000 55%, transparent 100%)",
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(1500px 900px at 50% 50%, transparent 55%, ${stage.bgDeep} 100%)`,
        }}
      />

      {/* masthead: wordmark + product tag */}
      <div
        style={{
          position: "absolute",
          top: 44,
          left: 64,
          right: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: intro.opacity,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 10, height: 10, background: stage.accent, transform: "rotate(45deg)" }} />
          <span
            style={{
              fontFamily: font.head,
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: "0.42em",
              color: stage.ink,
            }}
          >
            {brand.wordmark}
          </span>
        </div>
        <span
          style={{
            fontFamily: font.mono,
            fontSize: 13,
            letterSpacing: "0.24em",
            color: stage.inkMuted,
            textTransform: "uppercase",
          }}
        >
          {pick(brand.product, lang)}
        </span>
      </div>

      {/* content */}
      <AbsoluteFill style={{ padding: "112px 64px 96px" }}>{children}</AbsoluteFill>

      {/* footer: confidential + progress + site */}
      <div
        style={{
          position: "absolute",
          bottom: 42,
          left: 64,
          right: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: intro.opacity,
        }}
      >
        <span
          style={{
            fontFamily: font.mono,
            fontSize: 12,
            letterSpacing: "0.28em",
            color: stage.inkFaint,
          }}
        >
          {pick(brand.confidential, lang)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {Array.from({ length: sceneCount }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === sceneIndex ? 26 : 8,
                height: 4,
                borderRadius: 2,
                background: i === sceneIndex ? stage.accent : stage.inkFaint,
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>
        <span style={{ fontFamily: font.mono, fontSize: 12, letterSpacing: "0.24em", color: stage.inkFaint }}>
          {brand.site}
        </span>
      </div>
    </AbsoluteFill>
  );
};
