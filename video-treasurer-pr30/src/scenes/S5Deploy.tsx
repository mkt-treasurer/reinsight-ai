import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";
import { pIn, EASE } from "../lib";
import { CornerMark } from "../Brand";
import { GraphStatic } from "../ui/Graph";
import { cueAt } from "../timing";

const BOX = { x: 520, y: 372, w: 880, h: 448 };
const BC = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 - 10 };

/** Catches the graph from the previous shot and draws a boundary around it */
export const S5Deploy: React.FC = () => {
  const frame = useCurrentFrame();
  const [c0, c1] = cueAt("s-deploy");

  // the graph keeps shrinking from where the last shot left it, then settles
  const s = interpolate(frame, [0, 26], [0.62, 0.34], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const box = pIn(frame, 18, 18);

  const t = interpolate(frame - (c1 - 6), [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const raw = BC.x + t * 560;
  const edge = BOX.x + BOX.w - 18;
  const px = Math.min(raw, edge);
  const blocked = raw >= edge;

  return (
    <AbsoluteFill style={{ fontFamily: FONT, backgroundColor: C.darkDeep }}>
      <CornerMark opacity={pIn(frame, 0, 10) * 0.85} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 158,
          textAlign: "center",
          fontSize: 58,
          fontWeight: 700,
          letterSpacing: -2.4,
          color: C.onDark,
          opacity: pIn(frame, 4, 16),
        }}
      >
        Treasurer AX runs inside <span style={{ color: C.brandLite }}>your</span> cloud.
      </div>

      {/* the boundary */}
      <div
        style={{
          position: "absolute",
          left: BOX.x,
          top: BOX.y,
          width: BOX.w,
          height: BOX.h,
          border: `2px dashed rgba(96,165,250,0.55)`,
          borderRadius: 8,
          background: "rgba(59,130,246,0.05)",
          opacity: box,
          transform: `scale(${0.97 + box * 0.03})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 26,
            top: -14,
            background: C.darkDeep,
            padding: "0 12px",
            fontFamily: MONO,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 3,
            color: C.brandLite,
          }}
        >
          YOUR VPC OR ON-PREM
        </div>
      </div>

      <GraphStatic cx={BC.x} cy={BC.y} scale={s} />

      <div
        style={{
          position: "absolute",
          left: BOX.x,
          top: BOX.y + BOX.h - 78,
          width: BOX.w,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: 2.6,
          color: C.onDark2,
          opacity: pIn(frame, c0 + 26, 16),
        }}
      >
        AGENTS + YOUR DATA · CUSTOMER-HELD KEYS · ISO 27001
      </div>

      {/* what tries to leave */}
      {t > 0.06 ? (
        <>
          <div
            style={{
              position: "absolute",
              left: px,
              top: BC.y - 9,
              width: 18,
              height: 18,
              borderRadius: 4,
              background: blocked ? C.red : C.onDark2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: BOX.x + BOX.w - 4,
              top: BC.y - 54,
              width: 5,
              height: 108,
              background: C.red,
              opacity: blocked ? 0.85 : 0,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: BOX.x + BOX.w + 44,
              top: BC.y - 20,
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: -1,
              color: C.red,
              opacity: blocked ? pIn(frame, c1 + 14, 12) : 0,
            }}
          >
            Nothing leaves.
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
