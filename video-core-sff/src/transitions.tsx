import React from "react";
import { AbsoluteFill } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { C } from "./theme";
import { TransitionKind } from "./timeline";

/** Signature transition: the new scene is revealed left→right behind a glowing gold hairline. */
const GoldWipe: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress,
}) => {
  const p = presentationProgress;
  // ease-in-out so the line accelerates through the middle
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const edge = e * 100;
  if (presentationDirection === "exiting") {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 ${100 - edge}% 0 0)` }}>{children}</AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `calc(${edge}% - 2px)`,
          width: 4,
          background: C.gold2,
          boxShadow: `0 0 28px 6px ${C.goldGlow}, 0 0 80px 20px rgba(212,175,55,0.18)`,
          opacity: p < 0.92 ? 1 : (1 - p) / 0.08,
        }}
      />
    </AbsoluteFill>
  );
};

export const goldWipe = (): TransitionPresentation<Record<string, never>> => ({
  component: GoldWipe,
  props: {},
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const presentationFor = (kind: TransitionKind): TransitionPresentation<any> => {
  switch (kind) {
    case "goldwipe":
      return goldWipe();
    case "slide":
      return slide({ direction: "from-right" });
    case "slideup":
      return slide({ direction: "from-bottom" });
    case "wipe":
      return wipe({ direction: "from-left" });
    case "fade":
    default:
      return fade();
  }
};
