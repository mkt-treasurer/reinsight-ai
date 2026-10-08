import timing from "./timing.json";

export type SceneMeta = {
  id: string;
  from: number;
  durationInFrames: number;
  cues: { sub: string; fromInScene: number; framesInScene: number }[];
};

export const T = timing as unknown as {
  fps: number;
  total: number;
  totalFrames: number;
  scenes: SceneMeta[];
};

export const scene = (id: string): SceneMeta => {
  const s = T.scenes.find((x) => x.id === id);
  if (!s) throw new Error("unknown scene " + id);
  return s;
};

/** frame offsets (scene-relative) of each cue start */
export const cueAt = (id: string): number[] => scene(id).cues.map((c) => c.fromInScene);
