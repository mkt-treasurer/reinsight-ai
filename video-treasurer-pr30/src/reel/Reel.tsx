import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { T } from "../timing";
import { Enter, Trans } from "../transitions";
import { C } from "../theme";
import { V1Open, V2What, V4Graph } from "./VA";
import { V5Deploy, V6Bench, V8Close } from "./VB";

/** 세로판은 가로판과 같은 timing.json 을 쓴다 — 사운드가 그대로 맞는다 */
const MAP: Record<string, React.FC> = {
  "s-open": V1Open,
  "s-what": V2What,
  "s-graph": V4Graph,
  "s-deploy": V5Deploy,
  "s-bench": V6Bench,
  "s-close": V8Close,
};

/** 세로에서는 좌우 밀기가 어색해 위아래와 페이드 위주로 */
const TRANS: Record<string, Trans> = {
  "s-open": "fade",
  "s-what": "slideUp",
  "s-graph": "zoomIn",
  "s-deploy": "slideUp",
  "s-bench": "fade",
  "s-close": "zoomOut",
};

const OVERLAP = 8;

export const Reel: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.dark }}>
    {T.scenes.map((s, i) => {
      const Comp = MAP[s.id];
      const isLast = i === T.scenes.length - 1;
      const life = s.durationInFrames + (isLast ? 0 : OVERLAP);
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={life} name={s.id}>
          <Enter kind={TRANS[s.id] ?? "fade"} life={life} out={isLast ? 9999 : OVERLAP}>
            <Comp />
          </Enter>
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
