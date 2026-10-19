import React from "react";
import { C, SERIF } from "./theme";

const SANS = "Pretendard, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/**
 * The O of CORE, traced from the brand mark: a disc with a cutout shaped like a tilted
 * half-moon. Flat along the bottom, sloping up on the left, rounded over the top and right,
 * sitting slightly above and right of center. Vector, so it stays sharp at any size.
 */
export const OMark: React.FC<{ size: number; color?: string }> = ({ size, color = C.white }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
    <path
      fill={color}
      fillRule="evenodd"
      d="M50 2a48 48 0 1 0 0 96a48 48 0 1 0 0-96Z M28.5 63C29 52 33.5 36.5 40 28.5C46 21.5 62 18.5 73 25C80 29.5 83.5 39 81.5 48C79.5 56.5 76.5 62.5 71.5 63.8C58 65 42 64.8 28.5 63Z"
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
