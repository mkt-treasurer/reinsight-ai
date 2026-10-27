/**
 * "Form 25A, done" — the Singapore back-office film for VC investment teams (VCFM-regime managers).
 * Same look and spine as mas-final.tsx (LFMC version): Georgia serif statements, Core's app window that stays put,
 * before/after bars, sign-and-submit, Core end card. 0.47s crossfades; captions never overlap.
 *
 * Facts (checked 27 Oct 2026):
 *  - VCFMs hold a CMS licence but are exempt from Part III of the SF(FMR) Regulations (no capital test, no
 *    quarterly Forms 1/2). Their periodic return is Form 25A, within one month of financial year end, online via
 *    MAS-Tx; Form 23A within 14 days of any change in particulars. (MAS Guidelines SFA 04-G05, Appendix 7; MAS
 *    Form 25A page, revised 25 Feb 2025.)
 *  - Form 25A (an .xlsx) asks, per fund: committed capital, AUM at NAV (undrawn commitments excluded), AUM in
 *    qualifying investments, AUM in non-qualifying investments. (Form 25A explanatory notes.)
 *  - Qualifying = specified products directly issued by an unlisted business venture incorporated no more than
 *    ten years before the initial investment; follow-ons stay qualifying; older companies and secondary purchases
 *    are non-qualifying. A VCFM's funds must put at least 80% of committed capital (ex fees and expenses) in
 *    qualifying investments and at most 20% in non-qualifying. (Appendix 7, para 7.1.)
 *  Names, funds and numbers are illustrative. Everything after the Core card is positioning, not a shipped feature.
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

const SerifCap: React.FC<{ at?: number; size?: number; children: React.ReactNode }> = ({ at = 16, size = 54, children }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 16) * useTextWindow();
  return <div style={{ position: "absolute", left: 0, right: 0, top: 850, textAlign: "center", fontFamily: SERIF, fontSize: size, color: INK, letterSpacing: -0.5, opacity: p, transform: `translateY(${(1 - p) * 10}px)`, whiteSpace: "nowrap" }}>{children}</div>;
};

const NAV: [string, string[]][] = [["RESEARCH", ["Ask", "Library", "Sources"]], ["MAS FILINGS", ["Form 25A", "Qualifying test", "Deal check", "Filing calendar"]]];
const AppWindow: React.FC<{ active: string; title: string; children: React.ReactNode }> = ({ active, title, children }) => (
  <div style={{ position: "absolute", left: 192, top: 30, width: 1536, height: 835, borderRadius: 16, background: "#fafafa", boxShadow: "0 30px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)", overflow: "hidden", display: "flex" }}>
    <div style={{ width: 250, background: "#111318", color: "#c9ccd3", padding: "22px 18px", fontSize: 15, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 999, background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><OMark size={18} color="#111" /></span>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Core · VC Desk</div>
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
      <div style={{ marginTop: "auto", fontSize: 12, color: "#7c8190" }}>Harbour Ventures Fund I · S$60M</div>
    </div>
    <div style={{ flex: 1, position: "relative" }}>
      <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderBottom: `1px solid ${LINE}`, fontSize: 14, color: GREY }}>
        <span>MAS filings / {active}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: "#b45309", border: "1px solid #f3c58a", borderRadius: 4, padding: "3px 8px" }}>CONCEPT</span>
      </div>
      <div style={{ padding: "26px 32px 0", fontSize: 30, fontWeight: 800, color: INK, letterSpacing: -0.6 }}>{title}</div>
      <div style={{ position: "absolute", left: 32, right: 32, top: 110, bottom: 30 }}>{children}</div>
    </div>
  </div>
);

const ScreenCap: React.FC<{ n: string; k: string; children: React.ReactNode; at?: number; size?: number }> = ({ n, k, children, at = 16, size = 46 }) => {
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

const Check: React.FC<{ at: number; size?: number; bad?: boolean }> = ({ at, size = 24, bad }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 8);
  return <span style={{ width: size, height: size, borderRadius: 999, background: bad ? RED : GREEN, color: "#fff", fontSize: size * 0.6, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", transform: `scale(${p})`, flexShrink: 0 }}>{bad ? "✗" : "✓"}</span>;
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

/** A spreadsheet that looks like one. */
const COLS = ["A", "B", "C", "D"];
const Sheet: React.FC<{ x: number; y: number; w: number; name: string; formula: string; cell: string; rows: [string, string, string?][]; tabs: string[]; highlight?: number; style?: React.CSSProperties; cellAt?: (i: number) => number; redRows?: number[] }> = ({ x, y, w, name, formula, cell, rows, tabs, highlight, style, cellAt, redRows = [] }) => {
  const frame = useCurrentFrame();
  const colW = [60, (w - 60) * 0.5, (w - 60) * 0.28, (w - 60) * 0.22];
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, background: "#fff", borderRadius: 10, border: "1px solid #c9c9c9", overflow: "hidden", fontFamily: SANS, ...style }}>
      <div style={{ height: 40, background: "#217346", color: "#fff", display: "flex", alignItems: "center", padding: "0 16px", fontSize: 15, fontWeight: 700 }}>{name}</div>
      <div style={{ height: 40, display: "flex", alignItems: "center", borderBottom: "1px solid #d4d4d4", fontFamily: MONO, fontSize: 15 }}>
        <span style={{ width: 70, textAlign: "center", color: INK2, borderRight: "1px solid #d4d4d4" }}>{cell}</span>
        <span style={{ padding: "0 12px", color: GREY }}>fx</span>
        <span style={{ color: INK, whiteSpace: "nowrap", overflow: "hidden" }}>{formula}</span>
      </div>
      <div style={{ display: "flex", background: "#f3f3f3", borderBottom: "1px solid #d4d4d4" }}>
        {COLS.map((c, i) => <div key={i} style={{ width: colW[i], height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: GREY, borderRight: "1px solid #d4d4d4" }}>{i === 0 ? "" : c}</div>)}
      </div>
      {rows.map(([a, b, c], i) => {
        const t = cellAt ? pIn(frame, cellAt(i), 6) : 1;
        const hi = highlight === i;
        const red = redRows.includes(i);
        return (
          <div key={i} style={{ display: "flex", borderBottom: "1px solid #e4e4e4", background: hi ? "rgba(47,107,255,0.08)" : red ? "rgba(216,35,42,0.06)" : "transparent" }}>
            <div style={{ width: colW[0], height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: GREY, background: "#f3f3f3", borderRight: "1px solid #d4d4d4" }}>{i + 1}</div>
            <div style={{ width: colW[1], height: 44, display: "flex", alignItems: "center", padding: "0 12px", fontSize: 17, color: red ? RED : INK2, borderRight: "1px solid #e4e4e4", whiteSpace: "nowrap", overflow: "hidden" }}>{a}</div>
            <div style={{ width: colW[2], height: 44, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 12px", fontFamily: MONO, fontSize: 17, color: red ? RED : INK, fontWeight: red || hi ? 700 : 400, borderRight: "1px solid #e4e4e4", opacity: t, outline: hi ? `2px solid ${BLUE}` : "none", outlineOffset: -2 }}>{b}</div>
            <div style={{ width: colW[3], height: 44, display: "flex", alignItems: "center", padding: "0 10px", fontSize: 13, color: red ? RED : GREY, whiteSpace: "nowrap", overflow: "hidden" }}>{c ?? ""}</div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 2, padding: "6px 8px", background: "#f3f3f3", borderTop: "1px solid #d4d4d4" }}>
        {tabs.map((t, i) => <span key={t} style={{ fontSize: 13, padding: "5px 12px", background: i === 0 ? "#fff" : "#e6e6e6", color: INK2, border: "1px solid #d4d4d4", borderRadius: 3 }}>{t}</span>)}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ scenes */

/** 1 · Opening: one declaration a year. */
const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const p = pIn(frame, 10, 16);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 140, display: "flex", justifyContent: "center", opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
        <Paper label="Form 25A" w={190} sub="annual declaration to MAS" accent={BLUE} />
      </div>
      <Statement a="One MAS declaration a year, covering every fund you run" b="still compiling it by hand?" top={450} size={68} />
    </Stage>
  );
};

/** 2 · Thirty days after year end, on top of everything else. */
const Deadline: React.FC = () => {
  const frame = useCurrentFrame();
  const day = Math.floor(lin(frame, 6, 100, 1, 31));
  const hand = frame * 7.5;
  const tasks: [string, string, number][] = [["Audit", "#8d8d8d", 20], ["Nil misconduct return · 14 Jan", "#8d8d8d", 40], ["Form 25A · 31 Jan", RED, 60]];
  return (
    <Stage>
      <div style={{ position: "absolute", left: 300, top: 150, width: 420, height: 420, borderRadius: 999, background: "#fff", boxShadow: "0 30px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", opacity: pIn(frame, 2, 12) }}>
        <svg width={420} height={420} style={{ position: "absolute", left: 0, top: 0 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1={210 + Math.cos((i / 12) * Math.PI * 2) * 170} y1={210 + Math.sin((i / 12) * Math.PI * 2) * 170} x2={210 + Math.cos((i / 12) * Math.PI * 2) * 185} y2={210 + Math.sin((i / 12) * Math.PI * 2) * 185} stroke="#cfcfcf" strokeWidth={5} strokeLinecap="round" />
          ))}
          <line x1={210} y1={210} x2={210 + Math.cos(((hand - 90) * Math.PI) / 180) * 150} y2={210 + Math.sin(((hand - 90) * Math.PI) / 180) * 150} stroke={day > 24 ? RED : INK} strokeWidth={10} strokeLinecap="round" />
          <circle cx={210} cy={210} r={14} fill={day > 24 ? RED : INK} />
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", fontFamily: SERIF, fontSize: 28, color: day > 24 ? RED : GREY }}>{day} Jan <span style={{ color: GREY, fontSize: 20 }}>· due 31 Jan</span></div>
      </div>
      {tasks.map(([k, c, at], i) => {
        const pp = pIn(frame, at, 12);
        return (
          <div key={k} style={{ position: "absolute", left: 860, top: 180 + i * 150, display: "flex", alignItems: "center", gap: 26, opacity: pp, transform: `translateX(${(1 - pp) * 40}px)` }}>
            <div style={{ width: 110, height: 110, borderRadius: 24, background: c, boxShadow: `0 18px 44px ${c}66`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Paper label="" w={48} accent="#fff" />
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 40, color: INK }}>{k}</div>
          </div>
        );
      })}
      <SerifCap size={52}>Due a month after year end — in the same January as the audit</SerifCap>
    </Stage>
  );
};

/** 3 · An associate pulls every deal into one sheet by hand. */
const ByHand: React.FC = () => {
  const frame = useCurrentFrame();
  const srcs = ["Cap tables", "Admin NAV", "Deal CRM"];
  const vals = ["4,200,000", "2,750,000", "6,000,000", "3,100,000", "48,200,000", "60,000,000"];
  return (
    <Stage>
      {srcs.map((f, i) => (
        <div key={f} style={{ position: "absolute", left: 160, top: 170 + i * 165, opacity: pIn(frame, 2 + i * 6, 12) }}><Paper label={f} w={190} accent={INK2} /></div>
      ))}
      <Person x={720} y={420} at={6} label="Priya, your associate" />
      <Sheet x={960} y={150} w={780} name="Form25A_FY2025_working.xlsx" cell="C5" formula="=SUM(C1:C4)" rows={[["Acme Robotics · inc. 2019 · first cheque 2021", "4,200,000", "qualifying?"], ["Nimbus Health · inc. 2012 · first cheque 2023", "2,750,000", "qualifying?"], ["Series B secondary · bought from an LP", "6,000,000", "qualifying?"], ["Orbit Pay · inc. 2020 · follow-on 2025", "3,100,000", "qualifying?"], ["Fund I AUM at NAV", "48,200,000", "from admin"], ["Fund I committed capital", "60,000,000", "from LPA"]]} tabs={["Form 25A", "Fund I", "Fund II", "NAV Dec", "Deals"]} cellAt={(i) => 16 + i * 9} style={{ opacity: pIn(frame, 4, 12) }} />
      {Array.from({ length: 6 }).map((_, i) => {
        const t = ease(frame, 10 + i * 10, 34 + i * 10, 0, 1);
        const y0 = 230 + (i % 3) * 165, y1 = 270 + i * 44;
        return <div key={i} style={{ position: "absolute", left: 360 + t * 900, top: y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 90, fontFamily: MONO, fontSize: 24, fontWeight: 700, color: BLUE, opacity: t > 0 && t < 0.96 ? 1 : 0 }}>{vals[i]}</div>;
      })}
      <SerifCap size={50}>Someone pulls every deal and every NAV into one sheet, by hand</SerifCap>
    </Stage>
  );
};

/** 4 · What the VCFM rule is: at least 80% qualifying, at most 20% non-qualifying, of committed capital. */
const Rule: React.FC = () => {
  const frame = useCurrentFrame();
  const qW = ease(frame, 14, 54, 0, 1180 * 0.8);
  const nW = ease(frame, 30, 60, 0, 1180 * 0.105);
  const line = pIn(frame, 50, 12);
  const Row: React.FC<{ y: number; label: string; sub: string; w: number; color: string; at: number; val: string; off?: number }> = ({ y, label, sub, w, color, at, val, off = 22 }) => (
    <div style={{ position: "absolute", left: 160, top: y, width: 1600, opacity: pIn(frame, at, 12) }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontFamily: SERIF, fontSize: 34, color: INK }}>{label}</span>
        <span style={{ fontFamily: SERIF, fontSize: 22, color: GREY, fontStyle: "italic" }}>{sub}</span>
      </div>
      <div style={{ position: "relative", height: 86, marginTop: 14 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1180, height: 86, borderRadius: 14, background: "#f1f1f1" }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: w, height: 86, borderRadius: 14, background: color }} />
        <div style={{ position: "absolute", left: 1180 + off, top: 0, height: 86, display: "flex", alignItems: "center", fontFamily: SERIF, fontSize: 40, color, whiteSpace: "nowrap", opacity: pIn(frame, at + 36, 10) }}>{val}</div>
      </div>
    </div>
  );
  return (
    <Stage>
      <Row y={170} label="Qualifying start-ups" sub="backed directly, unlisted, under 10 years old at your first cheque" w={qW} color={BLUE} at={6} val="at least 80%" />
      <Row y={420} label="Everything else" sub="older companies, secondaries bought from other investors" w={nW} color="#8d8d8d" at={22} val="at most 20%" />
      <div style={{ position: "absolute", left: 160 + 1180 * 0.2, top: 468, height: 94, width: 4, background: RED, opacity: line }} />
      <div style={{ position: "absolute", left: 160 + 1180 * 0.2 + 16, top: 612, fontFamily: SERIF, fontSize: 26, color: RED, opacity: line, whiteSpace: "nowrap" }}>the 20% cap — measured on each fund's committed capital</div>
      <div style={{ position: "absolute", left: 160, top: 690, fontFamily: SERIF, fontSize: 32, color: INK, opacity: pIn(frame, 66, 12) * useTextWindow() }}>
        Fund I today: <span style={{ color: BLUE }}>10.5%</span> non-qualifying <span style={{ color: GREY, fontSize: 24, fontStyle: "italic" }}>· S$6.3m of S$60m committed · inside the cap</span>
      </div>
      <SerifCap size={52}>The VCFM rule — at least 80% of each fund in qualifying start-ups</SerifCap>
    </Stage>
  );
};

/** 5 · Excel doesn't know MAS's definitions: a secondary counted as qualifying, the fund looks fine, and it isn't. */
const WrongButFine: React.FC = () => {
  const frame = useCurrentFrame();
  const rule = pIn(frame, 44, 12);
  const fixed = frame >= 70;
  const rows: [string, string, string?][] = [
    ["Fund I committed capital", "60,000,000", "from LPA"],
    ["Non-qualifying · Nimbus Health (inc. 2012)", "2,750,000", "older than 10 years"],
    ["Non-qualifying · two smaller older companies", "3,550,000", ""],
    ...(rule > 0 ? ([["Series B secondary · bought from an LP", "6,000,000", "MAS: non-qualifying"]] as [string, string, string?][]) : []),
    ["Non-qualifying total", fixed ? "12,300,000" : "6,300,000", ""],
    ["Share of committed capital", fixed ? "20.5%" : "10.5%", fixed ? "over the 20% cap" : "cap is 20%"],
  ];
  return (
    <Stage>
      <Sheet x={300} y={110} w={1320} name="Form25A_FY2025_working.xlsx" cell={fixed ? "C6" : "C5"} formula={fixed ? "=C5/C1" : "=C4/C1"} rows={rows} tabs={["Form 25A", "Fund I", "Fund II", "NAV Dec", "Deals"]} highlight={rows.length - 1} redRows={rule > 0 ? [3] : []} style={{ opacity: pIn(frame, 2, 12) }} />
      <div style={{ position: "absolute", left: 1640, top: 110 + 80 + 28 + (rows.length - 1) * 44 + 4 }}><Check at={20} size={40} bad={fixed} /></div>
      <div style={{ position: "absolute", left: 1120, top: 40, padding: "12px 20px", border: `4px solid ${RED}`, borderRadius: 10, color: RED, fontFamily: SERIF, fontSize: 24, transform: `rotate(-6deg) scale(${1.4 - rule * 0.4})`, opacity: rule, whiteSpace: "nowrap" }}>MAS's definition: a secondary is never qualifying</div>
      <div style={{ position: "absolute", left: 300, top: 640, fontFamily: SERIF, fontSize: 30, color: fixed ? RED : INK2, opacity: pIn(frame, 24, 10) * useTextWindow() }}>
        {fixed ? "What you'd declare: 10.5%. What MAS's definition gives: 20.5% — the fund is outside the rule." : "Looks fine — green tick, inside the cap."}
      </div>
      <SerifCap size={50}>One secondary counted wrong, and the fund is outside the rule</SerifCap>
    </Stage>
  );
};

/** 6 · Core card. */
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

/** 7 · Screen 1: cap tables, NAVs and the deal log in — Form 25A out, in MAS's own Excel. */
const Screen1: React.FC = () => {
  const frame = useCurrentFrame();
  const files = ["Cap tables", "Admin NAV", "Deal CRM"];
  return (
    <Stage>
      <AppWindow active="Form 25A" title="Form 25A · financial year ended 31 Dec 2025">
        
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
          <path d="M 700 260 C 760 260, 760 300, 800 300" stroke={BLUE} strokeWidth={2.5} fill="none" strokeDasharray={400} strokeDashoffset={400 * (1 - pIn(frame, 50, 16))} />
        </svg>
        <div style={{ position: "absolute", left: 540, top: 180, width: 160, height: 160, borderRadius: 999, background: INK, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 ${pIn(frame, 40, 20) * 18}px rgba(47,107,255,0.12)` }}>
          <span style={{ display: "inline-flex", alignItems: "center", color: "#fff", fontWeight: 500, fontSize: 30, letterSpacing: 9, paddingLeft: 9 }}>C<span style={{ display: "inline-block", margin: "0 9px 0 -2px", marginTop: 2 }}><OMark size={23} color="#fff" /></span>RE</span>
        </div>
        <div style={{ position: "absolute", left: 800, top: 40, width: 440, opacity: pIn(frame, 60, 14) }}>
          <Sheet x={0} y={0} w={440} name="Form 25A.xlsx" cell="C4" formula="=C2+C3" rows={[["Committed", "60,000,000"], ["Qualifying", "41,900,000"], ["Non-qualifying", "6,300,000"], ["AUM at NAV", "48,200,000"]]} tabs={["Form 25A", "Notes"]} cellAt={(i) => 70 + i * 8} style={{ position: "relative" }} />
          <div style={{ marginTop: 14, display: "flex", gap: 10, opacity: pIn(frame, 104, 10) }}>
            <span style={{ padding: "10px 18px", borderRadius: 999, background: INK, color: "#fff", fontSize: 16, fontWeight: 700 }}>Ready for MAS-Tx</span>
          </div>
        </div>
      </AppWindow>
      <ScreenCap n="01" k="FORM 25A" size={46}>Cap tables, NAVs and the deal log in — Form 25A out</ScreenCap>
    </Stage>
  );
};

/** 8 · Screen 2: every company classified the way MAS defines it; the fund is inside the cap. */
const Screen2: React.FC = () => {
  const frame = useCurrentFrame();
  const rows: [string, string, string, boolean, number][] = [
    ["Acme Robotics", "inc. 2019 · first cheque 2021", "qualifying", true, 28],
    ["Orbit Pay", "inc. 2020 · follow-on 2025", "qualifying", true, 36],
    ["Nimbus Health", "inc. 2012 · first cheque 2023", "non-qualifying", false, 44],
    ["Two smaller older companies", "inc. 2010 and 2013", "non-qualifying", false, 52],
  ];
  return (
    <Stage>
      <AppWindow active="Qualifying test" title="Qualifying test · Fund I · 31 Dec 2025">
        <Card x={0} y={0} w={1240} at={4} style={{ background: "#111318", color: "#fff" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: "#8b90a0" }}>MAS'S DEFINITION · GUIDELINES FOR FUND MANAGEMENT COMPANIES</div>
          <div style={{ fontFamily: SERIF, fontSize: 28, marginTop: 12, lineHeight: 1.35 }}>
            Qualifying: unlisted, backed directly, under 10 years old at your first cheque. Follow-ons stay qualifying. Secondaries and older companies don't — and they may be at most 20% of committed capital.
          </div>
        </Card>
        <Card x={0} y={210} w={800} at={22}>
          {rows.map(([k, s, v, ok, at]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${LINE}`, opacity: pIn(frame, at, 12) }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>{k}</div>
                <div style={{ fontSize: 13, color: GREY, marginTop: 2 }}>{s}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 700, color: ok ? GREEN : RED }}>{v}<Check at={at + 6} size={20} bad={!ok} /></div>
            </div>
          ))}
        </Card>
        <Card x={840} y={210} w={400} h={276} at={60}>
          <div style={{ fontSize: 14, color: GREY }}>Non-qualifying ÷ committed capital</div>
          <div style={{ fontSize: 92, fontWeight: 800, color: BLUE, letterSpacing: -3, marginTop: 8, lineHeight: 1 }}>10.5%</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, fontSize: 18, color: INK, fontWeight: 600 }}><Check at={74} /> Inside the 20% cap</div>
        </Card>
      </AppWindow>
      <ScreenCap n="02" k="QUALIFYING TEST" size={46}>Every company classified the way MAS defines it</ScreenCap>
    </Stage>
  );
};

/** 9 · Screen 3: checked before you sign. */
const Screen3: React.FC = () => {
  const frame = useCurrentFrame();
  const g = ease(frame, 30, 70, 0.105, 0.205);
  const W = 760;
  return (
    <Stage>
      <AppWindow active="Deal check" title="Deal check · new term sheet · Fund I">
        <Card x={0} y={0} w={840} at={4}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>Series B secondary · S$6.0m · bought from an existing investor</div>
          <div style={{ fontSize: 14, color: GREY, marginTop: 4 }}>Fund I non-qualifying share, before and after</div>
          <div style={{ position: "relative", height: 70, marginTop: 26 }}>
            <div style={{ position: "absolute", left: 0, top: 10, width: W, height: 50, borderRadius: 12, background: "#f1f1f1" }} />
            <div style={{ position: "absolute", left: 0, top: 10, width: W * g, height: 50, borderRadius: 12, background: g > 0.2 ? RED : BLUE }} />
            <div style={{ position: "absolute", left: W * 0.2 - 2, top: 0, width: 4, height: 70, background: RED }} />
            <div style={{ position: "absolute", left: W * 0.2 + 10, top: -2, fontSize: 13, fontWeight: 800, color: RED }}>20% cap</div>
            <div style={{ position: "absolute", left: W + 16, top: 18, fontFamily: MONO, fontSize: 26, fontWeight: 800, color: g > 0.2 ? RED : BLUE }}>{(g * 100).toFixed(1)}%</div>
          </div>
        </Card>
        <Card x={880} y={0} w={360} at={74}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 999, background: RED, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="#fff"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11c0-3.1-1.6-5.6-4.5-6.3V4a2.5 2.5 0 0 0-5 0v.7C6.6 5.4 5 7.9 5 11v5l-2 2v1h18v-1l-2-2z" /></svg>
            </span>
            <div style={{ fontSize: 17, fontWeight: 700, color: INK }}>Over the cap if you sign</div>
          </div>
          <div style={{ fontSize: 16, color: INK2, marginTop: 14, lineHeight: 1.45 }}>Primary tranche only (new shares, qualifying) → stays 10.5%. Or run the secondary from Fund II.</div>
        </Card>
      </AppWindow>
      <ScreenCap n="03" k="DEAL CHECK" size={46}>Checked before you sign</ScreenCap>
    </Stage>
  );
};

/** 10 · Screen 4: the year. */
const Screen4: React.FC = () => {
  const frame = useCurrentFrame();
  const items: [string, string, string, string, number][] = [
    ["31 DEC", "Year end", "NAVs and cap tables frozen", "#fff", 6],
    ["14 JAN", "Nil misconduct return", "annual declaration to MAS", "#fff", 16],
    ["31 JAN", "Form 25A", "every fund, one declaration, via MAS-Tx", "#eef2ff", 26],
    ["ANY TIME", "Form 23A", "within 14 days of a change in directors, shareholders or office", "#fff", 36],
  ];
  return (
    <Stage>
      <AppWindow active="Filing calendar" title="Your MAS year · financial year ending 31 Dec">
        <div style={{ display: "flex", gap: 14 }}>
          {items.map(([k, t, s, bg, at]) => (
            <Card key={k} x={0} y={0} w={296} h={290} at={at} style={{ position: "relative", background: bg }}>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 2, color: bg === "#fff" ? GREY : BLUE }}>{k}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: INK, marginTop: 14, lineHeight: 1.2 }}>{t}</div>
              <div style={{ fontSize: 15, color: INK2, marginTop: 10, lineHeight: 1.45 }}>{s}</div>
              <div style={{ position: "absolute", left: 22, bottom: 22 }}><Check at={at + 24} /></div>
            </Card>
          ))}
        </div>
        <div style={{ position: "absolute", left: 0, top: 330, display: "flex", alignItems: "center", gap: 12, fontSize: 20, color: INK2, opacity: pIn(frame, 56, 12) }}><Check at={60} /> No capital test, no quarterly forms under the VCFM regime</div>
      </AppWindow>
      <ScreenCap n="04" k="THE WHOLE YEAR" size={46}>One declaration a year, kept current all year</ScreenCap>
    </Stage>
  );
};

/** 11 · Before / after bars. */
const Compare: React.FC = () => {
  const frame = useCurrentFrame();
  const rows: [string, number, string, number][] = [["Last year, by hand", 15, RED, 8], ["With Core", 1, BLUE, 30]];
  const max = 31;
  return (
    <Stage>
      <div style={{ position: "absolute", left: 260, top: 230, width: 1400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 14, letterSpacing: 2, color: GREY, paddingLeft: 420 }}>
          <span>YEAR END</span><span>MAS DEADLINE · 31 JAN</span>
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
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 24, color: GREY, opacity: pIn(frame, 50, 12) * useTextWindow() }}>an associate's January, illustrative</div>
      <SerifCap size={60}>From fifteen days to one</SerifCap>
    </Stage>
  );
};

/** 12 · You review and sign. */
const Sign: React.FC = () => {
  const frame = useCurrentFrame();
  const sig = pIn(frame, 20, 34);
  const stamp = pIn(frame, 62, 10);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 560, top: 110, width: 800, height: 620, borderRadius: 14, background: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)", padding: "40px 48px", opacity: pIn(frame, 2, 14) }}>
        <div style={{ fontFamily: SERIF, fontSize: 30, color: INK }}>Form 25A · FY2025</div>
        <div style={{ fontSize: 16, color: GREY, marginTop: 4 }}>prepared by Core · every figure traced to a cap table or NAV</div>
        {[0.85, 0.6, 0.75, 0.5, 0.7].map((x, i) => (
          <div key={i} style={{ height: 10, width: `${x * 100}%`, background: "#e6e6e6", borderRadius: 5, marginTop: 24 }} />
        ))}
        <div style={{ position: "absolute", left: 48, bottom: 48 }}>
          <div style={{ fontSize: 14, color: GREY }}>Reviewed and signed</div>
          <svg width={360} height={90} style={{ marginTop: 4 }}>
            <path d="M 10 60 C 40 10, 60 80, 90 40 S 140 20, 160 55 S 210 80, 240 35 S 300 30, 340 50" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeDasharray={700} strokeDashoffset={700 * (1 - sig)} />
          </svg>
          <div style={{ fontFamily: SERIF, fontSize: 18, color: INK2 }}>David Tan, Managing Partner · 12 Jan</div>
        </div>
        <div style={{ position: "absolute", right: 48, bottom: 70, padding: "14px 22px", border: `5px solid ${GREEN}`, borderRadius: 12, color: GREEN, fontFamily: MONO, fontSize: 24, fontWeight: 800, letterSpacing: 3, transform: `rotate(-10deg) scale(${1.6 - stamp * 0.6})`, opacity: stamp }}>READY · MAS-Tx</div>
      </div>
      <SerifCap size={56}>You review and sign — it's ready to submit on MAS-Tx</SerifCap>
    </Stage>
  );
};

/** 13 · Serif closer. */
const Close: React.FC = () => (
  <Stage>
    <Statement a="Less compiling, more investing" />
  </Stage>
);

/** 14 · End card. */
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
      <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", fontFamily: SERIF, fontSize: 26, color: "#5c6478", opacity: b }}>You choose what leaves the firm, down to nothing at all.</div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ cut */

type S = { id: string; dur: number; body: React.FC };

export const MASVC_SCENES: S[] = [
  { id: "opening", dur: 3.6, body: Opening },
  { id: "deadline", dur: 3.0, body: Deadline },
  { id: "by-hand", dur: 3.2, body: ByHand },
  { id: "core", dur: 1.6, body: MeetCore },
  { id: "screen-1", dur: 3.8, body: Screen1 },
  { id: "screen-2", dur: 4.0, body: Screen2 },
  { id: "screen-3", dur: 4.0, body: Screen3 },
  { id: "screen-4", dur: 3.2, body: Screen4 },
  { id: "sign", dur: 3.0, body: Sign },
  { id: "close", dur: 1.8, body: Close },
  { id: "end", dur: 3.2, body: End },
];

const frames = (s: S) => Math.round(s.dur * FPS);
export const MASVC_FRAMES = MASVC_SCENES.reduce((a, s, i) => a + frames(s) - (i > 0 ? CUT : 0), 0);

export const MasVc: React.FC = () => (
  <AbsoluteFill style={{ background: "#fff", fontFamily: SANS }}>
    <TransitionSeries>
      {MASVC_SCENES.flatMap((s, i) => {
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
