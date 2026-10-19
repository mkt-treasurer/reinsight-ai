import React from "react";
import { Composition } from "remotion";
import { Main } from "./Main";
import { FPS, H, W } from "./theme";
import { totalFrames } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Main"
    component={Main}
    durationInFrames={totalFrames()}
    fps={FPS}
    width={W}
    height={H}
    defaultProps={{ music: false }}
  />
);
