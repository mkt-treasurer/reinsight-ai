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
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
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

/** Text leaves before the crossfade starts and arrives after it ends, so two captions are never on screen together. */
const useTextWindow = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return 1 - pIn(frame, durationInFrames - CUT - 6, 6);
};

const Statement: React.FC<{ a: string; b?: string; at?: number; size?: number; top?: number }> = ({ a, b, at = 16, size = 74, top }) => {
  const frame = useCurrentFrame();
  const out = useTextWindow();
  const p1 = pIn(frame, at, 16) * out, p2 = pIn(frame, at + 16, 16) * out;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: top ?? (b ? 400 : 470), textAlign: "center", fontFamily: SERIF }}>
      <div style={{ fontSize: size, color: INK, letterSpacing: -1, opacity: p1, transform: `translateY(${(1 - p1) * 10}px)` }}>{a}</div>
      {b ? <div style={{ fontSize: size * 0.86, color: INK, fontStyle: "italic", marginTop: 28, opacity: p2, transform: `translateY(${(1 - p2) * 10}px)` }}>{b}</div> : null}
    </div>
  );
};

const SerifCap: React.FC<{ at?: number; size?: number; children: React.ReactNode }> = ({ at = 10, size = 54, children }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 16) * useTextWindow();
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

const ScreenCap: React.FC<{ n: string; k: string; children: React.ReactNode; at?: number; size?: number }> = ({ n, k, children, at = 10, size = 46 }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 14) * useTextWindow();
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 900, textAlign: "center", opacity: p }}>
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 5, color: BLUE, fontWeight: 700 }}>{n} · {k}</div>
      <div style={{ fontFamily: SERIF, fontSize: size, color: INK, letterSpacing: -0.5, marginTop: 10, whiteSpace: "nowrap" }}>{children}</div>
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
      <div style={{ position: "absolute", left: 0, right: 0, top: 80, display: "flex", justifyContent: "center", gap: 60 }}>
        {["Form 1", "Form 2"].map((f, i) => {
          const p = pIn(frame, 10 + i * 8, 16);
          return <div key={f} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px) rotate(${i ? 3 : -3}deg)` }}><Paper label={f} w={250} sub={i ? "capital test" : "balance sheet"} accent={i ? BLUE : INK} /></div>;
        })}
      </div>
      <Statement a="Two MAS forms to fill every quarter end" b="still doing it by hand?" top={500} />
    </Stage>
  );
};

/** 2 · Miss the deadline and it escalates. */
const Escalation: React.FC = () => {
  const frame = useCurrentFrame();
  const day = Math.floor(lin(frame, 6, 100, 14, 60));
  const hand = frame * 7.5;
  const steps: [string, string, number][] = [["a reminder", "#f5b400", 22], ["then scrutiny", "#f26b1d", 46], ["then a fine", RED, 70]];
  return (
    <Stage>
      <div style={{ position: "absolute", left: 220, top: 110, width: 540, height: 540, borderRadius: 999, background: "#fff", boxShadow: "0 30px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", opacity: pIn(frame, 2, 12) }}>
        <svg width={540} height={540} style={{ position: "absolute", left: 0, top: 0 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1={270 + Math.cos((i / 12) * Math.PI * 2) * 222} y1={270 + Math.sin((i / 12) * Math.PI * 2) * 222} x2={270 + Math.cos((i / 12) * Math.PI * 2) * 240} y2={270 + Math.sin((i / 12) * Math.PI * 2) * 240} stroke="#cfcfcf" strokeWidth={5} strokeLinecap="round" />
          ))}
          <line x1={270} y1={270} x2={270 + Math.cos(((hand - 90) * Math.PI) / 180) * 195} y2={270 + Math.sin(((hand - 90) * Math.PI) / 180) * 195} stroke={day > 30 ? RED : INK} strokeWidth={10} strokeLinecap="round" />
          <circle cx={270} cy={270} r={14} fill={day > 30 ? RED : INK} />
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, top: 390, textAlign: "center", fontFamily: SERIF, fontSize: 30, color: day > 14 ? RED : GREY }}>Day {day} <span style={{ color: GREY, fontSize: 20 }}>of 14</span></div>
      </div>
      {steps.map(([k, c, at], i) => {
        const pp = pIn(frame, at, 12);
        return (
          <div key={k} style={{ position: "absolute", left: 880, top: 150 + i * 180, display: "flex", alignItems: "center", gap: 26, opacity: pp, transform: `translateX(${(1 - pp) * 40}px)` }}>
            <div style={{ width: 136, height: 136, borderRadius: 28, background: c, boxShadow: `0 18px 44px ${c}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {i === 0 ? (
                <svg width={70} height={70} viewBox="0 0 24 24" fill="#fff"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" /></svg>
              ) : i === 1 ? (
                <svg width={70} height={70} viewBox="0 0 24 24" fill="#fff"><path d="M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /></svg>
              ) : (
                <span style={{ color: "#fff", fontSize: 56, fontWeight: 900 }}>S$</span>
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
        <div key={f} style={{ position: "absolute", left: 110, top: 130 + i * 200, opacity: pIn(frame, 6 + i * 6, 12) }}><Paper label={f} w={230} accent={INK2} /></div>
      ))}
      <Person x={640} y={420} at={10} label="Priya, your finance person" size={150} />
      <Sheet x={860} y={120} w={920} name="Q3_MAS_forms_working.xlsx" cell="C5" formula="=SUM(C1:C4)" rows={[["Cash at bank — DBS SGD", "2,904,117", "from TB"], ["Cash at bank — USD", "1,224,683", "from TB"], ["Fees receivable", "912,415", "from admin"], ["Other assets", "88,470", "from TB"], ["Total assets", "5,129,685", "typed"], ["Capital", "3,200,118", "typed"]]} tabs={["Form 1", "Form 2", "TB Sep", "Bank", "Admin"]} cellAt={(i) => 24 + i * 9} style={{ opacity: pIn(frame, 8, 12) }} />
      <SerifCap>One person in finance retypes every number, every quarter</SerifCap>
    </Stage>
  );
};

/** A spreadsheet that looks like one: column letters, row numbers, formula bar, sheet tabs. */
const COLS = ["A", "B", "C", "D"];
const Sheet: React.FC<{ x: number; y: number; w: number; name: string; formula: string; cell: string; rows: [string, string, string?][]; tabs: string[]; deadTab?: string; dead?: number; highlight?: number; style?: React.CSSProperties; cellAt?: (i: number) => number }> = ({ x, y, w, name, formula, cell, rows, tabs, deadTab, dead = 0, highlight, style, cellAt }) => {
  const frame = useCurrentFrame();
  const colW = [60, (w - 60) * 0.5, (w - 60) * 0.3, (w - 60) * 0.2];
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, background: "#fff", borderRadius: 10, border: "1px solid #c9c9c9", overflow: "hidden", fontFamily: SANS, ...style }}>
      <div style={{ height: 40, background: "#217346", color: "#fff", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 15, fontWeight: 700 }}>{name}</div>
      <div style={{ height: 40, display: "flex", alignItems: "center", borderBottom: "1px solid #d4d4d4", fontFamily: MONO, fontSize: 15 }}>
        <span style={{ width: 70, textAlign: "center", color: INK2, borderRight: "1px solid #d4d4d4" }}>{cell}</span>
        <span style={{ padding: "0 12px", color: GREY }}>fx</span>
        <span style={{ color: INK, whiteSpace: "nowrap", overflow: "hidden" }}>{formula}</span>
      </div>
      <div style={{ display: "flex", background: "#f3f3f3", borderBottom: "1px solid #d4d4d4" }}>
        {["", ...COLS.slice(1)].map((c, i) => <div key={i} style={{ width: colW[i], height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: GREY, borderRight: "1px solid #d4d4d4" }}>{i === 0 ? "" : COLS[i]}</div>)}
      </div>
      {rows.map(([a, b, c], i) => {
        const t = cellAt ? pIn(frame, cellAt(i), 6) : 1;
        const hi = highlight === i;
        const broken = dead > 0.5 && b.startsWith("=");
        return (
          <div key={i} style={{ display: "flex", borderBottom: "1px solid #e4e4e4", background: hi ? "rgba(47,107,255,0.08)" : "transparent" }}>
            <div style={{ width: colW[0], height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: GREY, background: "#f3f3f3", borderRight: "1px solid #d4d4d4" }}>{i + 1}</div>
            <div style={{ width: colW[1], height: 44, display: "flex", alignItems: "center", padding: "0 12px", fontSize: 17, color: INK2, borderRight: "1px solid #e4e4e4" }}>{a}</div>
            <div style={{ width: colW[2], height: 44, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 12px", fontFamily: MONO, fontSize: 17, color: broken ? RED : INK, fontWeight: broken ? 800 : 400, borderRight: "1px solid #e4e4e4", opacity: t, outline: hi ? `2px solid ${BLUE}` : "none", outlineOffset: -2 }}>{broken ? "#REF!" : b.startsWith("=") ? b.slice(1) : b}</div>
            <div style={{ width: colW[3], height: 44, display: "flex", alignItems: "center", padding: "0 10px", fontSize: 13, color: GREY, whiteSpace: "nowrap", overflow: "hidden" }}>{c ?? ""}</div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 2, padding: "6px 8px", background: "#f3f3f3", borderTop: "1px solid #d4d4d4" }}>
        {tabs.map((t) => {
          const isDead = t === deadTab;
          return <span key={t} style={{ fontSize: 13, padding: "5px 12px", background: isDead ? `rgba(216,35,42,${0.08 + dead * 0.25})` : t === tabs[0] ? "#fff" : "#e6e6e6", color: isDead ? RED : INK2, border: "1px solid #d4d4d4", borderRadius: 3, textDecoration: isDead && dead > 0.5 ? "line-through" : "none", opacity: isDead ? 1 - dead * 0.5 : 1 }}>{t}</span>;
        })}
      </div>
    </div>
  );
};

/** 4 · What the capital test is: MAS's minimum vs your capital, with the 120% line. */
const CapitalTest: React.FC = () => {
  const frame = useCurrentFrame();
  const minW = ease(frame, 14, 44, 0, 180);
  const youW = ease(frame, 30, 70, 0, 1180);
  const line = pIn(frame, 48, 12);
  const Row: React.FC<{ y: number; label: string; sub: string; w: number; color: string; at: number; val: string; off?: number }> = ({ y, label, sub, w, color, at, val, off = 22 }) => (
    <div style={{ position: "absolute", left: 160, top: y, width: 1600, opacity: pIn(frame, at, 12) }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontFamily: SERIF, fontSize: 40, color: INK }}>{label}</span>
      </div>
      <div style={{ position: "relative", height: 86, marginTop: 14 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: w, height: 86, borderRadius: 14, background: color }} />
        <div style={{ position: "absolute", left: w + off, top: 0, height: 86, display: "flex", alignItems: "center", fontFamily: SERIF, fontSize: 40, color, whiteSpace: "nowrap", opacity: pIn(frame, at + 36, 10) }}>{val}</div>
      </div>
    </div>
  );
  return (
    <Stage>
      <Row y={150} label="MAS's minimum capital" sub="" w={minW} color="#8d8d8d" at={6} val="S$0.28m" off={70} />
      <Row y={400} label="Your capital" sub="" w={youW} color={BLUE} at={22} val="S$3.2m" />
      <div style={{ position: "absolute", left: 160 + 216, top: 210, height: 94, width: 4, background: RED, opacity: line }} />
      <div style={{ position: "absolute", left: 160 + 216, top: 460, height: 94, width: 4, background: RED, opacity: line }} />
      <div style={{ position: "absolute", left: 160, top: 640, fontFamily: SERIF, fontSize: 40, color: INK, opacity: pIn(frame, 80, 14) * useTextWindow() }}>
        Your capital ÷ MAS's minimum = <span style={{ color: BLUE }}>1,143%</span>
      </div>
      <SerifCap size={52}>The capital test — every quarter MAS checks your capital against its minimum</SerifCap>
    </Stage>
  );
};

/** 5 · Excel doesn't know MAS's rules: the deductions MAS requires are missing, the ratio looks fine, and the wrong number gets filed. */
const WrongButFine: React.FC = () => {
  const frame = useCurrentFrame();
  const rule = pIn(frame, 44, 12); // MAS's rule arrives
  const fixed = frame >= 70;
  const rows: [string, string, string?][] = [
    ["MAS's minimum capital", "279,950", "5% of 3-yr average income"],
    ["Paid-up capital + retained profit", "3,612,588", "from TB"],
    ...(rule > 0 ? ([["− Prepaid rent and insurance", "−88,470", "MAS: deduct"], ["− Office fit-out", "−124,000", "MAS: deduct"], ["− Loan to a related company", "−200,000", "MAS: deduct"]] as [string, string, string?][]) : []),
    ["Your capital", fixed ? "3,200,118" : "3,612,588", fixed ? "after deductions" : "no deductions"],
    ["Ratio = capital ÷ minimum", fixed ? "1,143%" : "1,290%", fixed ? "=C6/C1" : "=C3/C1"],
  ];
  return (
    <Stage>
      <Sheet x={300} y={110} w={1320} name="capital_test.xlsx" cell={fixed ? "C7" : "C4"} formula={fixed ? "=C6/C1" : "=C3/C1"} rows={rows} tabs={["Summary", "FY23", "FY24", "FY25", "TB Sep"]} highlight={rows.length - 1} style={{ opacity: pIn(frame, 2, 12) }} />
      {/* the green tick on the wrong number */}
      <div style={{ position: "absolute", left: 1640, top: 110 + 80 + 28 + (rows.length - 1) * 44 + 4, width: 40, height: 40, borderRadius: 999, background: fixed ? RED : GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, opacity: pIn(frame, 20, 10) }}>{fixed ? "✗" : "✓"}</div>
      {/* MAS's rule stamp */}
      <div style={{ position: "absolute", left: 1180, top: 40, padding: "12px 20px", border: `4px solid ${RED}`, borderRadius: 10, color: RED, fontFamily: SERIF, fontSize: 30, transform: `rotate(-6deg) scale(${1.4 - rule * 0.4})`, opacity: rule, whiteSpace: "nowrap" }}>MAS's rule: deduct these</div>
      <SerifCap size={48}>Excel doesn't know MAS's rules — a wrong number looks right until MAS checks</SerifCap>
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
              <Paper label={f} w={180} accent={INK2} />
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
              <Paper label={f} w={200} sub={s} accent={i ? BLUE : INK} />
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
    ["× 5%  (MAS's minimum capital requirement)", "operational risk requirement", "279,950", 42],
    ["Your capital", "paid-up capital + retained profit − deductions", "3,200,118", 54],
  ];
  return (
    <Stage>
      <AppWindow active="Capital test" title="Capital test · as at 30 Sep 2026">
        <Card x={0} y={0} w={1240} at={4} style={{ background: "#111318", color: "#fff" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: "#8b90a0" }}>THE RULE · MAS NOTICE SFA 04-N13, PARAS 3.1.1 AND 4.1.2</div>
          <div style={{ fontFamily: SERIF, fontSize: 31, marginTop: 12, lineHeight: 1.35 }}>
            Your capital must not fall below 5% × your 3-year average income — and if it dips under <span style={{ color: "#7da2ff" }}>120%</span> of that, you must tell MAS immediately
          </div>
        </Card>
        <Card x={0} y={190} w={760} at={24}>
          {rows.map(([k, s, v, at]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${LINE}`, opacity: pIn(frame, at, 12) }}>
              <div>
                <div style={{ fontSize: 21, fontWeight: 700, color: INK }}>{k}</div>
                <div style={{ fontSize: 14, color: GREY, marginTop: 2 }}>{s}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: INK }}>{v}</div>
            </div>
          ))}
        </Card>
        <Card x={800} y={190} w={440} h={296} at={60}>
          <div style={{ fontSize: 14, color: GREY }}>3,200,118 ÷ 279,950</div>
          <div style={{ fontSize: 92, fontWeight: 800, color: BLUE, letterSpacing: -3, marginTop: 8, lineHeight: 1 }}>1,143%</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, fontSize: 18, color: INK, fontWeight: 600 }}><Check at={74} /> Well above 120% — nothing to notify</div>
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
            <text x={X0} y={y120 - 12} fontFamily={SANS} fontSize={17} fontWeight={800} fill={RED}>120% · must tell MAS below this</text>
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
          <div style={{ fontSize: 17, color: INK2, marginTop: 14, lineHeight: 1.4 }}>At this pace you drop under 120% in September and must notify MAS. Add capital or hold the dividend now.</div>
        </Card>
        <Card x={880} y={230} w={360} at={76}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Why it's falling</div>
          <div style={{ fontSize: 15, color: INK2, marginTop: 8, lineHeight: 1.4 }}>Dividend paid in May and two loss-making quarters → retained profit, and so your capital, down.</div>
        </Card>
      </AppWindow>
      <ScreenCap n="03" k="MONTHLY TRACKING">Tracked monthly, so you're warned months before you'd have to tell MAS</ScreenCap>
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
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 24, color: GREY, opacity: pIn(frame, 50, 12) * useTextWindow() }}>a typical quarter, illustrative</div>
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
      <div style={{ position: "absolute", left: 500, top: 90, width: 920, height: 650, borderRadius: 14, background: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)", padding: "40px 48px", opacity: pIn(frame, 2, 14) }}>
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
        <div style={{ position: "absolute", right: 48, bottom: 70, padding: "14px 22px", border: `5px solid ${GREEN}`, borderRadius: 12, color: GREEN, fontFamily: MONO, fontSize: 24, fontWeight: 800, letterSpacing: 3, transform: `rotate(-10deg) scale(${1.6 - stamp * 0.6})`, opacity: stamp }}>READY · MAS-Tx</div>
      </div>
      <SerifCap size={56}>You review and sign — it's ready to submit on MAS-Tx</SerifCap>
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
      <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", fontFamily: SERIF, fontSize: 26, color: "#5c6478", opacity: b }}>Runs in your VPC or on-prem. Your data never leaves.</div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ cut */

type S = { id: string; dur: number; body: React.FC };

export const MASFINAL_SCENES: S[] = [
  { id: "opening", dur: 4.2, body: Opening },
  { id: "escalation", dur: 3.6, body: Escalation },
  { id: "by-hand", dur: 3.8, body: ByHand },
  { id: "capital-test", dur: 4.4, body: CapitalTest },
  { id: "wrong-but-fine", dur: 4.8, body: WrongButFine },
  { id: "core", dur: 1.0, body: MeetCore },
  { id: "screen-1", dur: 4.4, body: Screen1 },
  { id: "screen-2", dur: 4.6, body: Screen2 },
  { id: "screen-3", dur: 4.2, body: Screen3 },
  { id: "screen-4", dur: 4.0, body: Screen4 },
  { id: "compare", dur: 3.4, body: Compare },
  { id: "sign", dur: 3.8, body: Sign },
  { id: "close", dur: 2.0, body: Close },
  { id: "end", dur: 3.2, body: End },
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
