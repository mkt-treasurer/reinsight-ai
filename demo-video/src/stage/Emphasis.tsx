import React from "react";
import { useCurrentFrame } from "remotion";
import { stage, font } from "../theme";
import { fadeUp } from "../util";

// Callout label with a short leader line, anchored inside a position:relative parent.
// `at` is a percentage/px position; `dir` sets whether the leader points down or up.
export const CalloutLabel: React.FC<{
  text: string;
  left: string | number;
  top: string | number;
  start: number;
  dir?: "down" | "up";
  align?: "left" | "center";
}> = ({ text, left, top, start, dir = "down", align = "center" }) => {
  const frame = useCurrentFrame();
  const a = fadeUp(frame, start, 12, 10);
  return (
    <div style={{ position: "absolute", left, top, transform: align === "center" ? "translateX(-50%)" : undefined, opacity: a.opacity, zIndex: 30, pointerEvents: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start" }}>
        {dir === "up" && <div style={{ width: 2, height: 18, background: stage.accent }} />}
        <div style={{ background: stage.accent, color: "#fff", fontFamily: font.body, fontWeight: 600, fontSize: 15, padding: "6px 12px", boxShadow: "0 8px 20px -8px rgba(59,130,246,0.7)", whiteSpace: "nowrap" }}>
          {text}
        </div>
        {dir === "down" && <div style={{ width: 2, height: 18, background: stage.accent }} />}
      </div>
    </div>
  );
};

// Returns an opacity multiplier that dims non-focused siblings during a window.
export function dim(frame: number, from: number, to: number, focused: boolean): number {
  if (focused) return 1;
  const active = frame >= from && frame <= to;
  return active ? 0.32 : 1;
}

// Full-frame overlay that floats a single callout over a scene during a window.
// Coordinates are in 1920×1080 space (render as a sibling of <Stage>).
export const SceneEmphasis: React.FC<{
  from: number;
  text: string;
  left: number;
  top: number;
  dir?: "down" | "up";
}> = ({ from, text, left, top, dir = "down" }) => {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none" }}>
      <CalloutLabel text={text} left={left} top={top} start={from} dir={dir} align="left" />
    </div>
  );
};
