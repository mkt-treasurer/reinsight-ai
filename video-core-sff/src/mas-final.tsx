/**
 * "MAS filing, Day 1" — v8, demo-ver look: Georgia serif statements on plain white, then Core's app window that
 * stays put while its content crossfades, a before/after bar, a signature-and-file scene, the Core end card.
 * Captions are flowing phrases, not full-stop lists. 0.47s crossfades.
 * Facts (checked 27 Oct 2026): Form 1 / Form 2 every quarter within 14 days via MAS-Tx; the same set audited
 * once a year within 5 months; MAS Notice SFA 04-N13 paras 4.1.2–4.1.4: operational risk requirement = 5% of the
 * 3-year average annual gross income, floor S$100,000; para 3.1.1: financial resources must not fall below the
 * total risk requirement and MAS must be told immediately below 120%. Names and numbers are illustrative.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Lockup, OMark } from "./Lockup";
import { BLUE, GREEN, GREY, INK, INK2, LINE, MONO, RED, SANS, Stage, pIn, lin } from "./mas-core";

const FPS = 30;
const CUT = 14;
const SERIF = "Georgia, 'Times New Roman', serif";
const EASE = Easing.bezier(0.22, 1, 0.32, 1);
const ease = (frame: number, a: number, b: number, from: number, to: number) =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

/* ------------------------------------------------------------------ bits */

const Statement: React.FC<{ a: string; b?: string; at?: number; size?: number; top?: number }> = ({ a, b, at = 4, size = 74, top }) => {
  const frame = useCurrentFrame();
  const p1 = pIn(frame, at, 16), p2 = pIn(frame, at + 16, 16);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: top ?? (b ? 400 : 470), textAlign: "center", fontFamily: SERIF }}>
      <div style={{ fontSize: size, color: INK, letterSpacing: -1, opacity: p1, transform: `translateY(${(1 - p1) * 10}px)` }}>{a}</div>
      {b ? <div style={{ fontSize: size * 0.86, color: "#8d8d8d", fontStyle: "italic", marginTop: 28, opacity: p2, transform: `translateY(${(1 - p2) * 10}px)` }}>{b}</div> : null}
    </div>
  );
};

const SerifCap: React.FC<{ at?: number; size?: number; children: React.ReactNode }> = ({ at = 6, size = 54, children }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 16);
  return <div style={{ position: "absolute", left: 0, right: 0, top: 850, textAlign: "center", fontFamily: SERIF, fontSize: size, color: INK, letterSpacing: -0.5, opacity: p, transform: `translateY(${(1 - p) * 10}px)`, whiteSpace: "nowrap" }}>{children}</div>;
};

const NAV: [string, string[]][] = [["RESEARCH", ["Ask", "Library", "Sources"]], ["MAS FILINGS", ["Quarterly forms", "Capital test", "Monthly tracking", "Filing calendar"]]];
const AppWindow: React.FC<{ active: string; title: string; children: React.ReactNode }> = ({ active, title, children }) => (
  <div style={{ position: "absolute", left: 192, top: 30, width: 1536, height: 835, borderRadius: 16, background: "#fafafa", boxShadow: "0 30px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)", overflow: "hidden", display: "flex" }}>
    <div style={{ width: 250, background: "#111318", color: "#c9ccd3", padding: "22px 18px", fontSize: 15, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 999, background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><OMark size={18} color="#111" /></span>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Core · MAS Desk</div>
          <div style={{ fontSize: 11, color: "#7c8190" }}>Treasurer · Demo</div>
        </div>
      </div>
      {NAV.map(([h, items]) => (
        <div key={h} style={{ marginTop: 26 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: "#6b7080" }}>{h}</div>
          {items.map((it) => (
            <div key={it} style={{ marginTop: 6, padding: "8px 10px", borderRadius: 7, background: it === active ? "#262a33" : "transparent", color: it === active ? "#fff" : "#aeb3bf", fontWeight: it === active ? 700 : 500 }}>{it}</div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: "auto", fontSize: 12, color: "#7c8190" }}>Harbour Demo Fund II · S$160M</div>
    </div>
    <div style={{ flex: 1, position: "relative" }}>
      <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderBottom: `1px solid ${LINE}`, fontSize: 14, color: GREY }}>
        <span>MAS filings / {active}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5 }}>Q3 2026 · DUE 14 OCT · MAS-TX</span>
      </div>
      <div style={{ padding: "26px 32px 0", fontSize: 30, fontWeight: 800, color: INK, letterSpacing: -0.6 }}>{title}</div>
      <div style={{ position: "absolute", left: 32, right: 32, top: 110, bottom: 30 }}>{children}</div>
    </div>
  </div>
);

const ScreenCap: React.FC<{ n: string; k: string; children: React.ReactNode; at?: number; size?: number }> = ({ n, k, children, at = 6, size = 46 }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 14);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 900, textAlign: "center", opacity: p }}>
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 5, color: BLUE, fontWeight: 700 }}>{n} · {k}</div>
      <div style={{ fontSize: size, fontWeight: 800, color: INK, letterSpacing: -1.2, marginTop: 10, whiteSpace: "nowrap" }}>{children}</div>
    </div>
  );
};

const Card: React.FC<{ x: number; y: number; w: number; h?: number; title?: string; children?: React.ReactNode; at?: number; style?: React.CSSProperties }> = ({ x, y, w, h, title, children, at = 0, style }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: "#fff", borderRadius: 12, boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.07)", padding: "18px 22px", opacity: pIn(frame, at, 12), ...style }}>
      {title ? <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 12 }}>{title}</div> : null}
      {children}
    </div>
  );
};

const Check: React.FC<{ at: number; size?: number }> = ({ at, size = 24 }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 8);
  return <span style={{ width: size, height: size, borderRadius: 999, background: GREEN, color: "#fff", fontSize: size * 0.6, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", transform: `scale(${p})`, flexShrink: 0 }}>✓</span>;
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
      {label ? <div style={{ fontFamily: SERIF, fontSize: 24, color: INK, marginTop: 6, whiteSpace: "nowrap" }}>{label}</div> : null}
    </div>
  );
};

const Paper: React.FC<{ label: string; w?: number; accent?: string; sub?: string }> = ({ label, w = 200, accent = INK, sub }) => (
  <div style={{ width: w, height: w * 1.28, background: "#fff", borderRadius: 12, boxShadow: "0 14px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", padding: w * 0.1, position: "relative" }}>
    <div style={{ fontFamily: SERIF, fontSize: w * 0.14, color: accent, whiteSpace: "nowrap" }}>{label}</div>
    {sub ? <div style={{ fontSize: w * 0.075, color: GREY, marginTop: 4 }}>{sub}</div> : null}
    {[0.8, 0.6, 0.7].map((x, i) => (
      <div key={i} style={{ height: w * 0.045, width: `${x * 100}%`, background: "#e3e3e3", borderRadius: 4, marginTop: w * 0.09 }} />
    ))}
  </div>
);

/* ------------------------------------------------------------------ scenes */

/** 1 · Opening: plain, serif, two forms. */
const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center", gap: 40 }}>
        {["Form 1", "Form 2"].map((f, i) => {
          const p = pIn(frame, 10 + i * 8, 16);
          return <div key={f} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px) rotate(${i ? 3 : -3}deg)` }}><Paper label={f} w={170} sub={i ? "capital test" : "balance sheet"} accent={i ? BLUE : INK} /></div>;
        })}
      </div>
      <Statement a="Two MAS forms to fill every quarter end" b="still doing it by hand?" top={450} />
    </Stage>
  );
};

/** 2 · Miss the deadline and it escalates. */
const Escalation: React.FC = () => {
  const frame = useCurrentFrame();
  const day = Math.floor(lin(frame, 6, 80, 14, 45));
  const hand = lin(frame, 6, 80, 0, 360 * 2.2);
  const steps: [string, string, number][] = [["a reminder", "#f5b400", 22], ["then scrutiny", "#f26b1d", 46], ["then a fine", RED, 70]];
  return (
    <Stage>
      <div style={{ position: "absolute", left: 300, top: 150, width: 420, height: 420, borderRadius: 999, background: "#fff", boxShadow: "0 30px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", opacity: pIn(frame, 2, 12) }}>
        <svg width={420} height={420} style={{ position: "absolute", left: 0, top: 0 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1={210 + Math.cos((i / 12) * Math.PI * 2) * 170} y1={210 + Math.sin((i / 12) * Math.PI * 2) * 170} x2={210 + Math.cos((i / 12) * Math.PI * 2) * 185} y2={210 + Math.sin((i / 12) * Math.PI * 2) * 185} stroke="#cfcfcf" strokeWidth={5} strokeLinecap="round" />
          ))}
          <line x1={210} y1={210} x2={210 + Math.cos(((hand - 90) * Math.PI) / 180) * 150} y2={210 + Math.sin(((hand - 90) * Math.PI) / 180) * 150} stroke={day > 30 ? RED : INK} strokeWidth={10} strokeLinecap="round" />
          <circle cx={210} cy={210} r={14} fill={day > 30 ? RED : INK} />
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", fontFamily: SERIF, fontSize: 28, color: day > 14 ? RED : GREY }}>Day {day} <span style={{ color: GREY, fontSize: 20 }}>of 14</span></div>
      </div>
      {steps.map(([k, c, at], i) => {
        const pp = pIn(frame, at, 12);
        return (
          <div key={k} style={{ position: "absolute", left: 860, top: 180 + i * 150, display: "flex", alignItems: "center", gap: 26, opacity: pp, transform: `translateX(${(1 - pp) * 40}px)` }}>
            <div style={{ width: 110, height: 110, borderRadius: 24, background: c, boxShadow: `0 18px 44px ${c}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {i === 0 ? (
                <svg width={58} height={58} viewBox="0 0 24 24" fill="#fff"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" /></svg>
              ) : i === 1 ? (
                <svg width={58} height={58} viewBox="0 0 24 24" fill="#fff"><path d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /></svg>
              ) : (
                <span style={{ color: "#fff", fontSize: 46, fontWeight: 900 }}>S$</span>
              )}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 46, color: INK }}>{k}</div>
          </div>
        );
      })}
      <SerifCap>Miss the deadline and it escalates</SerifCap>
    </Stage>
  );
};

/** 3 · One finance person retypes every number. */
const ByHand: React.FC = () => {
  const frame = useCurrentFrame();
  const srcs = ["Ledger", "Bank", "Admin"];
  return (
    <Stage>
      {srcs.map((f, i) => (
        <div key={f} style={{ position: "absolute", left: 160, top: 170 + i * 165, opacity: pIn(frame, 2 + i * 6, 12) }}><Paper label={f} w={190} accent={INK2} /></div>
      ))}
      <Person x={720} y={420} at={6} label="Priya, your finance person" />
      <div style={{ position: "absolute", left: 960, top: 190, width: 760, borderRadius: 14, background: "#fff", boxShadow: "0 18px 50px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden", opacity: pIn(frame, 4, 12) }}>
        <div style={{ height: 44, background: "#e8f5e9", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 16px", fontFamily: MONO, fontSize: 14, color: GREY }}>Q3_MAS_forms_working.xlsx</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const t = pIn(frame, 14 + i * 5, 6);
            return (
              <div key={i} style={{ height: 72, borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 18px", fontFamily: MONO, fontSize: 22, color: INK, background: t > 0 && t < 1 ? "rgba(47,107,255,0.10)" : "transparent" }}>
                <span style={{ opacity: t }}>{(((i * 7919) % 900000) + 100000).toLocaleString("en-US")}</span>
              </div>
            );
          })}
        </div>
      </div>
      {Array.from({ length: 6 }).map((_, i) => {
        const t = ease(frame, 10 + i * 10, 34 + i * 10, 0, 1);
        const y0 = 230 + (i % 3) * 165, y1 = 230 + Math.floor(i / 2) * 72;
        return <div key={i} style={{ position: "absolute", left: 360 + t * 640, top: y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 90, fontFamily: MONO, fontSize: 24, fontWeight: 700, color: BLUE, opacity: t > 0 && t < 0.96 ? 1 : 0 }}>{(((i * 7919) % 900000) + 100000).toLocaleString("en-US")}</div>;
      })}
      <SerifCap>One person in finance retypes every number, every quarter</SerifCap>
    </Stage>
  );
};

/** 4 · The capital-test formula lives in her spreadsheet — when she's away it breaks (literally). */
const Breaks: React.FC = () => {
  const frame = useCurrentFrame();
  const leave = pIn(frame, 30, 14);
  const crackAt = 52;
  const c = pIn(frame, crackAt, 10); // crack grows
  const fall = ease(frame, crackAt + 8, crackAt + 40, 0, 1); // halves fall apart
  const shake = frame >= crackAt && frame < crackAt + 8 ? Math.sin(frame * 4) * 8 : 0;
  const Half: React.FC<{ side: "l" | "r" }> = ({ side }) => (
    <div style={{ position: "absolute", left: 300, top: 180, width: 1320, height: 380, clipPath: side === "l" ? "polygon(0 0, 52% 0, 46% 100%, 0 100%)" : "polygon(52% 0, 100% 0, 100% 100%, 46% 100%)", transform: side === "l" ? `translate(${-fall * 60 + shake}px, ${fall * 40}px) rotate(${-fall * 6}deg)` : `translate(${fall * 80 + shake}px, ${fall * 120}px) rotate(${fall * 9}deg)`, transformOrigin: side === "l" ? "0% 100%" : "100% 100%", opacity: 1 - fall * 0.3 }}>
      <div style={{ width: 1320, height: 380, borderRadius: 18, background: "#f7f7f7", border: "1px solid #dcdcdc", overflow: "hidden" }}>
        <div style={{ height: 54, background: "#e8f5e9", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", fontFamily: MONO, fontSize: 18, color: INK2 }}>Priya_capital_test.xlsx &nbsp;·&nbsp; fx =MAX(0.05*AVERAGE('FY23'!R9,'FY24'!R9,'FY25'!R9),100000)/…</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 326 }}>
          <div style={{ fontFamily: SERIF, fontSize: 40, color: INK2 }}>Capital test <span style={{ color: GREY, fontSize: 26 }}>· MAS asks for this every quarter</span></div>
          <div style={{ fontFamily: MONO, fontSize: 90, fontWeight: 900, color: c > 0 ? RED : INK }}>{c > 0 ? "#REF!" : "1,143%"}</div>
        </div>
      </div>
    </div>
  );
  return (
    <Stage>
      <Half side="l" />
      <Half side="r" />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        <path d="M 986 180 L 972 250 L 1000 300 L 970 370 L 992 430 L 964 500 L 980 560" stroke={RED} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={600} strokeDashoffset={600 * (1 - c)} opacity={1 - fall} />
      </svg>
      <div style={{ position: "absolute", left: 1500, top: 110, transform: `translateX(${leave * 300}px)`, opacity: 1 - leave * 0.8 }}>
        <Person x={0} y={0} at={6} label="Priya, on leave" />
      </div>
      <SerifCap size={50}>That spreadsheet lives with her — when she's away, the test breaks</SerifCap>
    </Stage>
  );
};

/** 5 · Core card. */
const MeetCore: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 4, 16);
  return (
    <Stage dark>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: a, transform: `scale(${0.96 + a * 0.04})` }}>
        <Lockup size={110} color="#fff" subColor="#b9c1d1" dot="#5b7cff" />
      </div>
    </Stage>
  );
};

/** 6 · Screen 1: files go in, forms come out — animated inside the app. */
const Screen1: React.FC = () => {
  const frame = useCurrentFrame();
  const files = ["Ledger", "Bank", "Admin"];
  const forms: [string, string][] = [["Form 1", "balance sheet"], ["Form 2", "capital test"]];
  return (
    <Stage>
      <AppWindow active="Quarterly forms" title="Quarterly forms · quarter ended 30 Sep 2026">
        <div style={{ position: "absolute", left: 0, top: 0, fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: GREY }}>IN · YOUR FILES</div>
        <div style={{ position: "absolute", left: 980, top: 0, fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: GREY }}>OUT · MAS FORMS</div>
        {files.map((f, i) => {
          const t = ease(frame, 14 + i * 8, 44 + i * 8, 0, 1);
          const x0 = 0, y0 = 40 + i * 150, x1 = 540, y1 = 170;
          return (
            <div key={f} style={{ position: "absolute", left: x0 + (x1 - x0) * t, top: y0 + (y1 - y0) * t, transform: `scale(${1 - t * 0.6})`, transformOrigin: "50% 50%", opacity: t < 0.95 ? 1 : 0 }}>
              <Paper label={f} w={150} accent={INK2} />
            </div>
          );
        })}
        <svg width={1240} height={700} style={{ position: "absolute", left: 0, top: 0 }}>
          {[0, 1, 2].map((i) => <path key={i} d={`M 160 ${110 + i * 150} C 350 ${110 + i * 150}, 400 260, 540 260`} stroke="#d5d5d5" strokeWidth={2} fill="none" strokeDasharray="8 8" />)}
          {[0, 1].map((i) => <path key={i} d={`M 700 260 C 850 260, 850 ${160 + i * 240}, 980 ${160 + i * 240}`} stroke={BLUE} strokeWidth={2.5} fill="none" strokeDasharray={400} strokeDashoffset={400 * (1 - pIn(frame, 50 + i * 8, 16))} />)}
        </svg>
        <div style={{ position: "absolute", left: 540, top: 180, width: 160, height: 160, borderRadius: 999, background: INK, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 ${pIn(frame, 40, 20) * 18}px rgba(47,107,255,0.12)` }}>
          <span style={{ display: "inline-flex", alignItems: "center", color: "#fff", fontWeight: 500, fontSize: 30, letterSpacing: 9, paddingLeft: 9 }}>C<span style={{ display: "inline-block", margin: "0 9px 0 -2px", marginTop: 2 }}><OMark size={23} color="#fff" /></span>RE</span>
        </div>
        {forms.map(([f, s], i) => {
          const t = ease(frame, 56 + i * 10, 86 + i * 10, 0, 1);
          return (
            <div key={f} style={{ position: "absolute", left: 700 + (980 - 700) * t, top: 200 + (80 + i * 240 - 200) * t, transform: `scale(${0.4 + t * 0.6})`, opacity: t }}>
              <Paper label={f} w={170} sub={s} accent={i ? BLUE : INK} />
              <div style={{ position: "absolute", right: -12, top: -12 }}><Check at={90 + i * 10} size={40} /></div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 980, top: 560, display: "flex", gap: 10, opacity: pIn(frame, 104, 10) }}>
          <span style={{ padding: "10px 18px", borderRadius: 999, background: INK, color: "#fff", fontSize: 16, fontWeight: 700 }}>Export for MAS-Tx</span>
        </div>
      </AppWindow>
      <ScreenCap n="01" k="QUARTERLY FORMS">Your ledger, bank and admin files go in — the two MAS forms come out</ScreenCap>
    </Stage>
  );
};

/** 7 · Screen 2: the MAS rule, written out, then computed. */
const Screen2: React.FC = () => {
  const frame = useCurrentFrame();
  const rows: [string, string, string, number][] = [
    ["Average income, last 3 years", "4.91m · 5.60m · 6.28m", "5,599,000", 30],
    ["× 5%  (MAS's minimum capital requirement)", "floor S$100,000", "279,950", 42],
    ["Your capital", "paid-up capital + retained profit − deductions", "3,200,118", 54],
  ];
  return (
    <Stage>
      <AppWindow active="Capital test" title="Capital test · as at 30 Sep 2026">
        <Card x={0} y={0} w={1240} at={4} style={{ background: "#111318", color: "#fff" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: "#8b90a0" }}>THE RULE · MAS NOTICE SFA 04-N13, PARAS 3.1.1 AND 4.1.2</div>
          <div style={{ fontFamily: SERIF, fontSize: 30, marginTop: 12, lineHeight: 1.35 }}>
            Your capital ÷ (5% × your 3-year average income) must stay above <span style={{ color: "#7da2ff" }}>120%</span> — fall below and you must tell MAS immediately
          </div>
        </Card>
        <Card x={0} y={190} w={760} at={24}>
          {rows.map(([k, s, v, at]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${LINE}`, opacity: pIn(frame, at, 12) }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>{k}</div>
                <div style={{ fontSize: 13, color: GREY, marginTop: 2 }}>{s}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: INK }}>{v}</div>
            </div>
          ))}
        </Card>
        <Card x={800} y={190} w={440} h={296} at={60}>
          <div style={{ fontSize: 14, color: GREY }}>3,200,118 ÷ 279,950</div>
          <div style={{ fontSize: 92, fontWeight: 800, color: BLUE, letterSpacing: -3, marginTop: 8, lineHeight: 1 }}>1,143%</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, fontSize: 18, color: INK, fontWeight: 600 }}><Check at={74} /> Well above 120% — nothing to report</div>
        </Card>
      </AppWindow>
      <ScreenCap n="02" k="CAPITAL TEST">The capital test, computed exactly the way MAS writes it</ScreenCap>
    </Stage>
  );
};

/** 8 · Screen 3: the ratio tracked monthly, warned before the limit. */
const Screen3: React.FC = () => {
  const frame = useCurrentFrame();
  const pts = [1143, 1080, 990, 870, 760, 640, 520, 410, 330, 260, 190, 150];
  const W = 760, H = 300, X0 = 40, Y0 = 330, ymax = 1200;
  const draw = pIn(frame, 8, 56);
  const n = Math.max(1, Math.floor(draw * pts.length));
  const path = pts.slice(0, n).map((v, i) => `${i === 0 ? "M" : "L"} ${X0 + (i / 11) * W} ${Y0 - (v / ymax) * H}`).join(" ");
  const y120 = Y0 - (120 / ymax) * H;
  return (
    <Stage>
      <AppWindow active="Monthly tracking" title="Your capital ratio, month by month">
        <Card x={0} y={0} w={840} h={420} at={4}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Capital ÷ requirement, recomputed every month-end</div>
          <svg width={800} height={370} style={{ position: "absolute", left: 0, top: 30 }}>
            <line x1={X0} y1={y120} x2={X0 + W} y2={y120} stroke={RED} strokeWidth={3} strokeDasharray="10 8" />
            <text x={X0} y={y120 - 12} fontFamily={SANS} fontSize={17} fontWeight={800} fill={RED}>MAS limit · 120%</text>
            <path d={path} stroke={BLUE} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {pts.slice(0, n).map((v, i) => <circle key={i} cx={X0 + (i / 11) * W} cy={Y0 - (v / ymax) * H} r={6} fill={BLUE} />)}
            {n >= 12 ? <circle cx={X0 + W} cy={Y0 - (150 / ymax) * H} r={14} fill="none" stroke={RED} strokeWidth={3} opacity={0.6 + 0.4 * Math.abs(Math.sin(frame / 5))} /> : null}
            {["Oct", "Jan", "Apr", "Jul", "Sep"].map((m, i) => <text key={m} x={X0 + (i / 4) * W} y={Y0 + 28} textAnchor="middle" fontFamily={MONO} fontSize={12} fill={GREY}>{m.toUpperCase()}</text>)}
          </svg>
        </Card>
        <Card x={880} y={0} w={360} at={60}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 999, background: RED, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="#fff"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11c0-3.1-1.6-5.6-4.5-6.3V4a2.5 2.5 0 0 0-5 0v.7C6.6 5.4 5 7.9 5 11v5l-2 2v1h18v-1l-2-2z" /></svg>
            </span>
            <div style={{ fontSize: 17, fontWeight: 700, color: INK }}>Warning · June</div>
          </div>
          <div style={{ fontSize: 17, color: INK2, marginTop: 14, lineHeight: 1.4 }}>At this pace you cross the MAS limit in September. Add capital or hold the dividend now.</div>
        </Card>
        <Card x={880} y={230} w={360} at={76}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Why it's falling</div>
          <div style={{ fontSize: 15, color: INK2, marginTop: 8, lineHeight: 1.4 }}>Fee income up → the 5% requirement rises; dividend paid in May → capital down.</div>
        </Card>
      </AppWindow>
      <ScreenCap n="03" k="MONTHLY TRACKING">Tracked monthly, so you're warned months before you hit MAS's limit</ScreenCap>
    </Stage>
  );
};

/** 9 · Screen 4: the year — two forms each quarter, the audited set once a year. */
const Screen4: React.FC = () => {
  const frame = useCurrentFrame();
  const quarters: [string, string][] = [["Q1", "by 14 Apr"], ["Q2", "by 14 Jul"], ["Q3", "by 14 Oct"], ["Q4", "by 14 Jan"]];
  return (
    <Stage>
      <AppWindow active="Filing calendar" title="Your MAS year · financial year ending 31 Dec">
        <div style={{ display: "flex", gap: 14 }}>
          {quarters.map(([q, d], i) => (
            <Card key={q} x={0} y={0} w={230} h={300} at={6 + i * 8} style={{ position: "relative" }}>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 2, color: GREY }}>{q.toUpperCase()}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}><Paper label="1" w={70} /><Paper label="2" w={70} accent={BLUE} /></div>
              <div style={{ fontSize: 20, fontWeight: 800, color: INK, marginTop: 16 }}>2 forms</div>
              <div style={{ fontSize: 14, color: GREY, marginTop: 2 }}>{d}</div>
            </Card>
          ))}
          <Card x={0} y={0} w={260} h={300} at={44} style={{ position: "relative", background: "#eef2ff" }}>
            <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 2, color: BLUE }}>YEAR END</div>
            <div style={{ display: "flex", gap: 5, marginTop: 14 }}>{[1, 2, 3, 4].map((k) => <Paper key={k} label={String(k)} w={48} accent={k > 2 ? BLUE : INK} />)}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: INK, marginTop: 16 }}>Audited set</div>
            <div style={{ fontSize: 14, color: GREY, marginTop: 2 }}>once a year · by 31 May</div>
          </Card>
        </div>
        <div style={{ position: "absolute", left: 0, top: 340, display: "flex", alignItems: "center", gap: 12, fontSize: 20, color: INK2, opacity: pIn(frame, 62, 12) }}><Check at={66} /> All of it from the same account mapping — set up once, reused all year</div>
      </AppWindow>
      <ScreenCap n="04" k="THE WHOLE YEAR" size={44}>Two forms each quarter, the audited set once a year — all from one mapping</ScreenCap>
    </Stage>
  );
};

/** 10 · Before / after bars. */
const Compare: React.FC = () => {
  const frame = useCurrentFrame();
  const rows: [string, number, string, number][] = [["Last quarter, by hand", 12, RED, 8], ["With Core", 1, BLUE, 30]];
  const max = 14;
  return (
    <Stage>
      <div style={{ position: "absolute", left: 260, top: 230, width: 1400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 14, letterSpacing: 2, color: GREY, paddingLeft: 420 }}>
          <span>QUARTER END</span><span>MAS DEADLINE · DAY 14</span>
        </div>
        {rows.map(([k, d, c, at]) => {
          const w = ease(frame, at, at + 40, 0, d / max);
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 44 }}>
              <div style={{ width: 390, fontFamily: SERIF, fontSize: 34, color: INK, textAlign: "right" }}>{k}</div>
              <div style={{ flex: 1, height: 96, borderRadius: 16, background: "#f1f1f1", overflow: "hidden" }}>
                <div style={{ width: `${w * 100}%`, height: "100%", background: c, borderRadius: 16 }} />
              </div>
              <div style={{ width: 180, fontSize: 44, fontWeight: 800, color: c, whiteSpace: "nowrap", opacity: pIn(frame, at + 30, 10) }}>{d} {d === 1 ? "day" : "days"}</div>
            </div>
          );
        })}
      </div>
      <SerifCap size={60}>From twelve days to one</SerifCap>
    </Stage>
  );
};

/** 11 · You review and sign, Core files it. */
const Sign: React.FC = () => {
  const frame = useCurrentFrame();
  const sig = pIn(frame, 20, 34);
  const stamp = pIn(frame, 62, 10);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 560, top: 110, width: 800, height: 620, borderRadius: 14, background: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)", padding: "40px 48px", opacity: pIn(frame, 2, 14) }}>
        <div style={{ fontFamily: SERIF, fontSize: 30, color: INK }}>Form 1 · Form 2</div>
        <div style={{ fontSize: 16, color: GREY, marginTop: 4 }}>quarter ended 30 Sep 2026 · prepared by Core · every number traced</div>
        {[0.85, 0.6, 0.75, 0.5, 0.7].map((x, i) => (
          <div key={i} style={{ height: 10, width: `${x * 100}%`, background: "#e6e6e6", borderRadius: 5, marginTop: 24 }} />
        ))}
        <div style={{ position: "absolute", left: 48, bottom: 48 }}>
          <div style={{ fontSize: 14, color: GREY }}>Reviewed and signed</div>
          <svg width={360} height={90} style={{ marginTop: 4 }}>
            <path d="M 10 60 C 40 10, 60 80, 90 40 S 140 20, 160 55 S 210 80, 240 35 S 300 30, 340 50" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeDasharray={700} strokeDashoffset={700 * (1 - sig)} />
          </svg>
          <div style={{ fontFamily: SERIF, fontSize: 18, color: INK2 }}>David Tan, Managing Partner · 1 Oct</div>
        </div>
        <div style={{ position: "absolute", right: 48, bottom: 70, padding: "14px 22px", border: `5px solid ${GREEN}`, borderRadius: 12, color: GREEN, fontFamily: MONO, fontSize: 26, fontWeight: 800, letterSpacing: 3, transform: `rotate(-10deg) scale(${1.6 - stamp * 0.6})`, opacity: stamp }}>FILED · MAS-Tx</div>
      </div>
      <SerifCap size={56}>You review and sign — Core files it with MAS</SerifCap>
    </Stage>
  );
};

/** 12 · Serif closer. */
const Close: React.FC = () => (
  <Stage>
    <Statement a="Less retyping, more running the fund" />
  </Stage>
);

/** 13 · End card. */
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 2, 16), b = pIn(frame, 18, 14);
  return (
    <Stage>
      <div style={{ position: "absolute", left: "50%", top: 330, transform: `translateX(-50%) scale(${0.94 + a * 0.06})`, opacity: a }}>
        <Lockup size={110} color={INK} subColor="#5c6478" dot="#4f7cff" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 650, display: "flex", justifyContent: "center", opacity: b }}>
        <span style={{ padding: "20px 40px", borderRadius: 999, background: "#111318", color: "#fff", fontSize: 26, fontWeight: 700 }}>Book a demo →</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", fontSize: 24, color: "#5c6478", opacity: b }}>Runs in your VPC or on-prem. Your data never leaves.</div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ cut */

type S = { id: string; dur: number; body: React.FC };

export const MASFINAL_SCENES: S[] = [
  { id: "opening", dur: 4.0, body: Opening },
  { id: "escalation", dur: 3.6, body: Escalation },
  { id: "by-hand", dur: 3.8, body: ByHand },
  { id: "breaks", dur: 3.8, body: Breaks },
  { id: "core", dur: 1.8, body: MeetCore },
  { id: "screen-1", dur: 4.2, body: Screen1 },
  { id: "screen-2", dur: 4.0, body: Screen2 },
  { id: "screen-3", dur: 3.8, body: Screen3 },
  { id: "screen-4", dur: 3.4, body: Screen4 },
  { id: "compare", dur: 3.4, body: Compare },
  { id: "sign", dur: 3.6, body: Sign },
  { id: "close", dur: 2.4, body: Close },
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
