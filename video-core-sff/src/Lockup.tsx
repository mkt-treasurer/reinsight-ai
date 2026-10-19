import React from "react";
import { C, SERIF } from "./theme";

const SANS = "Pretendard, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/** The O of CORE: a disc with a pebble-shaped cutout, drawn as vector so it stays sharp. */
export const OMark: React.FC<{ size: number; color?: string }> = ({ size, color = C.white }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
    <path
      fill={color}
      fillRule="evenodd"
      d="M50 2a48 48 0 1 0 0 96a48 48 0 1 0 0-96Z M44 24c16-6 34 6 34 24c0 16-12 30-30 30c-14 0-24-10-24-24c0-12 8-26 20-30Z"
    />
  </svg>
);

/**
 * Core by Treasurer lockup, rebuilt as text + vector (not an upscaled bitmap).
 * `size` is the cap height of CORE in px; everything else scales from it.
 */
export const Lockup: React.FC<{ size?: number; color?: string; subColor?: string; dot?: string }> = ({
  size = 120,
  color = C.white,
  subColor = "rgba(255,255,255,0.78)",
  dot = C.gold,
}) => {
  const font = size / 0.72; // Pretendard cap height ≈ 0.72em
  const track = size * 0.42;
  const sub = size * 0.32;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: font,
          lineHeight: 1,
          color,
          letterSpacing: track,
          paddingLeft: track, // balance the trailing letter-spacing on the last glyph
        }}
      >
        <span>C</span>
        <span style={{ display: "inline-block", marginRight: track, marginTop: size * 0.02 }}>
          <OMark size={size * 1.02} color={color} />
        </span>
        <span>R</span>
        <span>E</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: sub * 0.55, color: subColor, paddingLeft: sub * 0.3 }}>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: sub * 1.25, letterSpacing: 0 }}>by</span>
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: sub, letterSpacing: sub * 0.34 }}>
          TREASURER<span style={{ color: dot, letterSpacing: 0 }}>.</span>
        </span>
      </div>
    </div>
  );
};
