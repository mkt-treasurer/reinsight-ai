import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { T } from "./timing";
import { Enter, Trans } from "./transitions";
import { SceneFootage } from "./Footage";
import { C } from "./theme";
import { S1Open } from "./scenes/S1Open";
import { S2What } from "./scenes/S2What";
import { S2Demo } from "./scenes/S2Demo";
import { S3Graph } from "./scenes/S3Graph";
import { S5Deploy } from "./scenes/S5Deploy";
import { S4Bench } from "./scenes/S4Bench";
import { S7Reach } from "./scenes/S7Reach";
import { S7Close } from "./scenes/S7Close";

const MAP: Record<string, React.FC> = {
  "s-open": S1Open,
  "s-what": S2What,
  "s-demo": S2Demo,
  "s-graph": S3Graph,
  "s-deploy": S5Deploy,
  "s-bench": S4Bench,
  "s-reach": S7Reach,
  "s-close": S7Close,
};

const TRANS: Record<string, Trans> = {
  "s-open": "fade",
  "s-what": "slideUp",
  "s-demo": "zoomIn",
  "s-graph": "zoomIn",
  "s-deploy": "slideL",
  "s-bench": "slideUp",
  "s-reach": "wipeL",
  "s-close": "zoomOut",
};

const OVERLAP = 8;

export const Main: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.dark }}>
    {T.scenes.map((s, i) => {
      const Comp = MAP[s.id];
      const isLast = i === T.scenes.length - 1;
      const life = s.durationInFrames + (isLast ? 0 : OVERLAP);
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={life} name={s.id}>
          <Enter kind={TRANS[s.id] ?? "fade"} life={life} out={isLast ? 9999 : OVERLAP}>
            <SceneFootage sceneId={s.id} durationInFrames={life} />
            <Comp />
          </Enter>
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
