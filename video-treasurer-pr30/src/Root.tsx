import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Main } from "./Main";
import { Reel } from "./reel/Reel";
import { T } from "./timing";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Main"
      component={Main}
      durationInFrames={T.totalFrames}
      fps={T.fps}
      width={1920}
      height={1080}
    />
    {/* 인스타 릴스용 세로판 — 같은 타이밍, 모바일에 맞춘 배치 */}
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={T.totalFrames}
      fps={T.fps}
      width={1080}
      height={1920}
    />
  </>
);
