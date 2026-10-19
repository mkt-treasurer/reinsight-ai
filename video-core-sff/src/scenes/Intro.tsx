import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Lockup, OMark } from "../Lockup";
import { C, MONO } from "../theme";
import { clamp01, fadeIn, useEnter } from "../ui";

const N_PARTICLES = 32;
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * 2-second logo reveal: a glowing app tile with the mark, then the tile gives way
 * to the full lockup with a gold light sweep and the tagline.
 */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();

  // phase 1: tile (0–20f)
  const tileIn = useEnter(0, 11);
  const tileOut = interpolate(frame, [14, 24], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tileScale = interpolate(tileIn, [0, 1], [0.5, 1]) * interpolate(tileOut, [0, 1], [1.6, 1]);
  const tileBlur = interpolate(tileIn, [0, 1], [20, 0]) + interpolate(tileOut, [0, 1], [14, 0]);
  const glowPulse = 0.7 + 0.3 * Math.sin(frame / 4);

  // phase 2: lockup (from 18f)
  const lockIn = useEnter(18, 13);
  const lockScale = interpolate(lockIn, [0, 1], [1.22, 1]);
  const lockBlur = interpolate(lockIn, [0, 1], [16, 0]);
  const sweep = interpolate(frame, [28, 52], [-50, 150], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kicker = fadeIn(frame, 32, 9);
  const rule = useEnter(28, 20);
  const glow = fadeIn(frame, 0, 16);

  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 1500,
          height: 800,
          transform: "translate(-50%,-50%)",
          background: `radial-gradient(ellipse at center, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.05) 35%, rgba(0,0,0,0) 70%)`,
          opacity: glow * (0.85 + 0.15 * Math.sin(frame / 9)),
        }}
      />

      {/* expanding rings */}
      {[0, 1, 2, 3].map((i) => {
        const t = (frame - i * 7) / 44;
        if (t < 0) return null;
        const s = interpolate(t, [0, 1], [0.1, 1.7]);
        const o = interpolate(t, [0, 0.12, 1], [0, 0.45, 0], { extrapolateRight: "clamp" });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 900,
              height: 900,
              marginLeft: -450,
              marginTop: -450,
              borderRadius: 999,
              border: `1px solid ${C.gold}`,
              transform: `scale(${s})`,
              opacity: o,
            }}
          />
        );
      })}

      {/* drifting gold particles */}
      {Array.from({ length: N_PARTICLES }).map((_, i) => {
        const x = rnd(i, 1) * 1920;
        const speed = 0.4 + rnd(i, 2) * 0.7;
        const y = ((rnd(i, 3) * 1080 - frame * speed) % 1080 + 1080) % 1080;
        const size = 2 + rnd(i, 4) * 3;
        const o = (0.25 + 0.5 * rnd(i, 5)) * fadeIn(frame, 2, 14);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: 999,
              background: C.gold2,
              opacity: o,
              boxShadow: `0 0 ${size * 3}px ${C.goldGlow}`,
            }}
          />
        );
      })}

      {/* phase 1: glowing tile with the mark */}
      {tileOut > 0 ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 240,
            height: 240,
            marginLeft: -120,
            marginTop: -120,
            borderRadius: 56,
            background: `linear-gradient(160deg, #1a1710, #000)`,
            border: `1.5px solid ${C.gold}`,
            boxShadow: `0 0 ${60 * glowPulse}px ${C.goldGlow}, 0 0 160px rgba(212,175,55,0.25), inset 0 0 40px rgba(212,175,55,0.12)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: clamp01(tileIn * 1.3) * tileOut,
            transform: `scale(${tileScale})`,
            filter: `blur(${tileBlur}px)`,
          }}
        >
          <OMark size={132} color={C.gold2} />
        </div>
      ) : null}

      {/* phase 2: lockup with light sweep */}
      {frame >= 18 ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -60%) scale(${lockScale})`,
            opacity: clamp01(lockIn * 1.3),
            filter: `blur(${lockBlur}px)`,
          }}
        >
          <div style={{ position: "relative" }}>
            <Lockup size={150} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                WebkitMaskImage: `linear-gradient(100deg, rgba(0,0,0,0) ${sweep - 22}%, #000 ${sweep}%, rgba(0,0,0,0) ${sweep + 22}%)`,
                maskImage: `linear-gradient(100deg, rgba(0,0,0,0) ${sweep - 22}%, #000 ${sweep}%, rgba(0,0,0,0) ${sweep + 22}%)`,
              }}
            >
              <Lockup size={150} color={C.gold2} subColor={C.gold2} dot={C.white} />
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 748,
          width: 320,
          marginLeft: -160,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
          transform: `scaleX(${rule})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 782,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 34,
          letterSpacing: 7,
          color: C.gold,
          opacity: kicker,
          transform: `translateY(${(1 - kicker) * 8}px)`,
        }}
      >
        AN AI RESEARCH ANALYST THAT RUNS INSIDE YOUR FIRM
      </div>
    </AbsoluteFill>
  );
};
