import React from "react";
import { useCurrentFrame } from "remotion";
import { stage, font } from "../theme";
import { fadeUp } from "../util";

// Bottom-anchored subtitle line, blue tick + text. Appears a beat after scene start.
export const Caption: React.FC<{ text: string; start?: number }> = ({ text, start = 10 }) => {
  const frame = useCurrentFrame();
  const a = fadeUp(frame, start, 20, 16);
  return (
    <div
      style={{
        position: "absolute",
        bottom: 96,
        left: 64,
        right: 64,
        display: "flex",
        justifyContent: "center",
        opacity: a.opacity,
        transform: `translateY(${a.translateY}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, maxWidth: 1180 }}>
        <div style={{ width: 3, height: 26, background: stage.accent, flex: "0 0 auto" }} />
        <span
          style={{
            fontFamily: font.body,
            fontSize: 24,
            fontWeight: 500,
            color: stage.ink,
            letterSpacing: "-0.01em",
            lineHeight: 1.35,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
