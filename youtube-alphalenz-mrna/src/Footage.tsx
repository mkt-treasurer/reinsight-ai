import React from "react";
import { AbsoluteFill, Loop, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import media from "./media.json";
import { EASE } from "./lib";

type Clip = { scene: string; seconds: number; frames?: number };
const CLIPS = (media as { clips: Record<string, Clip> }).clips || {};

export const hasFootage = (sceneId: string) =>
  Object.values(CLIPS).some((c) => c.scene === sceneId);

const clipsFor = (sceneId: string) =>
  Object.entries(CLIPS)
    .filter(([, c]) => c.scene === sceneId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, c]) => ({ id, ...c }));

/**
 * 씬별 그레이딩.
 * 예전에는 0.22~0.5 로 눌러 어둡게 갔는데, 뉴스형 톤에서는 영상이 주인공이라
 * 밝기를 살리고 글자는 외곽선·불투명 카드로 읽히게 한다.
 *  - tone "dark"  : 어두운 카드가 올라가는 씬
 *  - tone "light" : 흰 카드가 올라가는 씬 (영상 위에 흰 워시)
 */
type Grade = { bright: number; tone: "dark" | "light" };
const GRADE: Record<string, Grade> = {
  "s1-hook": { bright: 0.8, tone: "dark" },
  "s2-spread": { bright: 0.7, tone: "dark" },
  "s3-trial": { bright: 0.74, tone: "dark" },
  "s4-caveat": { bright: 0.82, tone: "light" },
  "s5-why": { bright: 0.68, tone: "dark" },
  "s6-distance": { bright: 0.5, tone: "dark" },
  "s7-earnings": { bright: 0.82, tone: "light" },
  "s8-alphalenz": { bright: 0.66, tone: "dark" },
  "s9-close": { bright: 0.62, tone: "dark" },
};

export const sceneTone = (sceneId: string): "dark" | "light" =>
  GRADE[sceneId]?.tone ?? "dark";

const XF = 14; // 클립 간 크로스페이드 프레임

export const SceneFootage: React.FC<{ sceneId: string; durationInFrames: number }> = ({
  sceneId,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const clips = clipsFor(sceneId);
  if (clips.length === 0) return null;

  const g = GRADE[sceneId] ?? { bright: 0.7, tone: "dark" as const };
  const slot = durationInFrames / clips.length;

  return (
    <AbsoluteFill style={{ backgroundColor: g.tone === "light" ? "#E9ECF3" : "#05060B" }}>
      {clips.map((c, i) => {
        const from = i * slot;
        const to = from + slot;
        const o =
          interpolate(frame, [from - XF, from + XF * 0.4], [0, 1], {
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
        const p = Math.max(0, (frame - from) / Math.max(1, slot));
        const zoom = 1.06 + p * 0.07;
        const pan = (i % 2 === 0 ? 1 : -1) * p * 14;
        return (
          <AbsoluteFill key={c.id} style={{ opacity: o }}>
            <Loop durationInFrames={Math.max(2, (c.frames ?? 150) - 2)} layout="none">
              <OffthreadVideo
                src={staticFile(`media/${c.id}.mp4`)}
                muted
                toneMapped={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${zoom}) translateX(${pan}px)`,
                  filter: `brightness(${g.bright}) saturate(1.06) contrast(1.04)`,
                }}
              />
            </Loop>
          </AbsoluteFill>
        );
      })}

      {g.tone === "light" ? (
        <>
          {/* 흰 워시 — 검은 글씨가 읽히도록 */}
          <AbsoluteFill style={{ background: "rgba(244,246,251,0.62)" }} />
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 26%," +
                "rgba(255,255,255,0) 58%, rgba(6,8,16,0.42) 100%)",
            }}
          />
        </>
      ) : (
        <>
          {/* 좌측 텍스트 가독성용 — 예전보다 훨씬 옅게 */}
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(90deg, rgba(5,6,11,0.72) 0%, rgba(5,6,11,0.40) 36%," +
                "rgba(5,6,11,0.14) 64%, rgba(5,6,11,0.30) 100%)",
            }}
          />
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(180deg, rgba(5,6,11,0.52) 0%, rgba(5,6,11,0) 16%," +
                "rgba(5,6,11,0) 60%, rgba(5,6,11,0.62) 100%)",
            }}
          />
          <AbsoluteFill
            style={{
              background:
                "radial-gradient(1100px 720px at 14% 8%, rgba(101,85,238,0.16), transparent 60%)",
              mixBlendMode: "screen",
            }}
          />
        </>
      )}
      <AbsoluteFill style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,0.28)" }} />
    </AbsoluteFill>
  );
};
