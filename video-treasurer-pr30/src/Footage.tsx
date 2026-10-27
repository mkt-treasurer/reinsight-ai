import React from "react";
import { AbsoluteFill, Loop, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Video } from "@remotion/media";
import media from "./media.json";
import { EASE } from "./lib";

type Clip = { scene: string; seconds: number };
const CLIPS = (media as { clips: Record<string, Clip> }).clips || {};

export const clipsFor = (sceneId: string) =>
  Object.entries(CLIPS)
    .filter(([, c]) => c.scene === sceneId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, c]) => ({ id, ...c }));

/**
 * 영상 조각 하나. 씬이 원하는 자리에 직접 놓을 수 있게 style 을 받는다.
 * 전면에 쓸 수도 있고(불투명), 배경으로 깔 수도 있다.
 */
export const Broll: React.FC<{
  id: string;
  seconds?: number;
  opacity?: number;
  zoom?: number;
  grade?: string;
  style?: React.CSSProperties;
}> = ({ id, seconds = 8, opacity = 1, zoom = 0.06, grade, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ overflow: "hidden", opacity, ...style }}>
      <Loop durationInFrames={Math.max(2, Math.round(seconds * 30) - 2)} layout="none">
        <Video
          src={staticFile(`media/${id}.mp4`)}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${1.04 + p * zoom})`,
            filter: grade ?? "saturate(0.7) brightness(0.9) contrast(1.06)",
          }}
        />
      </Loop>
    </div>
  );
};

/** 씬별 전면 배경 강도 — 0 이면 씬이 직접 배치한다는 뜻 */
const FULL: Record<string, number> = {
  "s-graph": 0.18,
  "s-deploy": 0.30,
};

const XF = 16;

/** 전면 배경으로 까는 경우에만 쓴다 */
export const SceneFootage: React.FC<{ sceneId: string; durationInFrames: number }> = ({
  sceneId,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const strength = FULL[sceneId];
  if (!strength) return null;
  const clips = clipsFor(sceneId);
  if (clips.length === 0) return null;

  const slot = durationInFrames / clips.length;

  return (
    <AbsoluteFill>
      {clips.map((c, i) => {
        const from = i * slot;
        const to = from + slot;
        const o =
          interpolate(frame, [from - XF, from + XF * 0.5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          }) *
          interpolate(frame, [to - XF, to], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
        if (o <= 0.002) return null;
        return (
          <AbsoluteFill key={c.id} style={{ opacity: o * strength }}>
            <Broll id={c.id} seconds={c.seconds} zoom={0.08} style={{ width: "100%", height: "100%" }} />
          </AbsoluteFill>
        );
      })}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(8,14,28,0.58) 0%, rgba(13,21,38,0.18) 44%, rgba(8,14,28,0.74) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
