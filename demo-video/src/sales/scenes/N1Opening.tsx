import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { SalesStage } from "../SalesStage";
import { stage, font } from "../../theme";
import { fadeUp } from "../../util";
import { opening } from "../salesData";

// 0–7s. Two-beat statement, then the logo lockup.
export const N1Opening: React.FC = () => {
  const frame = useCurrentFrame();

  const a = fadeUp(frame, 6, 18, 16);
  const b = fadeUp(frame, 52, 18, 16);
  // first statement recedes as the turn lands
  const fadeOutA = interpolate(frame, [52, 70], [1, 0.22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logo = fadeUp(frame, 118, 20, 14);
  const rule = interpolate(frame, [124, 148], [0, 320], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SalesStage bare>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 180px" }}>
        {/* beat 1 — the wrong premise */}
        <div
          style={{
            textAlign: "center",
            opacity: a.opacity * fadeOutA,
            transform: `translateY(${a.translateY}px)`,
          }}
        >
          {opening.lines.map((l, i) => (
            <div
              key={i}
              style={{
                fontFamily: font.head,
                fontSize: 40,
                fontWeight: 700,
                color: stage.inkMuted,
                lineHeight: 1.45,
                letterSpacing: "-0.01em",
              }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* beat 2 — the turn */}
        <div
          style={{
            textAlign: "center",
            marginTop: 34,
            opacity: b.opacity,
            transform: `translateY(${b.translateY}px)`,
          }}
        >
          {opening.turn.map((l, i) => (
            <div
              key={i}
              style={{
                fontFamily: font.head,
                fontSize: 50,
                fontWeight: 800,
                color: i === 1 ? stage.accentBright : stage.ink,
                lineHeight: 1.4,
                letterSpacing: "-0.02em",
              }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* logo lockup */}
        <div
          style={{
            marginTop: 58,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: logo.opacity,
            transform: `translateY(${logo.translateY}px)`,
          }}
        >
          <div style={{ width: rule, height: 1, background: stage.hair, marginBottom: 34 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 13, height: 13, background: stage.accent, transform: "rotate(45deg)" }} />
            <span
              style={{
                fontFamily: font.head,
                fontWeight: 800,
                fontSize: 34,
                letterSpacing: "0.38em",
                color: stage.ink,
              }}
            >
              TREASURER
            </span>
            <span
              style={{
                fontFamily: font.head,
                fontWeight: 800,
                fontSize: 34,
                letterSpacing: "0.2em",
                color: stage.accentBright,
              }}
            >
              INS
            </span>
          </div>
          <span
            style={{
              fontFamily: font.mono,
              fontSize: 14,
              letterSpacing: "0.22em",
              color: stage.inkMuted,
              marginTop: 16,
              textTransform: "uppercase",
            }}
          >
            {opening.product}
          </span>
        </div>
      </AbsoluteFill>
    </SalesStage>
  );
};
