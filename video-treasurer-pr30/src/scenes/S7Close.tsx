import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn } from "../lib";
import { cueAt } from "../timing";

/** Close — the positioning line, then the lockup the booth should photograph */
export const S7Close: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0] = cueAt("s-close");
  const rule = pIn(frame, c0 + 22, 20);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(8,14,28,0.20) 0%, rgba(8,14,28,0.70) 62%, rgba(8,14,28,0.92) 100%)",
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", width: 1500 }}>
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              letterSpacing: -2.6,
              lineHeight: 1.26,
              color: C.onDark,
              opacity: pIn(frame, 4, 20),
              transform: `translateY(${(1 - pIn(frame, 4, 20)) * 16}px)`,
            }}
          >
            The AI operating layer
            <br />
            for <span style={{ color: C.brandLite }}>financial institutions</span>
          </div>

          <div
            style={{ margin: "56px auto 0", width: rule * 360, height: 1, background: C.onDarkLine2 }}
          />

          <div
            style={{
              marginTop: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              opacity: pIn(frame, c0 + 30, 18),
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                background: C.brand,
                transform: "rotate(45deg)",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 46, fontWeight: 700, letterSpacing: 8, color: C.onDark }}>
              TREASURER
            </span>
          </div>

          <div
            style={{
              marginTop: 26,
              fontFamily: MONO,
              fontSize: 22,
              letterSpacing: 4,
              color: C.onDark2,
              opacity: pIn(frame, c0 + 40, 18),
            }}
          >
            treasurer.co.kr
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
