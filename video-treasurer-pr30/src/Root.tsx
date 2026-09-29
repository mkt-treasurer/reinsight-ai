import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Main } from "./Main";
import { T } from "./timing";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Main"
    component={Main}
    durationInFrames={T.totalFrames}
    fps={T.fps}
    width={1920}
    height={1080}
  />
);
