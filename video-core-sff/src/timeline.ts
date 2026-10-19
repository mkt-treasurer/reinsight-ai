import cut from "./cut.json";

export type TransitionKind = "fade" | "goldwipe" | "slide" | "slideup" | "wipe";

export type Scene = {
  id: string;
  kind: "intro" | "printday" | "beat" | "private" | "footage";
  dur?: number; // seconds, for native scenes
  from?: number; // seconds into the source, for footage-backed scenes
  to?: number;
  in?: TransitionKind; // how this scene comes in
  tag?: string; // gold mono tag above the headline
  headline?: string; // the one serif line at the top
  final?: boolean; // last shot: footage shown clean, no badge
};

export const FPS: number = cut.fps;
export const SRC: string = cut.src;
export const SCENES = cut.scenes as Scene[];
export const TRANSITION_FRAMES = cut.transitionFrames as Record<TransitionKind, number>;

export const sceneFrames = (s: Scene) =>
  Math.round((s.from !== undefined ? (s.to as number) - (s.from as number) : (s.dur as number)) * FPS);

export const transitionFrames = (s: Scene) => (s.in ? TRANSITION_FRAMES[s.in] : 0);

/** Total length: scenes minus the overlap each transition consumes. */
export const totalFrames = () =>
  SCENES.reduce((acc, s, i) => acc + sceneFrames(s) - (i > 0 ? transitionFrames(s) : 0), 0);
