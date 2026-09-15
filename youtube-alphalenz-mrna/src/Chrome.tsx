import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, FONT } from "./theme";

const NOISE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/><feColorMatrix type='saturate' values='0'/></filter><rect width='220' height='220' filter='url(%23n)' opacity='0.5'/></svg>`
  );

export const Background: React.FC<{ tone?: "default" | "warm" | "brand" }> = ({
  tone = "default",
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 220) * 60;
  const drift2 = Math.cos(frame / 300) * 80;
  const glow =
    tone === "brand"
      ? "rgba(101,85,238,0.30)"
      : tone === "warm"
      ? "rgba(242,178,76,0.13)"
      : "rgba(101,85,238,0.17)";
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg0 }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 780px at ${18 + drift / 12}% ${-8 + drift2 / 30}%, ${glow}, transparent 62%),
                       radial-gradient(1000px 700px at ${88 + drift2 / 20}% 108%, rgba(25,201,140,0.09), transparent 60%),
                       linear-gradient(160deg, #0A0C15 0%, #07080D 55%, #090A12 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `url("${NOISE}")`,
          backgroundRepeat: "repeat",
          opacity: 0.035,
          mixBlendMode: "overlay",
        }}
      />
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 300px 90px rgba(0,0,0,0.55)",
        }}
      />
    </AbsoluteFill>
  );
};

export const BrandMark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 56,
      right: 64,
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontFamily: FONT,
      opacity: 0.5,
    }}
  >
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        background: `linear-gradient(135deg, ${C.brandLite}, ${C.brand})`,
      }}
    />
    <span
      style={{
        fontSize: 21,
        fontWeight: 700,
        letterSpacing: 4.5,
        color: C.textDim,
      }}
    >
      ALPHALENZ
    </span>
  </div>
);

export const Progress: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, total], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 5,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          width: `${p * 100}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${C.brand}, ${C.brandLite}, ${C.green})`,
        }}
      />
    </div>
  );
};
