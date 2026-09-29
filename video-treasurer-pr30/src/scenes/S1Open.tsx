import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { cueAt, scene } from "../timing";

/** Open — wordmark builds, then the one line that says what this is */
export const S1Open: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1] = cueAt("s-open");
  const life = scene("s-open").durationInFrames;

  const build = pIn(frame, 4, 26);
  const track = interpolate(build, [0, 1], [26, 13]);
  const push = interpolate(frame, [0, life], [1.05, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const rule = pIn(frame, c1 - 6, 18);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: C.dark }}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${push})`,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26 }}>
            <span
              style={{
                width: 26,
                height: 26,
                background: C.brand,
                transform: `rotate(${45 + (1 - build) * 90}deg)`,
                opacity: build,
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: 82,
                fontWeight: 700,
                letterSpacing: track,
                color: C.onDark,
                opacity: build,
              }}
            >
              TREASURER
            </span>
          </div>

          <div
            style={{
              marginTop: 26,
              fontFamily: MONO,
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: 9,
              color: C.brandLite,
              opacity: pIn(frame, c0 + 6, 16),
            }}
          >
            FINANCIAL INTELLIGENCE
          </div>

          <div
            style={{
              margin: "46px auto 0",
              width: rule * 300,
              height: 1,
              background: C.onDarkLine2,
            }}
          />

          <div
            style={{
              marginTop: 40,
              fontSize: 46,
              fontWeight: 600,
              letterSpacing: -1.4,
              color: C.onDark,
              opacity: pIn(frame, c1, 18),
              transform: `translateY(${(1 - pIn(frame, c1, 18)) * 14}px)`,
            }}
          >
            AI agents for financial institutions
          </div>

        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
