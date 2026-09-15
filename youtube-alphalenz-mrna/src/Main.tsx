import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { T } from "./timing";
import { Background, Progress } from "./Chrome";
import { BrandBadge } from "./Badge";
import { Captions } from "./Captions";
import { EASE } from "./lib";
import { SceneFootage } from "./Footage";
import { S1Hook } from "./scenes/S1Hook";
import { S2Spread } from "./scenes/S2Spread";
import { S3Trial } from "./scenes/S3Trial";
import { S4Caveat } from "./scenes/S4Caveat";
import { S5Why } from "./scenes/S5Why";
import { S6Distance } from "./scenes/S6Distance";
import { S8AlphaLenz } from "./scenes/S8AlphaLenz";
import { S9Close } from "./scenes/S9Close";

const MAP: Record<string, React.FC> = {
  "s1-hook": S1Hook,
  "s2-spread": S2Spread,
  "s3-trial": S3Trial,
  "s4-caveat": S4Caveat,
  "s5-why": S5Why,
  "s6-distance": S6Distance,
  "s8-alphalenz": S8AlphaLenz,
  "s9-close": S9Close,
};

const OVERLAP = 8;

const Fade: React.FC<{ life: number; children: React.ReactNode }> = ({ life, children }) => {
  const frame = useCurrentFrame();
  const i = interpolate(frame, [0, 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const o = interpolate(frame, [life - OVERLAP - 2, life - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <AbsoluteFill
      style={{
        opacity: i * o,
        transform: `translateY(${(1 - i) * 12}px) scale(${0.995 + i * 0.005})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const last = T.scenes[T.scenes.length - 1];
  const brandOut = interpolate(frame, [last.from - 14, last.from + 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Background />
      {T.scenes.map((s, i) => {
        const Comp = MAP[s.id];
        const life = s.durationInFrames + (i === T.scenes.length - 1 ? 0 : OVERLAP);
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={life} name={s.id}>
            <Fade life={life}>
              <SceneFootage sceneId={s.id} durationInFrames={life} />
              <Comp />
            </Fade>
          </Sequence>
        );
      })}
      <AbsoluteFill style={{ opacity: brandOut }}>
        <BrandBadge />
      </AbsoluteFill>
      <Captions />
      <Progress total={T.totalFrames} />
    </AbsoluteFill>
  );
};
