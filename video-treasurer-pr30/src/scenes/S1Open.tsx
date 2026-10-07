import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { VoidStage, Statement, Em } from "../ui/Alpha";
import { cueAt, scene } from "../timing";

/** Open — 타일이 켜지면서 무대가 서고, 그 위에 한 줄 선언 */
export const S1Open: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1] = cueAt("s-open");
  const life = scene("s-open").durationInFrames;

  const build = pIn(frame, 6, 24);
  const track = interpolate(build, [0, 1], [22, 11]);
  const drift = interpolate(frame, [0, life], [0, -14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VoidStage seed={11} count={34} from={0} />

      <AbsoluteFill style={{ transform: `translateY(${drift}px)` }}>
        {/* 워드마크 */}
        <div
          style={{
            position: "absolute",
            left: 152,
            top: 286,
            display: "flex",
            alignItems: "center",
            gap: 20,
            opacity: build,
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              background: C.brand,
              transform: `rotate(${45 + (1 - build) * 90}deg)`,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: track,
              color: "#fff",
            }}
          >
            TREASURER
          </span>
        </div>

        <Statement
          from={c0 + 2}
          size={92}
          top={392}
          lines={[
            <>The analyst's work,</>,
            <>
              run <Em>end to end.</Em>
            </>,
          ]}
        />

        <div
          style={{
            position: "absolute",
            left: 156,
            top: 684,
            fontFamily: MONO,
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: 6,
            color: "#5b8ddb",
            opacity: pIn(frame, c1 + 2, 18),
          }}
        >
          AI AGENTS FOR FINANCIAL INSTITUTIONS
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
