import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn } from "../lib";
import { VoidStage, Statement, Em } from "../ui/Alpha";
import { scene } from "../timing";

/** Close — 선언문이 먼저, 그 다음 부스에서 찍어 갈 락업 */
export const S7Close: React.FC = () => {
  const frame = useCurrentFrame();
  const life = scene("s-close").durationInFrames;

  const lock = life - 68;
  // 선언문은 락업이 들어오면 비켜준다
  const out = 1 - pIn(frame, lock - 6, 16);
  const rule = pIn(frame, lock + 10, 20);

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <VoidStage seed={23} count={30} from={0} tiles={1 - pIn(frame, lock - 4, 22) * 0.78} />

      <AbsoluteFill style={{ opacity: out }}>
        <Statement
          from={4}
          size={88}
          top={400}
          lines={[
            <>The AI operating layer</>,
            <>
              for <Em>financial institutions.</Em>
            </>,
          ]}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: pIn(frame, lock, 20),
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                background: C.brand,
                transform: "rotate(45deg)",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 52, fontWeight: 700, letterSpacing: 9, color: "#fff" }}>
              TREASURER
            </span>
          </div>

          <div
            style={{ margin: "40px auto 0", width: rule * 320, height: 1, background: "rgba(255,255,255,0.22)" }}
          />

          <div
            style={{
              marginTop: 34,
              fontFamily: MONO,
              fontSize: 21,
              letterSpacing: 4,
              color: "#7fa8e4",
              opacity: pIn(frame, lock + 18, 18),
            }}
          >
            treasurer.co.kr
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
