import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, SANS } from "../theme";
import { CaptionTiming, CornerMark, Headline, Illustrative, NumCircle, fadeIn } from "../ui";

/**
 * The real tracker report, frozen, with a camera move over the three kinds of answer it holds:
 * the verdict sentence, the numbers behind it, and the sources panel. Coordinates are in the
 * 1920x1080 source frame (public/tracker.png = core-demo-draft7.mp4 @ 16.0s).
 */

type Key = { f: number; s: number; cx: number; cy: number };
const KEYS: Key[] = [
  { f: 0, s: 1.35, cx: 960, cy: 580 }, // overview, burned-in caption cropped off
  { f: 24, s: 1.35, cx: 960, cy: 580 },
  { f: 42, s: 2.3, cx: 905, cy: 372 }, // verdict
  { f: 66, s: 2.3, cx: 905, cy: 372 },
  { f: 84, s: 2.1, cx: 912, cy: 492 }, // stat tiles
  { f: 104, s: 2.1, cx: 912, cy: 492 },
  { f: 120, s: 1.5, cx: 1230, cy: 560 }, // sources: whole screen, panel on the right
  { f: 138, s: 1.5, cx: 1230, cy: 560 },
];

type Spot = { n: number; label: string; box: [number, number, number, number]; from: number; to: number; labelY?: number };
const SPOTS: Spot[] = [
  { n: 1, label: "A verdict, in plain words", box: [596, 316, 628, 72], from: 40, to: 80, labelY: 404 },
  { n: 2, label: "The numbers behind it", box: [602, 428, 622, 126], from: 82, to: 118, labelY: 570 },
  { n: 3, label: "Sources: public filings and our own notes", box: [1294, 256, 288, 682], from: 118, to: 10000, labelY: 236 },
];

export const Zoom: React.FC<{ timing: CaptionTiming; tag?: string; headline: string }> = ({ timing, tag, headline }) => {
  const frame = useCurrentFrame();
  const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const fs = KEYS.map((k) => k.f);
  const s = interpolate(frame, fs, KEYS.map((k) => k.s), ease);
  const cx = interpolate(frame, fs, KEYS.map((k) => k.cx), ease);
  const cy = interpolate(frame, fs, KEYS.map((k) => k.cy), ease);

  // the caption leaves before the camera reaches the sources panel (frame 120), so the two never overlap
  const cap = { ...timing, exitAt: Math.min(timing.exitAt, 108) };
  // the dark band exists for the caption, so it comes and goes with it
  const band = fadeIn(frame, cap.enter, cap.inLen ?? 9) * (1 - fadeIn(frame, cap.exitAt, cap.outLen ?? 6));
  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          transformOrigin: "0 0",
          transform: `translate(${960 - cx * s}px, ${540 - cy * s}px) scale(${s})`,
        }}
      >
        <Img src={staticFile("tracker.png")} style={{ width: 1920, height: 1080, display: "block" }} />
        {SPOTS.map((sp) => {
          const [x, y, w, h] = sp.box;
          const a = fadeIn(frame, sp.from, 8) * (1 - fadeIn(frame, sp.to, 6));
          if (a <= 0) return null;
          return (
            <React.Fragment key={sp.n}>
              <div
                style={{
                  position: "absolute",
                  left: x - 8,
                  top: y - 8,
                  width: w + 16,
                  height: h + 16,
                  border: `1.5px solid ${C.gold}`,
                  borderRadius: 8,
                  background: "rgba(212,175,55,0.07)",
                  boxShadow: `0 0 0 1px rgba(212,175,55,0.25), 0 0 26px rgba(212,175,55,0.35)`,
                  opacity: a,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: x - 8,
                  top: sp.labelY ?? y - 8 - 34,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "4px 10px 4px 5px",
                  borderRadius: 999,
                  background: "#0f1014",
                  border: `1px solid ${C.goldSoft}`,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                  opacity: a,
                  transform: `translateY(${(1 - a) * 6}px)`,
                }}
              >
                <NumCircle n={sp.n} size={18} />
                <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.white, whiteSpace: "nowrap" }}>{sp.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* darken the top so the caption reads over the white report */}
      <div style={{ position: "absolute", inset: 0, opacity: band, background: "linear-gradient(180deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.9) 22%, rgba(0,0,0,0.55) 32%, rgba(0,0,0,0) 44%)" }} />
      <CornerMark />
      <Headline tag={tag} text={headline} timing={cap} />
      <Illustrative />
    </AbsoluteFill>
  );
};
