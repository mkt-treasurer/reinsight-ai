import React from "react";
import { C, FONT, MONO } from "./theme";

/** Small corner lockup so the brand is on screen at any point of the loop */
export const CornerMark: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: 84,
      top: 60,
      display: "flex",
      alignItems: "center",
      gap: 13,
      opacity,
      fontFamily: FONT,
    }}
  >
    <span
      style={{
        width: 13,
        height: 13,
        background: C.brand,
        transform: "rotate(45deg)",
        display: "inline-block",
      }}
    />
    <span
      style={{
        fontFamily: MONO,
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: 5,
        color: C.onDark,
      }}
    >
      TREASURER
    </span>
  </div>
);

/** Step label used on the three agent cards */
export const StepNo: React.FC<{ no: string; label: string; opacity?: number }> = ({
  no,
  label,
  opacity = 1,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      opacity,
      fontFamily: MONO,
      fontSize: 17,
      fontWeight: 700,
      letterSpacing: 4,
      color: C.brandLite,
    }}
  >
    <span>{no}</span>
    <span style={{ width: 26, height: 1, background: "currentColor", opacity: 0.5 }} />
    <span>{label}</span>
  </div>
);
