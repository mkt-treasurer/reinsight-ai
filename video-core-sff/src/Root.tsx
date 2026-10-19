import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Main } from "./Main";
import { CLIPS } from "./clips";
import { FPS, H, W } from "./theme";
import { totalFrames } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Main"
      component={Main}
      durationInFrames={totalFrames()}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ music: false }}
    />
    {CLIPS.map((c) => (
      <Composition key={c.id} id={c.id} component={c.component} durationInFrames={Math.round(c.seconds * FPS)} fps={FPS} width={W} height={H} />
    ))}
  </>
);
