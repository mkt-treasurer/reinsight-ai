import cut from "./cut.json";

export type TransitionKind = "fade" | "goldwipe" | "slide" | "slideup" | "wipe";

export type Scene = {
  id: string;
  kind: "intro" | "printday" | "problem" | "beat" | "private" | "footage";
  dur?: number; // seconds, for native scenes
  from?: number; // seconds into the source, for footage-backed scenes
  to?: number;
  in?: TransitionKind; // how this scene comes in
  tag?: string; // gold mono label above the headline
  nums?: number[]; // gold numbered circles shown before the label
  headline?: string; // the one serif line at the top
  final?: boolean; // last shot: footage shown clean, no badge
};

export const FPS: number = cut.fps;
export const SRC: string = cut.src;
export const SCENES = cut.scenes as Scene[];
export const TRANSITION_FRAMES = cut.transitionFrames as Record<TransitionKind, number>;

export const sceneFrames = (s: Scene) =>
  Math.round((s.from !== undefined ? (s.to as number) - (s.from as number) : (s.dur as number)) * FPS);

/** Frames of the transition INTO this scene (0 for the first). */
export const transitionFrames = (s: Scene) => (s.in ? TRANSITION_FRAMES[s.in] : 0);

/** Caption timing for scene i: when its caption may start, and when it must start fading out. */
export const captionWindow = (i: number) => {
  const s = SCENES[i];
  const next = SCENES[i + 1];
  const inF = i > 0 ? transitionFrames(s) : 0;
  const outF = next ? transitionFrames(next) : 0;
  const CAPTION_OUT = 6; // 0.2s fade-out, finished before the transition starts
  return { enter: inF, exitAt: sceneFrames(s) - outF - CAPTION_OUT, outLen: CAPTION_OUT, inLen: 9 };
};

/** Total length: scenes minus the overlap each transition consumes. */
export const totalFrames = () =>
  SCENES.reduce((acc, s, i) => acc + sceneFrames(s) - (i > 0 ? transitionFrames(s) : 0), 0);
