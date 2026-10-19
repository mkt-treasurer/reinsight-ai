import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, MONO, SANS, SERIF } from "../theme";
import { FPS, SRC, Scene, sceneFrames } from "../timeline";
import { CaptionTiming, Card3D, CornerMark, DarkCard3D, Headline, Illustrative, Tag, clamp01, fadeIn, useCount, useEnter, useTyped } from "../ui";

/* ------------------------------------------------------------------ backdrop */

/**
 * The demo footage as a stage, not a slide: cropped so its burned-in caption is off-frame,
 * pushed back in 3D, dimmed, and drifting slowly. Native cards sit in front of it.
 */
const Backdrop: React.FC<{ scene: Scene; dim?: number }> = ({ scene, dim = 0.3 }) => {
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

const Label: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 4, color: dark ? C.gold : "#6b6f7a", textTransform: "uppercase" }}>{children}</div>
);

const Big: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = "#111318", size = 84 }) => (
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
const PromptBox: React.FC<{ text: string; delay: number; label: string }> = ({ text, delay, label }) => {
  const frame = useCurrentFrame();
  const t = useTyped(text, delay + 8, 42);
  const run = useEnter(delay + 8 + Math.ceil((text.length / 42) * FPS) + 4, 14);
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

const Ask12: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 430, display: "flex", justifyContent: "center" }}>
    <PromptBox label="Core · Ask" delay={6} text="Guidance tracker for NVDA, with what our previews expected." />
  </div>
);

const Ans1: React.FC = () => {
  const guide = useCount(108.0, 14, (v) => `$${v.toFixed(1)}B`);
  const ours = useCount(113.0, 24, (v) => `$${v.toFixed(1)}B`);
  const pct = useCount(4.6, 30, (v) => `${v.toFixed(1)}%`);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center", gap: 30 }}>
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

const Ask3: React.FC = () => {
  const frame = useCurrentFrame();
  // the post card drops into the Check box, then the box lights gold
  const drop = useEnter(14, 13);
  const landed = frame > 40;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 400, display: "flex", justifyContent: "center" }}>
      <DarkCard3D delay={6} width={1100} style={{ padding: "28px 36px 36px", border: `1px solid ${landed ? C.goldSoft : C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ width: 9, height: 9, background: C.gold, transform: "rotate(45deg)", display: "inline-block" }} />
          <Tag size={15}>Core · Check</Tag>
        </div>
        <div
          style={{
            minHeight: 230,
            border: `1.5px dashed ${landed ? C.gold : "rgba(255,255,255,0.25)"}`,
            borderRadius: 14,
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", fontFamily: MONO, fontSize: 18, letterSpacing: 4, color: C.white3, opacity: 1 - clamp01(drop * 2) }}>PASTE A POST</div>
          <div
            style={{
              width: 760,
              background: "#fff",
              color: "#111318",
              borderRadius: 14,
              padding: "20px 26px",
              boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
              opacity: clamp01(drop * 1.4),
              transform: `translateY(${(1 - drop) * -260}px) rotate(${(1 - drop) * -6}deg) scale(${0.9 + 0.1 * drop})`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 999, background: "#111318", color: "#fff", fontFamily: SANS, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>X</span>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 20 }}>Post</span>
              <span style={{ fontFamily: SANS, fontSize: 18, color: "#6b6f7a" }}>· 6:52 AM</span>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 25, lineHeight: 1.35 }}>
              Hearing Microsoft cut its Q4 GB300 rack order ~20% and pulled in Maia 200. NVDA data-center outlook at risk?
            </div>
          </div>
        </div>
      </DarkCard3D>
    </div>
  );
};

const CLAIMS: [string, number, string, string, string][] = [
  ["The core claim", 84, "likely true", "Microsoft cut its Q4 GB300 rack order by about 20%", "#15803d"],
  ["Claim 2", 38, "uncertain", "Microsoft pulled in Maia 200", "#b45309"],
  ["Claim 3", 13, "likely false", "NVIDIA's Data Center outlook is at risk", "#b91c1c"],
];

const Ans3: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 410, display: "flex", justifyContent: "center", gap: 24 }}>
    {CLAIMS.map(([label, odds, verdict, text, color], i) => {
      const n = useCount(odds, 10 + i * 9, (v) => `${Math.round(v)}%`);
      return (
        <Card3D key={label} delay={6 + i * 9} width={520} tiltY={i === 0 ? -12 : i === 2 ? 12 : 0} style={{ padding: "30px 32px 28px" }}>
          <Label>{label}</Label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 10 }}>
            <Big size={76} color={i === 0 ? "#111318" : color}>{n}</Big>
            <span style={{ fontFamily: SANS, fontSize: 22, color }}>{verdict}</span>
          </div>
          <div style={{ margin: "14px 0 18px" }}>
            <Bar to={odds} delay={14 + i * 9} color={i === 0 ? C.gold : color} />
          </div>
          <div style={{ fontFamily: SANS, fontSize: 23, lineHeight: 1.3, color: "#2a2e38" }}>{text}</div>
        </Card3D>
      );
    })}
  </div>
);

const NOTES: [string, string][] = [
  ["Channel check · S. Lim", "Oracle and Meta raised their Q4 GB300 plans."],
  ["Company · NVIDIA", "Called the digestion contained within its outlook."],
];

const Notes: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 430, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
    {NOTES.map(([src, text], i) => (
      <Card3D key={src} delay={8 + i * 10} width={1100} tiltY={0} style={{ padding: "22px 30px", display: "flex", alignItems: "center", gap: 26 }}>
        <span style={{ padding: "8px 14px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontFamily: MONO, fontSize: 15, letterSpacing: 3, textTransform: "uppercase", whiteSpace: "nowrap" }}>contradicts</span>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: "#6b6f7a", textTransform: "uppercase" }}>{src}</div>
          <div style={{ fontFamily: SANS, fontSize: 28, color: "#111318", marginTop: 6 }}>{text}</div>
        </div>
      </Card3D>
    ))}
  </div>
);


const SixMin: React.FC = () => {
  const frame = useCurrentFrame();
  const e = useEnter(6, 26);
  const secs = Math.round(360 * e);
  const timer = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const stats: [string, string][] = [
    ["3", "questions"],
    ["2", "asks"],
    ["0", "manual steps"],
  ];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 430, display: "flex", flexDirection: "column", alignItems: "center", gap: 36 }}>
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

const BEATS: Record<string, React.FC> = { ask12: Ask12, ans1: Ans1, ans2: Ans2, ask3: Ask3, ans3: Ans3, notes: Notes, sixmin: SixMin };

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

/** Plain footage (used for the final shot). */
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
