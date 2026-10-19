import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, MONO, SANS, SERIF } from "../theme";
import { FPS, SRC, Scene, sceneFrames } from "../timeline";
import { CaptionTiming, Card3D, CornerMark, DarkCard3D, Headline, Illustrative, Tag, clamp01, fadeIn, useCount, useEnter, useTyped } from "../ui";

/* ------------------------------------------------------------------ backdrop */

/**
 * The demo footage as a stage, not a slide: cropped so its burned-in caption is off-frame,
 * pushed back in 3D, dimmed and blurred, drifting slowly. Native cards sit in front of it.
 */
export const Backdrop: React.FC<{ scene: Scene; dim?: number }> = ({ scene, dim = 0.3 }) => {
  const frame = useCurrentFrame();
  const n = sceneFrames(scene);
  const p = frame / n;
  const ry = interpolate(p, [0, 1], [-8, -4]);
  const rx = interpolate(p, [0, 1], [5, 2]);
  const z = interpolate(p, [0, 1], [1.38, 1.44]);
  return (
    <AbsoluteFill style={{ background: C.black, overflow: "hidden", perspective: 2000 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `rotateY(${ry}deg) rotateX(${rx}deg) scale(${z})`,
          transformOrigin: "50% 60%",
          filter: `brightness(${dim}) saturate(0.6) blur(5px)`,
        }}
      >
        <OffthreadVideo
          src={staticFile(SRC)}
          startFrom={Math.round((scene.from as number) * FPS)}
          endAt={Math.round((scene.to as number) * FPS)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 95%" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%), linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 30%)",
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ pieces */

export const Label: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 4, color: dark ? C.gold : "#6b6f7a", textTransform: "uppercase" }}>{children}</div>
);

export const Big: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = "#111318", size = 84 }) => (
  <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: size, color, lineHeight: 1.05, letterSpacing: -1 }}>{children}</div>
);

const Row: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 24, color: "#2a2e38", borderTop: "1px solid #e6e8ee", padding: "12px 0" }}>
    <span style={{ color: "#6b6f7a" }}>{k}</span>
    <span style={{ fontWeight: 600 }}>{v}</span>
  </div>
);

/** Gold progress bar that fills on a spring. */
const Bar: React.FC<{ to: number; delay: number; color?: string }> = ({ to, delay, color = C.gold }) => {
  const e = useEnter(delay, 24);
  return (
    <div style={{ height: 6, background: "rgba(0,0,0,0.08)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${to * e}%`, height: "100%", background: color, borderRadius: 99 }} />
    </div>
  );
};

/** Core's ask box with a typed prompt and a gold run button. */
export const PromptBox: React.FC<{ text: string; delay: number; label: string }> = ({ text, delay, label }) => {
  const frame = useCurrentFrame();
  const t = useTyped(text, delay + 8, 46);
  const run = useEnter(delay + 8 + Math.ceil((text.length / 46) * FPS) + 4, 14);
  return (
    <DarkCard3D delay={delay} width={1180} style={{ padding: "30px 36px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{ width: 9, height: 9, background: C.gold, transform: "rotate(45deg)", display: "inline-block" }} />
        <Tag size={15}>{label}</Tag>
      </div>
      <div
        style={{
          minHeight: 110,
          padding: "22px 26px",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${t.done ? C.goldSoft : C.line}`,
          borderRadius: 12,
          fontFamily: SANS,
          fontSize: 34,
          color: C.white,
          lineHeight: 1.35,
        }}
      >
        {t.shown}
        <span style={{ display: "inline-block", width: 3, height: 34, background: C.gold, marginLeft: 6, verticalAlign: "-0.15em", opacity: t.cursor || !t.done ? 1 : 0 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
        <div
          style={{
            padding: "12px 28px",
            borderRadius: 10,
            background: C.gold,
            color: C.black,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 22,
            opacity: clamp01(run * 1.3),
            transform: `scale(${0.9 + 0.1 * run})`,
            boxShadow: `0 0 ${24 + 12 * Math.sin(frame / 4)}px ${C.goldGlow}`,
          }}
        >
          Run
        </div>
      </div>
    </DarkCard3D>
  );
};

/* ------------------------------------------------------------------ beats */

const Ask: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center" }}>
    <PromptBox label="Core · Ask" delay={8} text="Build a guidance tracker for NVDA, with what our previews expected." />
  </div>
);

/** Answer 1: guide vs ours, then the verdict strip that explains the headline. */
const Ans1: React.FC = () => {
  const guide = useCount(108.0, 14, (v) => `$${v.toFixed(1)}B`);
  const ours = useCount(113.0, 24, (v) => `$${v.toFixed(1)}B`);
  const pct = useCount(4.6, 30, (v) => `${v.toFixed(1)}%`);
  const verdict = useEnter(44, 16);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 30 }}>
        <Card3D delay={8} width={620} style={{ padding: "34px 40px 30px" }}>
          <Label>Q3 FY27 guide · open</Label>
          <div style={{ marginTop: 10 }}>
            <Big>{guide}</Big>
          </div>
          <div style={{ fontFamily: SANS, fontSize: 26, color: "#6b6f7a", margin: "6px 0 18px" }}>±2%</div>
          <Bar to={78} delay={18} color="#c9ccd6" />
        </Card3D>
        <Card3D delay={18} width={620} tiltY={10} style={{ padding: "34px 40px 30px", background: "#111318", color: C.white, border: `1px solid ${C.goldSoft}` }}>
          <Label dark>Ours</Label>
          <div style={{ marginTop: 10 }}>
            <Big color={C.gold2}>{ours}</Big>
          </div>
          <div style={{ fontFamily: SANS, fontSize: 26, color: C.white2, margin: "6px 0 18px" }}>{pct} vs midpoint</div>
          <Bar to={92} delay={28} />
        </Card3D>
      </div>
      <div
        style={{
          width: 1270,
          padding: "20px 30px",
          borderRadius: 12,
          border: `1px solid ${C.goldSoft}`,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          gap: 24,
          opacity: clamp01(verdict * 1.3),
          transform: `translateY(${(1 - verdict) * 24}px)`,
        }}
      >
        <span style={{ fontFamily: SERIF, fontSize: 44, color: C.gold2, lineHeight: 1, whiteSpace: "nowrap" }}>3 of 3</span>
        <span style={{ fontFamily: SANS, fontSize: 26, color: C.white, lineHeight: 1.3 }}>
          quarters printed above the guided range, avg +5.0% vs midpoint. So our number is more likely low than high.
        </span>
      </div>
    </div>
  );
};

const Ans2: React.FC = () => {
  const avg = useCount(1.9, 14, (v) => `(${v.toFixed(1)}%)`);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center" }}>
      <Card3D delay={8} width={760} style={{ padding: "34px 40px 30px" }}>
        <Label>Our previews vs the print</Label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 10 }}>
          <Big>{avg}</Big>
          <span style={{ fontFamily: SANS, fontSize: 28, color: "#6b6f7a" }}>avg</span>
        </div>
        <div style={{ marginTop: 18 }}>
          <Row k="Low" v="2 of 2" />
          <Row k="Range" v="(2.3%) to (1.5%)" />
          <Row k="Source" v={<span style={{ color: "#8a6d1c" }}>from our own notes</span>} />
        </div>
      </Card3D>
    </div>
  );
};

const SOURCES: [string, string, string][] = [
  ["Public", "Q3 FY26", "NVIDIA Announces Financial Results for Third Quarter Fiscal 2026"],
  ["Public", "Q4 FY26", "NVIDIA Announces Financial Results for Fourth Quarter and Fiscal 2026"],
  ["Public", "Q1 FY27", "NVIDIA Announces Financial Results for First Quarter Fiscal 2027"],
  ["Public", "Q2 FY27", "NVIDIA Announces Financial Results for Second Quarter Fiscal 2027"],
  ["Internal", "Q1 FY27 · May 13, 2026", "NVDA Q1 FY2027 earnings preview — J. Park"],
];

/** The sources panel as a native list; the internal note is the one in gold. */
const Sources: React.FC = () => {
  const head = useEnter(6, 16);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center" }}>
      <DarkCard3D delay={6} width={1180} style={{ padding: "26px 34px 28px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 14, opacity: clamp01(head * 1.3) }}>
          <Tag size={15}>Sources</Tag>
          <span style={{ fontFamily: SERIF, fontSize: 34, color: C.gold2 }}>7</span>
          <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: C.white3 }}>4 PUBLIC · 3 INTERNAL</span>
        </div>
        {SOURCES.map(([kind, period, title], i) => {
          const e = useEnter(12 + i * 6, 16);
          const internal = kind === "Internal";
          return (
            <div
              key={title}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "12px 0",
                borderTop: `1px solid ${C.line}`,
                opacity: clamp01(e * 1.3),
                transform: `translateX(${(1 - e) * -24}px)`,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, padding: "5px 10px", borderRadius: 4, background: internal ? C.gold : "rgba(255,255,255,0.08)", color: internal ? C.black : C.white2, textTransform: "uppercase", whiteSpace: "nowrap" }}>{kind}</span>
              <span style={{ fontFamily: MONO, fontSize: 15, color: C.white3, whiteSpace: "nowrap", minWidth: 190 }}>{period}</span>
              <span style={{ fontFamily: SANS, fontSize: 23, color: internal ? C.gold2 : C.white }}>{title}</span>
            </div>
          );
        })}
      </DarkCard3D>
    </div>
  );
};

const SixMin: React.FC = () => {
  const frame = useCurrentFrame();
  const e = useEnter(6, 26);
  const secs = Math.round(360 * e);
  const timer = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const stats: [string, string][] = [
    ["2", "questions"],
    ["1", "request"],
    ["0", "manual steps"],
  ];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 36 }}>
      <div style={{ fontFamily: SERIF, fontSize: 220, lineHeight: 1, color: C.gold2, textShadow: `0 0 60px ${C.goldGlow}`, letterSpacing: 4 }}>{timer}</div>
      <div style={{ display: "flex", gap: 18 }}>
        {stats.map(([n, l], i) => {
          const s = useEnter(30 + i * 7, 16);
          return (
            <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "14px 24px", border: `1px solid ${C.goldSoft}`, borderRadius: 6, background: "rgba(0,0,0,0.55)", opacity: clamp01(s * 1.3), transform: `translateY(${(1 - s) * 24}px)` }}>
              <span style={{ fontFamily: SERIF, fontSize: 44, color: C.gold2, lineHeight: 1 }}>{n}</span>
              <Tag size={15}>{l}</Tag>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 4, color: C.white3, opacity: fadeIn(frame, 40, 10) }}>7:10 → 7:16 AM</div>
    </div>
  );
};

const BEATS: Record<string, React.FC> = { ask: Ask, ans1: Ans1, ans2: Ans2, sources: Sources, sixmin: SixMin };

/** One footage-backed beat: backdrop, headline, native card(s). */
export const Beat: React.FC<{ scene: Scene; timing: CaptionTiming }> = ({ scene, timing }) => {
  const Body = BEATS[scene.id];
  return (
    <AbsoluteFill>
      <Backdrop scene={scene} />
      <CornerMark />
      {scene.headline ? <Headline tag={scene.tag} nums={scene.nums} text={scene.headline} timing={timing} /> : null}
      {Body ? <Body /> : null}
      <Illustrative />
    </AbsoluteFill>
  );
};

/** Plain footage (the real screen, unblurred; also the final shot). */
export const Footage: React.FC<{ scene: Scene }> = ({ scene }) => (
  <AbsoluteFill style={{ background: C.black }}>
    <OffthreadVideo
      src={staticFile(SRC)}
      startFrom={Math.round((scene.from as number) * FPS)}
      endAt={Math.round((scene.to as number) * FPS)}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
    {!scene.final ? <Illustrative /> : null}
  </AbsoluteFill>
);
