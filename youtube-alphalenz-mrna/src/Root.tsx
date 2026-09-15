import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Main } from "./Main";
import { Thumbnail } from "./Thumbnail";
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
    {(["A", "B", "C"] as const).map((v) => (
      <Composition
        key={v}
        id={`Thumbnail${v}`}
        component={Thumbnail}
        defaultProps={{ variant: v }}
        durationInFrames={1}
        fps={T.fps}
        width={1920}
        height={1080}
      />
    ))}
  </>
);
