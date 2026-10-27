import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Main } from "./Main";
import { CLIPS } from "./clips";
import { Tsmc, TSMC_FRAMES } from "./tsmc";
import { TsmcGold, GOLD_FRAMES } from "./tsmc-gold";
import { TsmcRef, REF_FRAMES } from "./tsmc-ref";
import { TsmcRecap, RECAP_FRAMES } from "./tsmc-recap";
import { Mas, MAS_FRAMES } from "./mas";
import { MasCore, MASCORE_FRAMES } from "./mas-core";
import { MasAi, MASAI_FRAMES } from "./mas-ai";
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
    <Composition id="MasAi" component={MasAi} durationInFrames={MASAI_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="MasCore" component={MasCore} durationInFrames={MASCORE_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="Mas" component={Mas} durationInFrames={MAS_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="TsmcRecap" component={TsmcRecap} durationInFrames={RECAP_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="Tsmc" component={TsmcRef} durationInFrames={REF_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="TsmcGold" component={TsmcGold} durationInFrames={GOLD_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="TsmcLight" component={Tsmc} durationInFrames={TSMC_FRAMES} fps={FPS} width={W} height={H} />
    {CLIPS.map((c) => (
      <Composition key={c.id} id={c.id} component={c.component} durationInFrames={Math.round(c.seconds * FPS)} fps={FPS} width={W} height={H} />
    ))}
  </>
);
