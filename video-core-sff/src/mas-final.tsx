/**
 * "MAS filing, Day 1" — v5. ~35s. Twelve scenes, one short line each, pictures made of big shapes and symbols,
 * no small text anywhere. Hook is a question (the viewer already knows MAS). The two forms physically fly
 * into the MAS-Tx portal twice: once under the 14-day clock, once on Day 1.
 * Facts: Form 1 / Form 2 quarterly, due 14 days after quarter end, via MAS-Tx; a CMS licence revoked 3 Jul 2025
 * citing unfiled quarterly returns among other breaches; ORR = 5% of 3-year average income, floor S$100,000;
 * notify MAS if the ratio falls below 120% (SFA 04-N13). Names, invoices and numbers are illustrative.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Lockup, OMark } from "./Lockup";
import { BLUE, Cap, GREEN, GREY, INK, INK2, LINE, MONO, RED, SANS, Stage, pIn, lin } from "./mas-core";

const FPS = 30;
const CUT = 8;
const EASE = Easing.bezier(0.22, 1, 0.32, 1);
const ease = (frame: number, a: number, b: number, from: number, to: number) =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

/* ------------------------------------------------------------------ shapes */

const CoreMark: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = INK }) => (
  <span style={{ display: "inline-flex", alignItems: "center", fontWeight: 500, fontSize: size, letterSpacing: size * 0.3, paddingLeft: size * 0.3, color, lineHeight: 1 }}>
    C<span style={{ display: "inline-block", margin: `0 ${size * 0.3}px 0 ${-size * 0.08}px`, marginTop: size * 0.05 }}><OMark size={size * 0.78} color={color} /></span>RE
  </span>
);

const Corner: React.FC = () => (
  <div style={{ position: "absolute", top: 44, left: 60 }}>
    <CoreMark size={22} color={INK2} />
  </div>
);

/** A paper document: big label, three grey lines. */
const Paper: React.FC<{ label: string; w?: number; style?: React.CSSProperties; accent?: string }> = ({ label, w = 260, style, accent = INK }) => (
  <div style={{ width: w, height: w * 1.28, background: "#fff", borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)", padding: w * 0.1, position: "relative", ...style }}>
    <div style={{ position: "absolute", right: 0, top: 0, width: w * 0.22, height: w * 0.22, background: "#f0f0f0", borderBottomLeftRadius: 14, borderTopRightRadius: 14 }} />
    <div style={{ fontSize: w * 0.15, fontWeight: 800, color: accent, letterSpacing: -1, paddingRight: w * 0.2, whiteSpace: "nowrap" }}>{label}</div>
    {[0.8, 0.6, 0.7, 0.5].map((x, i) => (
      <div key={i} style={{ height: w * 0.045, width: `${x * 100}%`, background: "#e3e3e3", borderRadius: 4, marginTop: w * 0.09 }} />
    ))}
  </div>
);

/** The MAS-Tx portal as a dark box with an open slot. */
const Portal: React.FC<{ x: number; y: number; at: number; w?: number; done?: boolean }> = ({ x, y, at, w = 360, done }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 14);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: w * 0.78, borderRadius: 24, background: INK, boxShadow: "0 30px 80px rgba(0,0,0,0.25)", opacity: p, transform: `scale(${0.92 + p * 0.08})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
      <div style={{ width: w * 0.62, height: 14, borderRadius: 7, background: done ? GREEN : "#3a3a3a" }} />
      <div style={{ fontFamily: MONO, fontSize: w * 0.075, letterSpacing: 5, color: "#fff", fontWeight: 700 }}>MAS-Tx</div>
      <div style={{ fontSize: w * 0.05, color: "#9a9a9a" }}>MAS filing portal</div>
    </div>
  );
};

/** Two forms flying from (x0,y0) to the portal at (x1,y1) between frames a..b. */
const FlyingForms: React.FC<{ x0: number; y0: number; x1: number; y1: number; a: number; b: number; labels?: [string, string] }> = ({ x0, y0, x1, y1, a, b, labels = ["Form 1", "Form 2"] }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {labels.map((l, i) => {
        const d = i * 6;
        const t = ease(frame, a + d, b + d, 0, 1);
        const x = x0 + (x1 - x0) * t + i * 40 * (1 - t);
        const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 120 + i * 30 * (1 - t);
        const s = 1 - t * 0.55;
        const o = t > 0.92 ? (1 - t) / 0.08 : 1;
        return (
          <div key={l} style={{ position: "absolute", left: x, top: y, transform: `scale(${s}) rotate(${(1 - t) * (i ? 4 : -4)}deg)`, transformOrigin: "50% 50%", opacity: o * pIn(frame, 2, 8) }}>
            <Paper label={l} w={240} accent={i ? BLUE : INK} />
          </div>
        );
      })}
    </>
  );
};

/** Countdown ring: fills from 0 to 14 days. */
const Ring: React.FC<{ x: number; y: number; at: number; days?: number; color?: string; text?: string }> = ({ x, y, at, days = 14, color = RED, text }) => {
  const frame = useCurrentFrame();
  const t = ease(frame, at, at + 50, 0, 1);
  const r = 96, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "absolute", left: x - 120, top: y - 120, width: 240, height: 240, opacity: pIn(frame, at - 6, 10) }}>
      <svg width={240} height={240}>
        <circle cx={120} cy={120} r={r} stroke="#ececec" strokeWidth={16} fill="none" />
        <circle cx={120} cy={120} r={r} stroke={color} strokeWidth={16} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - t)} strokeLinecap="round" transform="rotate(-90 120 120)" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: INK, lineHeight: 1 }}>{Math.round(t * days)}</div>
        <div style={{ fontSize: 20, color: GREY, fontWeight: 600 }}>{text ?? "days"}</div>
      </div>
    </div>
  );
};

const Person: React.FC<{ x: number; y: number; at: number; label?: string; color?: string; size?: number }> = ({ x, y, at, label, color = INK, size = 120 }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 12);
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, textAlign: "center", opacity: p, transform: `scale(${0.9 + p * 0.1})` }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={50} cy={32} r={20} fill={color} />
        <path d="M 10 95 C 10 60, 90 60, 90 95 Z" fill={color} />
      </svg>
      {label ? <div style={{ fontSize: 26, fontWeight: 700, color: INK, marginTop: 6, whiteSpace: "nowrap" }}>{label}</div> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ scenes */

/** 1 · Hook: a question. A calendar flips to 30 Sep, two forms appear with a red "!" */
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const flip = ease(frame, 2, 18, -90, 0);
  const bang = pIn(frame, 40, 10);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 420, top: 170, width: 340, borderRadius: 22, background: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden", transform: `perspective(1200px) rotateX(${flip}deg)`, transformOrigin: "50% 0%" }}>
        <div style={{ height: 70, background: RED, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, letterSpacing: 6 }}>SEP</div>
        <div style={{ textAlign: "center", padding: "20px 0 26px" }}>
          <div style={{ fontSize: 170, fontWeight: 800, lineHeight: 1, letterSpacing: -6, color: INK }}>30</div>
          <div style={{ fontSize: 22, color: GREY, marginTop: 8 }}>quarter ends</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 900, top: 200, opacity: pIn(frame, 18, 12), transform: `rotate(-5deg)` }}><Paper label="Form 1" w={260} /></div>
      <div style={{ position: "absolute", left: 1180, top: 230, opacity: pIn(frame, 26, 12), transform: `rotate(5deg)` }}><Paper label="Form 2" w={260} accent={BLUE} /></div>
      <div style={{ position: "absolute", left: 1400, top: 150, width: 110, height: 110, borderRadius: 999, background: RED, color: "#fff", fontSize: 72, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", opacity: bang, transform: `scale(${0.6 + bang * 0.4})`, boxShadow: "0 16px 40px rgba(216,35,42,0.35)" }}>!</div>
      <Cap at={8} size={80}>Still dreading your MAS filing?</Cap>
    </Stage>
  );
};

/** 2 · The two forms fly into the portal while a 14-day ring counts. */
const TwoForms: React.FC = () => (
  <Stage>
    <Ring x={960} y={300} at={10} />
    <Portal x={1400} y={330} at={2} />
    <FlyingForms x0={180} y0={300} x1={1480} y1={400} a={16} b={64} />
    <div style={{ position: "absolute", left: 180, top: 640, fontSize: 30, fontWeight: 700, color: INK2 }}>30 Sep</div>
    <div style={{ position: "absolute", left: 1460, top: 640, fontSize: 30, fontWeight: 700, color: INK2 }}>14 Oct</div>
    <Cap at={8} size={76}>Two forms. 14 days. Every quarter.</Cap>
  </Stage>
);

/** 3 · Stakes: a licence card gets a big red REVOKED stamp. */
const Revoked: React.FC = () => {
  const frame = useCurrentFrame();
  const stamp = ease(frame, 24, 34, 0, 1);
  const flash = frame >= 24 && frame < 40 ? Math.abs(Math.sin((frame - 24) * 0.9)) : 0;
  const shake = frame >= 24 && frame < 36 ? Math.sin(frame * 3) * 6 : 0;
  return (
    <Stage dark>
      <AbsoluteFill style={{ background: `rgba(216,35,42,${flash * 0.35})` }} />
      <div style={{ position: "absolute", left: "50%", top: 150, width: 820, marginLeft: -410, padding: "44px 50px", borderRadius: 18, background: "#fff", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", opacity: pIn(frame, 2, 12), transform: `translateX(${shake}px)` }}>
        <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: 5, color: GREY }}>MONETARY AUTHORITY OF SINGAPORE</div>
        <div style={{ fontSize: 46, fontWeight: 800, color: INK, marginTop: 16, letterSpacing: -1.5, lineHeight: 1.15 }}>Capital Markets Services Licence</div>
        <div style={{ fontSize: 24, color: GREY, marginTop: 12 }}>Fund management</div>
        {[0.8, 0.55, 0.7].map((x, i) => (
          <div key={i} style={{ height: 12, width: `${x * 100}%`, background: "#e8e8e8", borderRadius: 6, marginTop: 22 }} />
        ))}
        <div style={{ position: "absolute", left: 60, top: 120, padding: "16px 34px", border: `10px solid ${RED}`, borderRadius: 16, color: RED, fontSize: 110, fontWeight: 900, letterSpacing: 6, transform: `rotate(-14deg) scale(${2 - stamp})`, opacity: stamp, mixBlendMode: "multiply" }}>REVOKED</div>
      </div>
      <Cap at={40} size={78}><span style={{ color: "#fff" }}>2025. Returns not filed. </span><span style={{ color: RED }}>Licence gone.</span></Cap>
    </Stage>
  );
};

/** 4 · Problem 1: money goes out to the consultant; questions come back to you. */
const PayStillWork: React.FC = () => {
  const frame = useCurrentFrame();
  const coin = ease(frame, 14, 40, 0, 1);
  return (
    <Stage>
      <Person x={420} y={420} at={2} label="You" />
      <Person x={1500} y={420} at={6} label="Consultant" color="#555" />
      {/* money, left → right */}
      <div style={{ position: "absolute", left: 480 + coin * 900, top: 330 - Math.sin(coin * Math.PI) * 80, width: 110, height: 110, borderRadius: 999, background: "#f5b400", color: "#fff", fontSize: 44, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 36px rgba(245,180,0,0.4)", opacity: coin < 0.97 ? 1 : 0 }}>S$</div>
      {/* questions, right → left */}
      {[0, 1, 2, 3, 4].map((i) => {
        const t = ease(frame, 44 + i * 7, 74 + i * 7, 0, 1);
        return (
          <div key={i} style={{ position: "absolute", left: 1430 - t * 880, top: 470 + Math.sin(t * Math.PI) * (60 + i * 18) - i * 10, width: 84, height: 84, borderRadius: 999, background: RED, color: "#fff", fontSize: 48, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", opacity: t > 0 && t < 0.97 ? 1 : 0 }}>?</div>
        );
      })}
      <Cap at={8} size={78}>You pay. The questions come back to you.</Cap>
    </Stage>
  );
};

/** 5 · Problem 2: one person's formula → she's out → #REF! */
const OneFormula: React.FC = () => {
  const frame = useCurrentFrame();
  const out = pIn(frame, 34, 12);
  const broke = frame >= 50;
  const blink = broke ? 0.5 + 0.5 * Math.abs(Math.sin((frame - 50) / 5)) : 0;
  return (
    <Stage>
      <div style={{ position: "absolute", left: 300, top: 170, width: 1320, height: 400, borderRadius: 18, background: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden", opacity: pIn(frame, 2, 12) }}>
        <div style={{ height: 54, background: "#e8f5e9", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", fontFamily: MONO, fontSize: 20, color: INK2 }}>
          fx &nbsp;=MAX(0.05*AVERAGE('FY23'!R9,'FY24'!R9,'FY25'!R9),100000)/…
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 346 }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: INK2 }}>Capital ratio</div>
          <div style={{ fontFamily: MONO, fontSize: broke ? 120 : 96, fontWeight: 900, color: broke ? RED : INK, opacity: broke ? 0.6 + blink * 0.4 : 1, background: broke ? `rgba(216,35,42,${0.06 + blink * 0.08})` : "transparent", borderRadius: 12, padding: "10px 24px" }}>{broke ? "#REF!" : "1,143%"}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 1500, top: 110, transform: `translateX(${out * 260}px)`, opacity: 1 - out * 0.7 }}>
        <Person x={0} y={0} at={10} label="On leave" />
      </div>
      <Cap at={8} size={74}>One person knows the formula. She's out.</Cap>
    </Stage>
  );
};

/** 6 · Core card. */
const MeetCore: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 4, 14);
  return (
    <Stage dark>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30, opacity: a, transform: `scale(${0.96 + a * 0.04})` }}>
        <CoreMark size={150} color="#fff" />
        <div style={{ fontSize: 40, color: "#c9c9c9", fontWeight: 600 }}>does the filing for you.</div>
      </div>
    </Stage>
  );
};

/** 7 · Fix 1: your files in, MAS forms out. */
const FilesIn: React.FC = () => {
  const frame = useCurrentFrame();
  const files = ["Ledger", "Bank", "Fund admin"];
  return (
    <Stage>
      <Corner />
      {files.map((f, i) => {
        const t = ease(frame, 10 + i * 8, 40 + i * 8, 0, 1);
        return (
          <div key={f} style={{ position: "absolute", left: 160 + t * 560, top: 240 + i * 150 + t * (420 - (240 + i * 150)), transform: `scale(${1 - t * 0.5})`, opacity: t < 0.95 ? 1 : 0 }}>
            <Paper label={f} w={200} accent={INK2} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 800, top: 340, width: 160, height: 160, borderRadius: 999, background: INK, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", opacity: pIn(frame, 4, 12) }}>
        <CoreMark size={34} color="#fff" />
      </div>
      {["Form 1", "Form 2"].map((l, i) => {
        const t = ease(frame, 46 + i * 8, 76 + i * 8, 0, 1);
        return (
          <div key={l} style={{ position: "absolute", left: 900 + t * (1120 + i * 300 - 900), top: 420 + t * (220 - 420), transform: `scale(${0.5 + t * 0.5})`, opacity: t }}>
            <Paper label={l} w={260} accent={i ? BLUE : INK} />
            <div style={{ position: "absolute", right: -16, top: -16, width: 56, height: 56, borderRadius: 999, background: GREEN, color: "#fff", fontSize: 30, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", opacity: pIn(frame, 80 + i * 8, 8) }}>✓</div>
          </div>
        );
      })}
      <Cap at={8} size={78}>Your files in. MAS forms out.</Cap>
    </Stage>
  );
};

/** 8 · Fix 2: the capital ratio, by MAS's rule, in three big numbers. */
const Ratio: React.FC = () => {
  const frame = useCurrentFrame();
  const rows: [string, string, string][] = [["3-year average income", "5,599,000", ""], ["× 5%", "279,950", "the rule"], ["Your capital ÷ that", "1,143%", "✓"]];
  return (
    <Stage>
      <Corner />
      <div style={{ position: "absolute", left: 260, top: 160, width: 1400 }}>
        {rows.map(([k, v, tag], i) => {
          const p = pIn(frame, 8 + i * 14, 14);
          return (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "26px 40px", borderRadius: 18, background: "#fff", boxShadow: "0 14px 44px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.06)", marginBottom: 18, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
              <span style={{ fontSize: 40, fontWeight: 700, color: INK2 }}>{k}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <span style={{ fontFamily: MONO, fontSize: 56, fontWeight: 800, color: i === 2 ? BLUE : INK }}>{v}</span>
                {tag === "✓" ? <span style={{ width: 56, height: 56, borderRadius: 999, background: GREEN, color: "#fff", fontSize: 32, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", opacity: pIn(frame, 56, 10) }}>✓</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      <Cap at={8} size={78}>The capital ratio, by MAS's rule.</Cap>
    </Stage>
  );
};

/** 9 · Fix 3: watched monthly, warned before 120%. */
const Monitor: React.FC = () => {
  const frame = useCurrentFrame();
  const pts = [1143, 1080, 990, 870, 760, 640, 520, 410, 330, 260, 190, 150];
  const X0 = 300, Y0 = 600, W = 1320, H = 380, ymax = 1200;
  const draw = pIn(frame, 6, 56);
  const n = Math.max(1, Math.floor(draw * pts.length));
  const path = pts.slice(0, n).map((v, i) => `${i === 0 ? "M" : "L"} ${X0 + (i / 11) * W} ${Y0 - (v / ymax) * H}`).join(" ");
  const y120 = Y0 - (120 / ymax) * H;
  const bell = pIn(frame, 60, 10);
  const ring = frame >= 60 ? Math.sin((frame - 60) * 0.8) * 12 : 0;
  return (
    <Stage>
      <Corner />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={X0} y1={y120} x2={X0 + W} y2={y120} stroke={RED} strokeWidth={4} strokeDasharray="14 10" />
        <text x={X0} y={y120 - 16} fontFamily={SANS} fontSize={30} fontWeight={800} fill={RED}>120%</text>
        <path d={path} stroke={BLUE} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.slice(0, n).map((v, i) => (
          <circle key={i} cx={X0 + (i / 11) * W} cy={Y0 - (v / ymax) * H} r={9} fill={BLUE} />
        ))}
      </svg>
      <div style={{ position: "absolute", left: 1280, top: 250, width: 150, height: 150, borderRadius: 999, background: RED, display: "flex", alignItems: "center", justifyContent: "center", opacity: bell, transform: `rotate(${ring}deg) scale(${0.7 + bell * 0.3})`, boxShadow: "0 20px 50px rgba(216,35,42,0.35)" }}>
        <svg width={84} height={84} viewBox="0 0 24 24" fill="#fff"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11c0-3.1-1.6-5.6-4.5-6.3V4a2.5 2.5 0 0 0-5 0v.7C6.6 5.4 5 7.9 5 11v5l-2 2v1h18v-1l-2-2z" /></svg>
      </div>
      <Cap at={8} size={78}>Watched monthly. Warned before 120%.</Cap>
    </Stage>
  );
};

/** 10 · Fix 4: quarterly, annual, Form 25A. */
const AllForms: React.FC = () => {
  const frame = useCurrentFrame();
  const items: [string, string][] = [["Form 1·2", "every quarter"], ["Form 1–6", "every year"], ["Form 25A", "VC managers"]];
  return (
    <Stage>
      <Corner />
      {items.map(([k, v], i) => {
        const p = pIn(frame, 6 + i * 10, 14);
        return (
          <div key={k} style={{ position: "absolute", left: 300 + i * 460, top: 220, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
            <Paper label={k} w={340} accent={i === 1 ? BLUE : INK} />
            <div style={{ position: "absolute", right: -18, top: -18, width: 64, height: 64, borderRadius: 999, background: GREEN, color: "#fff", fontSize: 34, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", opacity: pIn(frame, 30 + i * 10, 10) }}>✓</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: INK2, textAlign: "center", marginTop: 22 }}>{v}</div>
          </div>
        );
      })}
      <Cap at={8} size={78}>Every form. Same engine.</Cap>
    </Stage>
  );
};

/** 11 · Day 1: the forms fly into the portal again, green. */
const DayOne: React.FC = () => (
  <Stage>
    <Corner />
    <Ring x={960} y={300} at={6} days={1} color={GREEN} text="day" />
    <Portal x={1400} y={330} at={2} done />
    <FlyingForms x0={180} y0={300} x1={1480} y1={400} a={12} b={50} />
    <div style={{ position: "absolute", left: 180, top: 640, fontSize: 30, fontWeight: 700, color: INK2 }}>30 Sep</div>
    <div style={{ position: "absolute", left: 1460, top: 640, fontSize: 30, fontWeight: 700, color: GREEN }}>1 Oct · sent</div>
    <Cap at={8} size={78}>Filed on Day 1. You just sign.</Cap>
  </Stage>
);

/** 12 · CTA. */
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 2, 14), b = pIn(frame, 16, 14), c = pIn(frame, 30, 12);
  return (
    <Stage>
      <div style={{ position: "absolute", left: "50%", top: 250, transform: `translateX(-50%) scale(${0.94 + a * 0.06})`, opacity: a }}>
        <Lockup size={100} color={INK} subColor="#5c5c5c" dot={BLUE} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 570, textAlign: "center", fontSize: 40, fontWeight: 700, color: INK, opacity: b, lineHeight: 1.3 }}>
        Send us last quarter's forms. <span style={{ color: BLUE }}>Back in a day.</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center", opacity: c }}>
        <span style={{ padding: "18px 36px", borderRadius: 999, background: INK, color: "#fff", fontSize: 24, fontWeight: 700 }}>Request a demo →</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 790, textAlign: "center", fontFamily: MONO, fontSize: 18, letterSpacing: 3, color: GREY, opacity: c }}>treasurer.net/core</div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ cut */

type S = { id: string; dur: number; body: React.FC };

export const MASFINAL_SCENES: S[] = [
  { id: "hook", dur: 3.0, body: Hook },
  { id: "two-forms", dur: 3.4, body: TwoForms },
  { id: "revoked", dur: 3.2, body: Revoked },
  { id: "pay", dur: 3.8, body: PayStillWork },
  { id: "formula", dur: 3.4, body: OneFormula },
  { id: "meet-core", dur: 1.6, body: MeetCore },
  { id: "files-in", dur: 3.6, body: FilesIn },
  { id: "ratio", dur: 3.2, body: Ratio },
  { id: "monitor", dur: 3.2, body: Monitor },
  { id: "all-forms", dur: 2.6, body: AllForms },
  { id: "day-one", dur: 3.0, body: DayOne },
  { id: "end", dur: 3.4, body: End },
];

const frames = (s: S) => Math.round(s.dur * FPS);
export const MASFINAL_FRAMES = MASFINAL_SCENES.reduce((a, s, i) => a + frames(s) - (i > 0 ? CUT : 0), 0);

export const MasFinal: React.FC = () => (
  <AbsoluteFill style={{ background: "#fff", fontFamily: SANS }}>
    <TransitionSeries>
      {MASFINAL_SCENES.flatMap((s, i) => {
        const Body = s.body;
        const nodes: React.ReactNode[] = [];
        if (i > 0) nodes.push(<TransitionSeries.Transition key={`t-${s.id}`} presentation={fade()} timing={linearTiming({ durationInFrames: CUT })} />);
        nodes.push(
          <TransitionSeries.Sequence key={s.id} durationInFrames={frames(s)}>
            <Body />
          </TransitionSeries.Sequence>
        );
        return nodes;
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
