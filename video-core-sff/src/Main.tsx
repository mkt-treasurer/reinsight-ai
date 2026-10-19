import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import "./fonts";
import { C } from "./theme";
import { SCENES, Scene, captionWindow, sceneFrames, transitionFrames } from "./timeline";
import { presentationFor } from "./transitions";
import { Intro } from "./scenes/Intro";
import { PrintDay } from "./scenes/PrintDay";
import { Problem } from "./scenes/Problem";
import { Beat, Footage } from "./scenes/Beats";
import { Private } from "./scenes/Private";

const SceneView: React.FC<{ scene: Scene; index: number }> = ({ scene, index }) => {
  const timing = captionWindow(index);
  switch (scene.kind) {
    case "intro":
      return <Intro />;
    case "printday":
      return <PrintDay timing={timing} />;
    case "problem":
      return <Problem timing={timing} tag={scene.tag} headline={scene.headline ?? ""} />;
    case "private":
      return <Private timing={timing} headline={scene.headline} />;
    case "beat":
      return <Beat scene={scene} timing={timing} />;
    case "footage":
    default:
      return <Footage scene={scene} />;
  }
};

export const Main: React.FC<{ music?: boolean }> = ({ music = false }) => (
  <AbsoluteFill style={{ background: C.black }}>
    <TransitionSeries>
      {SCENES.flatMap((s, i) => {
        const nodes: React.ReactNode[] = [];
        if (i > 0 && s.in) {
          nodes.push(
            <TransitionSeries.Transition
              key={`t-${s.id}`}
              presentation={presentationFor(s.in)}
              timing={linearTiming({ durationInFrames: transitionFrames(s) })}
            />
          );
        }
        nodes.push(
          <TransitionSeries.Sequence key={s.id} durationInFrames={sceneFrames(s)}>
            <SceneView scene={s} index={i} />
          </TransitionSeries.Sequence>
        );
        return nodes;
      })}
    </TransitionSeries>
    {/* Music slot: drop music.mp3 into public/ and `npm run render` picks it up. */}
    {music ? <Audio src={staticFile("music.mp3")} volume={0.9} /> : null}
  </AbsoluteFill>
);
