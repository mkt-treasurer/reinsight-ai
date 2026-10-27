/**
 * "MAS filing, Day 1" — v6, in the look of the HK demo-ver draft: serif statements on white with drifting file
 * chips, then Core's own app window that stays put while its content crossfades (sources → capital ratio →
 * monitoring → every form), a stat card, two serif closing lines, the Core end card. Slow 0.5s crossfades.
 * Our content, not theirs: MAS quarterly Forms 1/2 via MAS-Tx, escalation when late, one person's Excel,
 * Core fills the forms, runs the capital ratio by SFA 04-N13, watches it monthly, same engine for every form.
 * Facts in README "MasFinal". Names and numbers are illustrative.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Lockup, OMark } from "./Lockup";
import { BLUE, GREEN, GREY, INK, INK2, LINE, MONO, RED, SANS, Stage, pIn, lin } from "./mas-core";

const FPS = 30;
const CUT = 14; // 0.47s crossfade on every cut
const SERIF = "Georgia, 'Times New Roman', serif";
const EASE = Easing.bezier(0.22, 1, 0.32, 1);
const ease = (frame: number, a: number, b: number, from: number, to: number) =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

/* ------------------------------------------------------------------ bits */

/** Serif statement, centred. Two lines: the second italic and grey. */
const Statement: React.FC<{ a: string; b?: string; at?: number; size?: number; top?: number }> = ({ a, b, at = 4, size = 76, top }) => {
  const frame = useCurrentFrame();
  const p1 = pIn(frame, at, 16), p2 = pIn(frame, at + 16, 16);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: top ?? (b ? 400 : 470), textAlign: "center", fontFamily: SERIF }}>
      <div style={{ fontSize: size, color: INK, letterSpacing: -1, opacity: p1, transform: `translateY(${(1 - p1) * 10}px)` }}>{a}</div>
      {b ? <div style={{ fontSize: size * 0.86, color: "#8d8d8d", fontStyle: "italic", marginTop: 28, opacity: p2, transform: `translateY(${(1 - p2) * 10}px)` }}>{b}</div> : null}
    </div>
  );
};

/** Serif caption at the bottom for the illustrated scenes. */
const SerifCap: React.FC<{ at?: number; size?: number; children: React.ReactNode }> = ({ at = 6, size = 64, children }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 16);
  return <div style={{ position: "absolute", left: 0, right: 0, top: 840, textAlign: "center", fontFamily: SERIF, fontSize: size, color: INK, letterSpacing: -0.5, opacity: p, transform: `translateY(${(1 - p) * 10}px)`, whiteSpace: "nowrap" }}>{children}</div>;
};

/** Drifting file chips, like the data-room chips in the reference, but MAS filing files. */
const FILES: [string, "pdf" | "xlsx" | "docx", number, number][] = [
  ["Form1_Q2_lodged.pdf", "pdf", 60, 60], ["Trial balance Sep.xlsx", "xlsx", 500, 70], ["DBS statement Sep.pdf", "pdf", 990, 60], ["NAV pack Q3.pdf", "pdf", 1450, 70],
  ["Form2_TRR_v9_Priya.xlsx", "xlsx", 200, 180], ["Audited FS FY2025.pdf", "pdf", 660, 190], ["Bank USD Sep.pdf", "pdf", 1150, 185], ["Dividend minutes.docx", "docx", 1620, 190],
  ["Fee invoices Q3.pdf", "pdf", 40, 300], ["Capital ratio check.xlsx", "xlsx", 540, 310], ["MAS-Tx receipt Q2.pdf", "pdf", 1010, 300], ["LP report Q3.docx", "docx", 1480, 320],
  ["Prepaid schedule.xlsx", "xlsx", 160, 740], ["Form 25A draft.docx", "docx", 680, 750], ["Related-party loans.xlsx", "xlsx", 1120, 740], ["Auditor queries.pdf", "pdf", 1560, 760],
  ["Office lease.pdf", "pdf", 20, 880], ["Fund admin fees.pdf", "pdf", 480, 890], ["FX rates Sep.xlsx", "xlsx", 1000, 880], ["Priya adj.xlsx", "xlsx", 1500, 890],
];
const COL = { pdf: "#e5484d", xlsx: "#2e9e5b", docx: "#3b6fd8" };
const Chips: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {FILES.map(([name, type, x, y], i) => {
        const p = pIn(frame, 2 + (i % 7) * 3, 14);
        const drift = Math.sin((frame + i * 37) / 60) * 6;
        return (
          <div key={name} style={{ position: "absolute", left: x, top: y + drift, display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 8, background: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)", fontSize: 18, color: INK2, opacity: p * 0.9, transform: `rotate(${((i % 5) - 2) * 1.2}deg)`, whiteSpace: "nowrap" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#fff", background: COL[type], borderRadius: 4, padding: "2px 5px" }}>{type.toUpperCase()}</span>
            {name}
          </div>
        );
      })}
    </>
  );
};

/** Core's app window, kept identical across the four product scenes so the cuts read as one screen. */
const NAV: [string, string[]][] = [["RESEARCH", ["Ask", "Library", "Sources"]], ["FILINGS", ["Quarterly returns", "Capital ratio", "Monitoring", "Annual pack", "Form 25A"]]];
const AppWindow: React.FC<{ active: string; title: string; crumb: string; children: React.ReactNode }> = ({ active, title, crumb, children }) => (
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
        <span>Filings / {crumb}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5 }}>Q3 2026 · DUE 14 OCT · MAS-TX</span>
      </div>
      <div style={{ padding: "26px 32px 0", fontSize: 30, fontWeight: 800, color: INK, letterSpacing: -0.6 }}>{title}</div>
      <div style={{ position: "absolute", left: 32, right: 32, top: 110, bottom: 30 }}>{children}</div>
    </div>
  </div>
);

/** Kicker + bold caption under the app window, like the reference. */
const ScreenCap: React.FC<{ n: string; k: string; children: React.ReactNode; at?: number }> = ({ n, k, children, at = 6 }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 14);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 900, textAlign: "center", opacity: p }}>
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 5, color: BLUE, fontWeight: 700 }}>{n} · {k}</div>
      <div style={{ fontSize: 54, fontWeight: 800, color: INK, letterSpacing: -1.5, marginTop: 10, whiteSpace: "nowrap" }}>{children}</div>
    </div>
  );
};

const Card: React.FC<{ x: number; y: number; w: number; h?: number; title?: string; children?: React.ReactNode; at?: number }> = ({ x, y, w, h, title, children, at = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: "#fff", borderRadius: 12, boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.07)", padding: "18px 22px", opacity: pIn(frame, at, 12) }}>
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
      {label ? <div style={{ fontFamily: SERIF, fontSize: 26, color: INK, marginTop: 6, whiteSpace: "nowrap" }}>{label}</div> : null}
    </div>
  );
};

const Paper: React.FC<{ label: string; w?: number; accent?: string }> = ({ label, w = 200, accent = INK }) => (
  <div style={{ width: w, height: w * 1.28, background: "#fff", borderRadius: 12, boxShadow: "0 14px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", padding: w * 0.1, position: "relative" }}>
    <div style={{ fontFamily: SERIF, fontSize: w * 0.14, color: accent, whiteSpace: "nowrap" }}>{label}</div>
    {[0.8, 0.6, 0.7, 0.5].map((x, i) => (
      <div key={i} style={{ height: w * 0.045, width: `${x * 100}%`, background: "#e3e3e3", borderRadius: 4, marginTop: w * 0.09 }} />
    ))}
  </div>
);

/* ------------------------------------------------------------------ scenes */

/** 1 · Opening: the filing files drift; two serif lines. */
const Opening: React.FC = () => (
  <Stage>
    <Chips />
    <Statement a="Quarter end. Two MAS forms. Fourteen days." b="Still doing it by hand?" size={70} />
  </Stage>
);

/** 2 · Late: the clock keeps running, the pressure steps up. */
const Escalation: React.FC = () => {
  const frame = useCurrentFrame();
  const day = Math.floor(lin(frame, 6, 80, 14, 45));
  const hand = lin(frame, 6, 80, 0, 360 * 2.2);
  const steps: [string, string, number][] = [["Reminder", "#f5b400", 22], ["Scrutiny", "#f26b1d", 46], ["Fine", RED, 70]];
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
        <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", fontFamily: SERIF, fontSize: 28, color: day > 14 ? RED : GREY }}>Day {day}</div>
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
            <div style={{ fontFamily: SERIF, fontSize: 48, color: INK }}>{k}</div>
          </div>
        );
      })}
      <SerifCap>Late? Reminders. Scrutiny. Fines.</SerifCap>
    </Stage>
  );
};

/** 3 · One person copies the numbers into Excel by hand. */
const ByHand: React.FC = () => {
  const frame = useCurrentFrame();
  const srcs = ["Ledger", "Bank", "Admin"];
  return (
    <Stage>
      {srcs.map((f, i) => (
        <div key={f} style={{ position: "absolute", left: 160, top: 170 + i * 165, opacity: pIn(frame, 2 + i * 6, 12) }}><Paper label={f} w={190} accent={INK2} /></div>
      ))}
      <Person x={720} y={420} at={6} label="Priya, finance" />
      <div style={{ position: "absolute", left: 960, top: 190, width: 760, borderRadius: 14, background: "#fff", boxShadow: "0 18px 50px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden", opacity: pIn(frame, 4, 12) }}>
        <div style={{ height: 44, background: "#e8f5e9", borderBottom: `1px solid ${LINE}` }} />
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
      <div style={{ position: "absolute", left: 1500, top: 110, fontFamily: SERIF, fontSize: 30, color: RED, opacity: pIn(frame, 50, 10) }}>Day {Math.floor(lin(frame, 50, 100, 3, 9))}</div>
      <SerifCap>One person. By hand. Every quarter.</SerifCap>
    </Stage>
  );
};

/** 4 · She's out; the formula breaks. */
const Formula: React.FC = () => {
  const frame = useCurrentFrame();
  const out = pIn(frame, 34, 12);
  const broke = frame >= 50;
  const blink = broke ? 0.5 + 0.5 * Math.abs(Math.sin((frame - 50) / 5)) : 0;
  return (
    <Stage>
      <div style={{ position: "absolute", left: 300, top: 170, width: 1320, height: 400, borderRadius: 18, background: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden", opacity: pIn(frame, 2, 12) }}>
        <div style={{ height: 54, background: "#e8f5e9", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 24px", fontFamily: MONO, fontSize: 20, color: INK2 }}>fx &nbsp;=MAX(0.05*AVERAGE('FY23'!R9,'FY24'!R9,'FY25'!R9),100000)/…</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 346 }}>
          <div style={{ fontFamily: SERIF, fontSize: 44, color: INK2 }}>Capital ratio</div>
          <div style={{ fontFamily: MONO, fontSize: broke ? 120 : 96, fontWeight: 900, color: broke ? RED : INK, opacity: broke ? 0.6 + blink * 0.4 : 1, background: broke ? `rgba(216,35,42,${0.06 + blink * 0.08})` : "transparent", borderRadius: 12, padding: "10px 24px" }}>{broke ? "#REF!" : "1,143%"}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 1500, top: 110, transform: `translateX(${out * 260}px)`, opacity: 1 - out * 0.7 }}>
        <Person x={0} y={0} at={10} label="Priya, on leave" />
      </div>
      <SerifCap>She's out. The formula breaks.</SerifCap>
    </Stage>
  );
};

/** 5 · Core card (black). */
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

/** 6 · Screen 1: sources in, forms out. */
const Screen1: React.FC = () => {
  const frame = useCurrentFrame();
  const src: [string, string, number][] = [["Ledger", "Xero · trial balance 30 Sep", 14], ["Bank", "DBS · SGD and USD statements", 24], ["Fund administrator", "NAV pack Q3 · 42 pages", 34]];
  const forms: [string, number][] = [["Form 1 · Statement of Assets and Liabilities", 44], ["Form 2 · Financial Resources and Total Risk Requirement", 58]];
  return (
    <Stage>
      <AppWindow active="Quarterly returns" crumb="Quarterly returns" title="Quarterly returns · quarter ended 30 Sep 2026">
        <Card x={0} y={0} w={560} title="Sources" at={4}>
          {src.map(([k, s, at]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${LINE}` }}>
              <div>
                <div style={{ fontSize: 19, fontWeight: 700, color: INK }}>{k}</div>
                <div style={{ fontSize: 14, color: GREY, marginTop: 2 }}>{s}</div>
              </div>
              <Check at={at} />
            </div>
          ))}
          <div style={{ fontSize: 14, color: GREY, marginTop: 14 }}>Every account mapped to its MAS line. Mapping reused from Q2.</div>
        </Card>
        <Card x={600} y={0} w={640} title="MAS forms" at={10}>
          {forms.map(([k, at]) => {
            const w = lin(frame, at, at + 30, 0, 100);
            return (
              <div key={k} style={{ padding: "14px 0", borderBottom: `1px solid ${LINE}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: INK }}>
                  <span>{k}</span>
                  <span style={{ fontFamily: MONO, color: w >= 100 ? GREEN : GREY }}>{Math.round(w)}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: "#eee", marginTop: 10, overflow: "hidden" }}><div style={{ width: `${w}%`, height: "100%", background: w >= 100 ? GREEN : BLUE }} /></div>
              </div>
            );
          })}
          <div style={{ marginTop: 18, display: "flex", gap: 10, opacity: pIn(frame, 92, 10) }}>
            <span style={{ padding: "10px 18px", borderRadius: 999, background: INK, color: "#fff", fontSize: 16, fontWeight: 700 }}>Export for MAS-Tx</span>
            <span style={{ padding: "10px 18px", borderRadius: 999, background: "#eef2ff", color: BLUE, fontSize: 16, fontWeight: 700 }}>Every cell traced to its source</span>
          </div>
        </Card>
        <Card x={0} y={300} w={1240} title="Checks" at={70}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 40 }}>
            {[["Form 1 total assets = ledger", "5,603,685 = 5,603,685", 78], ["Assets = liabilities + capital", "balances", 84], ["Client money in trust excluded", "account 7xx left out", 90], ["Other current assets +38% vs Q2", "prepaid insurance · NAV pack p.31", 96]].map(([k, v, at]) => (
              <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${LINE}` }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: INK }}>{k}</div>
                  <div style={{ fontSize: 13, color: GREY, marginTop: 2 }}>{v}</div>
                </div>
                <Check at={Number(at)} size={22} />
              </div>
            ))}
          </div>
        </Card>
      </AppWindow>
      <ScreenCap n="01" k="QUARTERLY RETURNS">Your files in. MAS forms out.</ScreenCap>
    </Stage>
  );
};

/** 7 · Screen 2: the capital ratio by MAS's rule. */
const Screen2: React.FC = () => {
  const frame = useCurrentFrame();
  const rows: [string, string, string][] = [["Average annual gross income", "3 preceding financial years", "5,599,000"], ["Operational risk requirement", "5% of it · floor S$100,000 · SFA 04-N13", "279,950"], ["Financial resources", "base capital + profit − deductions", "3,200,118"]];
  return (
    <Stage>
      <AppWindow active="Capital ratio" crumb="Capital ratio" title="Capital ratio · as at 30 Sep 2026">
        <Card x={0} y={0} w={760} at={4}>
          {rows.map(([k, s, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: `1px solid ${LINE}`, opacity: pIn(frame, 10 + i * 12, 12) }}>
              <div>
                <div style={{ fontSize: 19, fontWeight: 700, color: INK }}>{k}</div>
                <div style={{ fontSize: 14, color: GREY, marginTop: 2 }}>{s}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: INK }}>{v}</div>
            </div>
          ))}
        </Card>
        <Card x={800} y={0} w={440} h={330} at={50}>
          <div style={{ fontSize: 14, color: GREY }}>Financial resources ÷ total risk requirement</div>
          <div style={{ fontSize: 96, fontWeight: 800, color: BLUE, letterSpacing: -3, marginTop: 10, lineHeight: 1 }}>1,143%</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, fontSize: 18, color: INK, fontWeight: 600 }}><Check at={64} /> Above 120%. Nothing to notify.</div>
          <div style={{ fontSize: 13, color: GREY, marginTop: 14 }}>MAS must be told immediately if it falls below 120%.</div>
        </Card>
        <Card x={0} y={360} w={1240} title="Last four quarters" at={40}>
          <div style={{ display: "flex", gap: 18 }}>
            {[["Q4 2025", "1,090%"], ["Q1 2026", "1,112%"], ["Q2 2026", "1,131%"], ["Q3 2026", "1,143%"]].map(([q, v], i) => (
              <div key={q} style={{ flex: 1, padding: "16px 18px", borderRadius: 10, background: i === 3 ? "#eef2ff" : "#f6f6f6" }}>
                <div style={{ fontSize: 13, color: GREY }}>{q}</div>
                <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: i === 3 ? BLUE : INK, marginTop: 4 }}>{v}</div>
                <div style={{ fontSize: 12, color: GREEN, marginTop: 4, fontWeight: 700 }}>above 120%</div>
              </div>
            ))}
          </div>
        </Card>
      </AppWindow>
      <ScreenCap n="02" k="CAPITAL RATIO">By MAS's rule. Not by a macro.</ScreenCap>
    </Stage>
  );
};

/** 8 · Screen 3: monitoring. */
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
      <AppWindow active="Monitoring" crumb="Monitoring" title="Capital ratio · monthly">
        <Card x={0} y={0} w={840} h={400} at={4}>
          <svg width={800} height={370} style={{ position: "absolute", left: 0, top: 0 }}>
            <line x1={X0} y1={y120} x2={X0 + W} y2={y120} stroke={RED} strokeWidth={3} strokeDasharray="10 8" />
            <text x={X0} y={y120 - 10} fontFamily={SANS} fontSize={16} fontWeight={800} fill={RED}>120% · notify MAS</text>
            <path d={path} stroke={BLUE} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {pts.slice(0, n).map((v, i) => <circle key={i} cx={X0 + (i / 11) * W} cy={Y0 - (v / ymax) * H} r={6} fill={BLUE} />)}
            {["Oct", "Jan", "Apr", "Jul", "Sep"].map((m, i) => <text key={m} x={X0 + (i / 4) * W} y={Y0 + 28} textAnchor="middle" fontFamily={MONO} fontSize={12} fill={GREY}>{m.toUpperCase()}</text>)}
          </svg>
        </Card>
        <Card x={880} y={0} w={360} at={60}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 999, background: RED, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="#fff"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11c0-3.1-1.6-5.6-4.5-6.3V4a2.5 2.5 0 0 0-5 0v.7C6.6 5.4 5 7.9 5 11v5l-2 2v1h18v-1l-2-2z" /></svg>
            </span>
            <div style={{ fontSize: 17, fontWeight: 700, color: INK }}>Alert · 3 months early</div>
          </div>
          <div style={{ fontSize: 17, color: INK2, marginTop: 14, lineHeight: 1.4 }}>Ratio heading toward 120% by September. Top up capital, or hold the dividend.</div>
        </Card>
        <Card x={880} y={230} w={360} at={70}>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Next check · 31 Oct</div>
          {["Bank balances refreshed", "Fee income accrued", "Ratio recomputed"].map((x, i) => (
            <div key={x} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 15, color: INK2 }}><Check at={76 + i * 4} size={20} /> {x}</div>
          ))}
        </Card>
      </AppWindow>
      <ScreenCap n="03" k="MONITORING">Watched monthly. Warned early.</ScreenCap>
    </Stage>
  );
};

/** 9 · Screen 4: every form, same engine. */
const Screen4: React.FC = () => {
  const frame = useCurrentFrame();
  const items: [string, string, number][] = [["Form 1 · Form 2", "every quarter · 14 days", 10], ["Forms 1–6, audited", "every year · 5 months", 22], ["Form 25A", "VC fund managers · once a year", 34]];
  return (
    <Stage>
      <AppWindow active="Annual pack" crumb="All filings" title="Every MAS filing · one mapping">
        {items.map(([k, s, at], i) => (
          <Card key={k} x={i * 420} y={0} w={400} h={220} at={at}>
            <div style={{ fontSize: 24, fontWeight: 800, color: INK }}>{k}</div>
            <div style={{ fontSize: 15, color: GREY, marginTop: 6 }}>{s}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 36, fontSize: 16, color: INK, fontWeight: 600 }}><Check at={at + 20} /> Same mapping. Same checks.</div>
          </Card>
        ))}
        <Card x={0} y={250} w={1240} title="Filing calendar · FYE 31 Dec" at={46}>
          <div style={{ display: "flex", gap: 10 }}>
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => {
              const due = { Jan: ["Form 1·2", BLUE], Apr: ["Form 1·2", BLUE], Jul: ["Form 1·2", BLUE], Oct: ["Form 1·2", BLUE], May: ["Forms 1–6", INK], Feb: ["Form 25A", GREEN] }[m];
              return (
                <div key={m} style={{ flex: 1, height: 150, borderRadius: 10, background: due ? "#f6f6f6" : "#fafafa", border: `1px solid ${LINE}`, padding: "10px 10px", opacity: pIn(frame, 50 + i * 3, 10) }}>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: GREY }}>{m.toUpperCase()}</div>
                  {due ? <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: due[1] as string, lineHeight: 1.2 }}>{due[0]}<br /><span style={{ fontWeight: 400, color: GREY, fontSize: 12 }}>14th</span></div> : null}
                </div>
              );
            })}
          </div>
        </Card>
      </AppWindow>
      <ScreenCap n="04" k="EVERY FILING">Every form. Same engine.</ScreenCap>
    </Stage>
  );
};

/** 10 · Stat card. */
const Stat: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 4, 14), b = pIn(frame, 22, 14);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: 5, color: BLUE, fontWeight: 700, opacity: a }}>TIME TO FILE</div>
        <div style={{ marginTop: 16, opacity: a, fontSize: 190, fontWeight: 800, color: INK, letterSpacing: -8, lineHeight: 1 }}>Day 1</div>
        <div style={{ fontSize: 26, color: INK2, marginTop: 24, opacity: b }}>Reviewed, signed, filed on MAS-Tx. Thirteen days early.</div>
        <div style={{ fontSize: 20, color: BLUE, marginTop: 10, fontWeight: 700, opacity: b }}>vs. Day 12 last quarter · illustrative</div>
      </div>
    </Stage>
  );
};

/** 11–12 · Serif closers. */
const Close1: React.FC = () => (
  <Stage>
    <Statement a="Less re-typing. More running the fund." />
  </Stage>
);
const Close2: React.FC = () => (
  <Stage>
    <Statement a="Review. Sign. Filed." />
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
  { id: "opening", dur: 4.2, body: Opening },
  { id: "escalation", dur: 3.6, body: Escalation },
  { id: "by-hand", dur: 3.8, body: ByHand },
  { id: "formula", dur: 3.4, body: Formula },
  { id: "core", dur: 2.0, body: MeetCore },
  { id: "screen-1", dur: 4.4, body: Screen1 },
  { id: "screen-2", dur: 3.8, body: Screen2 },
  { id: "screen-3", dur: 3.6, body: Screen3 },
  { id: "screen-4", dur: 3.0, body: Screen4 },
  { id: "stat", dur: 3.0, body: Stat },
  { id: "close-1", dur: 2.6, body: Close1 },
  { id: "close-2", dur: 2.2, body: Close2 },
  { id: "end", dur: 3.6, body: End },
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
