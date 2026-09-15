import { interpolate, spring, Easing } from "remotion";
import { EASE } from "./theme";

const cubic = Easing.bezier(EASE[0], EASE[1], EASE[2], EASE[3]);

/** Ease-out-expo fade+rise. Returns {opacity, translateY}. */
export function fadeUp(frame: number, start: number, dur = 18, rise = 24) {
  const opacity = interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: cubic,
  });
  const translateY = interpolate(frame, [start, start + dur], [rise, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: cubic,
  });
  return { opacity, translateY };
}

/** Clamped 0→1 progress over a window. */
export function ramp(frame: number, start: number, dur: number) {
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: cubic,
  });
}

/** Count a number up from 0 → target across a window. */
export function countUp(frame: number, start: number, dur: number, target: number) {
  return ramp(frame, start, dur) * target;
}

/** Springy pop for badges/pills. */
export function pop(frame: number, start: number, fps: number) {
  return spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 180, mass: 0.6 } });
}

/** Typewriter: how many chars of `text` are visible at `frame`. */
export function typed(text: string, frame: number, start: number, cps = 32, fps = 30) {
  const chars = Math.floor(((frame - start) / fps) * cps);
  return text.slice(0, Math.max(0, Math.min(text.length, chars)));
}

export function krCurrency(n: number, cur: string) {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (cur === "USD") return sign + "$" + a.toLocaleString("en-US");
  // KRW → 억/만 compact
  if (a >= 100_000_000) return sign + "₩" + (a / 100_000_000).toFixed(1) + "억";
  if (a >= 10_000) return sign + "₩" + Math.round(a / 10_000).toLocaleString() + "만";
  return sign + "₩" + a.toLocaleString();
}
