import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { stage, font } from "../theme";
import { fadeUp } from "../util";
import { PHASES, Phase } from "./salesData";

const DISCLAIMER = "본 영상의 기업 · 인물 및 수치는 이해를 돕기 위한 가상 데이터입니다";

/**
 * Dark-navy TREASURER stage for the sales/settlement concept film.
 * Differs from the settlement-demo `Stage` in three ways required by 기획안 §2:
 *   1. a permanent "Concept Demo · 가상 데이터" disclaimer,
 *   2. a Discover → Connect → Place → Reconcile phase rail instead of dots,
 *   3. an optional "추가 개발 가능 기능" badge for unbuilt modules.
 */
export const SalesStage: React.FC<{
  children: React.ReactNode;
  phase?: Phase;
  /** Chrome-free mode for the opening/ending cards. */
  bare?: boolean;
}> = ({ children, phase, bare = false }) => {
  const frame = useCurrentFrame();
  const intro = fadeUp(frame, 2, 20, 12);

  return (
    <AbsoluteFill style={{ backgroundColor: stage.bg, fontFamily: font.body }}>
      <AbsoluteFill
        style={{ background: `radial-gradient(1100px 620px at 50% 44%, ${stage.glow}, transparent 70%)` }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${stage.grid} 1px, transparent 1px), linear-gradient(90deg, ${stage.grid} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(1200px 700px at 50% 46%, #000 55%, transparent 100%)",
        }}
      />
      <AbsoluteFill
        style={{ background: `radial-gradient(1500px 900px at 50% 50%, transparent 55%, ${stage.bgDeep} 100%)` }}
      />

      {/* masthead — wordmark + permanent concept-demo tag */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 64,
          right: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: intro.opacity,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 10, height: 10, background: stage.accent, transform: "rotate(45deg)" }} />
          <span
            style={{
              fontFamily: font.head,
              fontWeight: 800,
              fontSize: 21,
              letterSpacing: "0.42em",
              color: stage.ink,
            }}
          >
            TREASURER
          </span>
          <span style={{ width: 1, height: 16, background: stage.hair, margin: "0 4px" }} />
          <span
            style={{
              fontFamily: font.head,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.26em",
              color: stage.accentBright,
            }}
          >
            INS
          </span>
        </div>
        <span
          style={{
            fontFamily: font.mono,
            fontSize: 11,
            letterSpacing: "0.24em",
            color: stage.inkMuted,
            border: `1px solid ${stage.hair}`,
            padding: "5px 12px",
            textTransform: "uppercase",
          }}
        >
          Treasurer INS Concept Demo
        </span>
      </div>

      {/* content */}
      <AbsoluteFill style={{ padding: bare ? "104px 64px 104px" : "112px 64px 104px" }}>{children}</AbsoluteFill>

      {/* footer — disclaimer + phase rail + site */}
      <div
        style={{
          position: "absolute",
          bottom: 38,
          left: 64,
          right: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 40,
          opacity: intro.opacity,
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontFamily: font.body,
            fontSize: 12,
            letterSpacing: "0.02em",
            color: stage.inkFaint,
            flex: "0 1 auto",
          }}
        >
          {DISCLAIMER}
        </span>

        {phase && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
            {PHASES.map((p, i) => {
              const active = p === phase;
              return (
                <React.Fragment key={p}>
                  <span
                    style={{
                      fontFamily: font.mono,
                      fontSize: 11,
                      letterSpacing: "0.2em",
                      color: active ? stage.ink : stage.inkFaint,
                      borderBottom: `2px solid ${active ? stage.accent : "transparent"}`,
                      paddingBottom: 3,
                    }}
                  >
                    {p}
                  </span>
                  {i < PHASES.length - 1 && (
                    <span style={{ color: stage.inkFaint, fontSize: 10, opacity: 0.6 }}>›</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        <span
          style={{
            fontFamily: font.mono,
            fontSize: 12,
            letterSpacing: "0.24em",
            color: stage.inkFaint,
            flex: "0 0 auto",
          }}
        >
          insightre.ai
        </span>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Screen-name plate that sits above the product window and names the module.
 * `proposed` renders the 기획안-mandated "추가 개발 가능 기능" badge so an
 * unbuilt module never reads as a shipping feature.
 */
export const ScreenPlate: React.FC<{
  code: string;
  ko: string;
  start?: number;
  proposed?: boolean;
}> = ({ code, ko, start = 2, proposed = true }) => {
  const frame = useCurrentFrame();
  const a = fadeUp(frame, start, 16, 12);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 18,
        opacity: a.opacity,
        transform: `translateY(${a.translateY}px)`,
      }}
    >
      <div style={{ width: 3, height: 30, background: stage.accent }} />
      <span
        style={{
          fontFamily: font.head,
          fontSize: 25,
          fontWeight: 800,
          color: stage.ink,
          letterSpacing: "0.01em",
        }}
      >
        {code}
      </span>
      <span style={{ fontSize: 17, color: stage.inkMuted, fontWeight: 500 }}>{ko}</span>
      {proposed && (
        <span
          style={{
            marginLeft: "auto",
            fontFamily: font.mono,
            fontSize: 10,
            letterSpacing: "0.18em",
            color: stage.amber,
            border: `1px solid ${stage.amber}`,
            padding: "4px 10px",
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          Proposed Extension Module · 추가 개발 가능 기능
        </span>
      )}
    </div>
  );
};

/** Bottom narration line, matching the settlement film's caption grammar. */
export const SalesCaption: React.FC<{ text: string; start?: number }> = ({ text, start = 14 }) => {
  const frame = useCurrentFrame();
  const a = fadeUp(frame, start, 20, 14);
  return (
    <div
      style={{
        position: "absolute",
        bottom: 82,
        left: 64,
        right: 64,
        display: "flex",
        justifyContent: "center",
        opacity: a.opacity,
        transform: `translateY(${a.translateY}px)`,
        zIndex: 15,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 13, maxWidth: 1240 }}>
        <div style={{ width: 3, height: 22, background: stage.accent, flex: "0 0 auto" }} />
        <span
          style={{
            fontFamily: font.body,
            fontSize: 21,
            fontWeight: 500,
            color: stage.ink,
            letterSpacing: "-0.01em",
            lineHeight: 1.35,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
