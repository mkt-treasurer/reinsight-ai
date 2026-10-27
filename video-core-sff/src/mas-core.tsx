/**
 * "MAS returns in 2 minutes" — ~39s back-office film for Singapore fund managers, in the look of the
 * HK front-office draft (HK_Front(심사역)_vid_초안.mp4): white stage, one bold sans line at the bottom,
 * UI mockups doing the explaining, chat bubbles top-right, a running counter bottom-right, hard cuts.
 * Problem half: red ELAPSED clock racing through 12 days. Solution half: LINES READ + ELAPSED to 00:02:00.
 *
 * Facts (mas.gov.sg, checked 27 Oct 2026): Form 1 / Form 2 quarterly within 14 days of quarter end via
 * MASNET; a CMS licence revoked 3 Jul 2025 citing, among other breaches, quarterly returns not submitted.
 * Figures in the mockups are illustrative. "2 minutes" is the team's own claim.
 */
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Lockup, OMark } from "./Lockup";

const FPS = 30;
export const SANS = "Pretendard, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
export const MONO = "'JetBrains Mono', Consolas, 'Courier New', monospace";

export const INK = "#111111";
export const INK2 = "#3a3a3a";
export const GREY = "#8a8a8a";
export const GREY2 = "#c4c4c4";
export const LINE = "#e6e6e6";
export const RED = "#d8232a";
export const GREEN = "#16a34a";
export const BLUE = "#2f6bff";

export const EASE = Easing.bezier(0.22, 1, 0.32, 1);
export const pIn = (frame: number, delay = 0, len = 14) =>
  interpolate(frame - delay, [0, len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
export const lin = (frame: number, a: number, b: number, from: number, to: number) =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const CUT = 6; // frames of fade on every cut

/* ------------------------------------------------------------------ chrome */

export const Stage: React.FC<{ children?: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <AbsoluteFill style={{ background: dark ? "#0a0a0a" : "#ffffff", fontFamily: SANS, overflow: "hidden" }}>{children}</AbsoluteFill>
);

/** The one line at the bottom. `hold` keeps it on for the whole scene; otherwise it enters at `at`. */
export const Cap: React.FC<{ at?: number; out?: number; size?: number; children: React.ReactNode }> = ({ at = 4, out, size = 86, children }) => {
  const frame = useCurrentFrame();
  const a = pIn(frame, at, 10) * (out === undefined ? 1 : 1 - pIn(frame, out, 8));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 830, textAlign: "center", fontSize: size, fontWeight: 800, letterSpacing: -size * 0.04, color: INK, opacity: a, transform: `translateY(${(1 - pIn(frame, at, 10)) * 14}px)`, whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
};

const hms = (h: number) => {
  const total = Math.max(0, Math.floor(h * 3600));
  const H = Math.floor(total / 3600), M = Math.floor((total % 3600) / 60), S = total % 60;
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}:${String(S).padStart(2, "0")}`;
};

/** Bottom-right counter block. Problem half: ELAPSED in red. Solution half: LINES READ + ELAPSED in ink. */
const Counter: React.FC<{ from: number; to: number; red?: boolean; lines?: [number, number]; at?: number }> = ({ from, to, red, lines, at = 0 }) => {
  const frame = useCurrentFrame();
  const h = from + lin(frame, at, at + 90, 0, to - from);
  const L = lines ? Math.round(lin(frame, at, at + 90, lines[0], lines[1])) : 0;
  return (
    <div style={{ position: "absolute", right: 60, bottom: 46, display: "flex", gap: 56, opacity: pIn(frame, at, 10) }}>
      {lines ? (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>LINES READ</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{L.toLocaleString("en-US")}</div>
        </div>
      ) : null}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>ELAPSED</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: red ? RED : INK, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{hms(h)}</div>
      </div>
    </div>
  );
};

/** Chat bubble, top-right, slides in. */
export const Bubble: React.FC<{ at: number; i?: number; who: string; role: string; when: string; text: string; dark?: boolean }> = ({ at, i = 0, who, role, when, text, dark }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 14);
  const initials = who.split(" ").map((w) => w[0]).join("");
  return (
    <div style={{ position: "absolute", right: 60, top: 40 + i * 118, width: 500, background: "#fff", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)", padding: "14px 18px 16px", display: "flex", gap: 12, opacity: p, transform: `translateX(${(1 - p) * 40}px)` }}>
      <div style={{ width: 36, height: 36, borderRadius: 999, background: dark ? INK : "#0f766e", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>
            {who} <span style={{ fontWeight: 400, color: GREY, fontSize: 13 }}>· {role}</span>
          </span>
          <span style={{ fontSize: 12, color: GREY }}>{when}</span>
        </div>
        <div style={{ fontSize: 17, color: INK2, marginTop: 4, lineHeight: 1.35 }}>{text}</div>
      </div>
    </div>
  );
};

/** Mac-style window with a title. */
export const Win: React.FC<{ x: number; y: number; w: number; h: number; title: string; at: number; tint?: string; children?: React.ReactNode; scale?: number; rot?: number }> = ({ x, y, w, h, title, at, tint = "#f4f4f4", children, scale = 1, rot = 0 }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 16);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: "#fff", borderRadius: 12, boxShadow: "0 18px 60px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden", opacity: p, transform: `translateY(${(1 - p) * 30}px) scale(${scale}) rotate(${rot}deg)`, transformOrigin: "50% 100%" }}>
      <div style={{ height: 34, background: tint, display: "flex", alignItems: "center", gap: 7, padding: "0 12px", borderBottom: `1px solid ${LINE}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c }} />
        ))}
        <span style={{ marginLeft: 10, fontSize: 12, color: GREY, fontFamily: MONO, letterSpacing: 0.5 }}>{title}</span>
      </div>
      <div style={{ position: "relative", height: h - 34 }}>{children}</div>
    </div>
  );
};

/** Grey placeholder text lines. */
export const Lines: React.FC<{ n: number; w?: number[]; at?: number; gap?: number; x?: number; y?: number; width?: number }> = ({ n, w = [0.9, 0.6, 0.8, 0.5, 0.7], at = 0, gap = 14, x = 16, y = 16, width = 300 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x, top: y, width }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ height: 7, borderRadius: 3, background: "#dedede", width: `${w[i % w.length] * 100}%`, marginBottom: gap, opacity: pIn(frame, at + i * 2, 8) }} />
      ))}
    </div>
  );
};

/** Flip calendar card. */
export const Calendar: React.FC<{ x: number; y: number; head: string; big: string; sub?: string; at: number; red?: boolean }> = ({ x, y, head, big, sub, at, red = true }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 16);
  const flip = interpolate(frame - at, [0, 14], [-90, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 300, borderRadius: 18, background: "#fff", boxShadow: "0 24px 60px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)", overflow: "hidden", opacity: p, transform: `perspective(1200px) rotateX(${flip}deg)`, transformOrigin: "50% 0%" }}>
      <div style={{ height: 64, background: red ? RED : INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, letterSpacing: 6 }}>{head}</div>
      <div style={{ textAlign: "center", padding: "18px 0 22px" }}>
        <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, letterSpacing: -6, color: INK }}>{big}</div>
        {sub ? <div style={{ fontSize: 18, color: GREY, marginTop: 8 }}>{sub}</div> : null}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ problem */

/** 1 · Quarter end: the calendar flips to 30 Sep, the MAS reminder lands. */
const QuarterEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    ["MAS", "Reminder: quarterly returns for quarter ended 30 Sep due 14 Oct", "09:02", true],
    ["Fund Admin", "Q3 NAV pack — final (PDF, 42 pages)", "08:41"],
    ["Bank", "September statements — SGD · USD", "08:10"],
    ["Priya Shah", "Form 2 working file — my latest version", "Yesterday"],
    ["Auditor", "Interim query list Q3", "Yesterday"],
  ] as const;
  return (
    <Stage>
      <Calendar x={150} y={150} head="SEP" big="30" sub="Quarter end" at={2} />
      <Win x={560} y={110} w={1180} h={560} title="inbox · ops@fund.sg" at={10}>
        <div style={{ padding: "16px 22px 0", fontSize: 18, fontWeight: 700, color: INK, display: "flex", alignItems: "center", gap: 10 }}>
          Inbox <span style={{ fontSize: 12, background: RED, color: "#fff", borderRadius: 999, padding: "2px 8px" }}>31 unread</span>
        </div>
        {rows.map((r, i) => {
          const p = pIn(frame, 18 + i * 5, 10);
          const hi = r[3] === true;
          return (
            <div key={r[1]} style={{ display: "grid", gridTemplateColumns: "150px 1fr 90px", gap: 18, alignItems: "center", margin: "10px 22px 0", padding: "12px 14px", borderRadius: 8, background: hi ? "rgba(216,35,42,0.06)" : "transparent", border: hi ? `1px solid rgba(216,35,42,0.35)` : "1px solid transparent", opacity: p, transform: `translateX(${(1 - p) * 10}px)` }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: INK }}>{r[0]}</span>
              <span style={{ fontSize: 17, color: hi ? INK : INK2, fontWeight: hi ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r[1]}</span>
              <span style={{ fontSize: 14, color: GREY, textAlign: "right" }}>{r[2]}</span>
            </div>
          );
        })}
      </Win>
      <Cap at={6} out={44}>Quarter end.</Cap>
      <Cap at={50}>
        <span style={{ color: RED }}>14 days</span> to lodge.
      </Cap>
      <Counter from={0} to={2.1} red at={20} />
    </Stage>
  );
};

/** 2 · Five sources: windows pile up. */
const Sources: React.FC = () => (
  <Stage>
    <Win x={100} y={120} w={600} h={400} title="ledger · trial balance Q3" at={2} rot={-1.5}>
      <div style={{ padding: "14px 18px 0", fontSize: 13, fontFamily: MONO, color: GREY }}>ACCOUNT · BALANCE (SGD)</div>
      {[["1010 Cash at bank — DBS SGD", "2,904,117"], ["1012 Cash at bank — USD", "1,224,683"], ["1200 Mgmt fee receivable", "912,415"], ["1500 Investments at FV", "1,336,402"], ["1900 Other assets", "88,470"]].map(([a, b], i) => (
        <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", borderBottom: `1px solid ${LINE}`, fontSize: 17, color: INK2 }}>
          <span>{a}</span>
          <span style={{ fontFamily: MONO, color: INK }}>{b}</span>
        </div>
      ))}
    </Win>
    <Win x={760} y={50} w={500} h={340} title="Q3_NAV_pack_FINAL.pdf" at={10} rot={1}>
      <div style={{ padding: "16px 20px 0", fontSize: 15, fontWeight: 700, color: INK }}>Statement of Net Assets · 30 Sep</div>
      <Lines n={9} y={54} x={20} width={470} />
    </Win>
    <Win x={1230} y={150} w={580} h={320} title="statements · SGD · USD" at={18} rot={-1}>
      <div style={{ padding: "16px 20px 0", fontSize: 15, fontWeight: 700, color: INK }}>Account statement · 01–30 Sep</div>
      <Lines n={7} y={54} x={20} width={560} w={[0.95, 0.9, 0.92, 0.88, 0.94]} />
    </Win>
    <Win x={430} y={440} w={760} h={300} title="Q3_working_v7_FINAL_final2.xlsx" at={26} tint="#e8f5e9">
      <div style={{ display: "grid", gridTemplateColumns: "60px repeat(5, 1fr)", fontSize: 13, fontFamily: MONO, color: GREY2 }}>
        {["", "A", "B", "C", "D", "E"].map((c) => (
          <div key={c} style={{ padding: "6px 8px", borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, textAlign: "center" }}>{c}</div>
        ))}
        {Array.from({ length: 36 }).map((_, i) => (
          <div key={i} style={{ padding: "7px 8px", borderBottom: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, color: i % 6 === 0 ? GREY2 : INK2, fontSize: 13, textAlign: i % 6 === 0 ? "center" : "right" }}>
            {i % 6 === 0 ? Math.floor(i / 6) + 1 : i % 6 === 1 ? ["Cash", "AR", "Inv", "Other", "Total", "TRR"][Math.floor(i / 6)] : (Math.floor((i * 7919) % 900000) + 100000).toLocaleString("en-US")}
          </div>
        ))}
      </div>
    </Win>
    <Win x={1270} y={510} w={520} h={240} title="Form1_Q2_lodged.pdf" at={34} rot={1.5}>
      <div style={{ padding: "16px 20px 0", fontSize: 15, fontWeight: 700, color: INK }}>Form 1 · quarter ended 30 Jun</div>
      <Lines n={5} y={52} x={20} width={480} />
    </Win>
    <Cap at={30}>Ledger. Admin. Bank. Excel.</Cap>
    <Counter from={2.1} to={19.5} red />
  </Stage>
);

/** 3 · Retyped into Form 1: a cursor copies numbers cell by cell. */
const Retype: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    ["1", "Cash and bank balances", "4,128,800"],
    ["2", "Trade and other receivables", "912,415"],
    ["3", "Investments", "1,336,402"],
    ["4", "Other assets", "87,266"],
    ["5", "Total assets", "6,464,883"],
  ];
  const typedCells = Math.floor(lin(frame, 14, 74, 0, rows.length + 0.99));
  return (
    <Stage>
      <Win x={150} y={90} w={980} h={610} title="MAS Form 1 — Statement of Assets and Liabilities (template).xlsx" at={0} tint="#e8f5e9">
        <div style={{ padding: "14px 22px 8px", fontSize: 15, fontWeight: 700, color: INK, borderBottom: `1px solid ${LINE}` }}>
          FORM 1 · STATEMENT OF ASSETS AND LIABILITIES <span style={{ fontWeight: 400, color: GREY }}>· quarter ended 30 Sep · S$</span>
        </div>
        {rows.map((r, i) => {
          const done = i < typedCells;
          const typing = i === typedCells;
          const chars = typing ? Math.floor(((frame - 14 - i * 12) / 12) * r[2].length) : done ? r[2].length : 0;
          return (
            <div key={r[0]} style={{ display: "grid", gridTemplateColumns: "60px 1fr 260px", alignItems: "center", padding: "0 22px", height: 78, borderBottom: `1px solid ${LINE}`, fontSize: 21, color: INK2, fontWeight: r[1].startsWith("Total") ? 700 : 500, background: typing ? "rgba(47,107,255,0.06)" : "transparent" }}>
              <span style={{ fontFamily: MONO, color: GREY2 }}>{r[0]}</span>
              <span>{r[1]}</span>
              <span style={{ fontFamily: MONO, textAlign: "right", color: INK, borderLeft: `1px solid ${LINE}`, paddingLeft: 16, outline: typing ? `2px solid ${BLUE}` : "none", outlineOffset: -2, height: 50, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                {r[2].slice(0, Math.max(0, Math.min(r[2].length, chars)))}
                {typing ? <span style={{ width: 2, height: 26, background: BLUE, marginLeft: 3, opacity: Math.floor(frame / 6) % 2 ? 1 : 0 }} /> : null}
              </span>
            </div>
          );
        })}
      </Win>
      <Win x={1180} y={260} w={600} h={300} title="ledger · trial balance Q3" at={0} scale={0.92} rot={2}>
        {[["1010 Cash at bank — DBS SGD", "2,904,117"], ["1012 Cash at bank — USD", "1,224,683"], ["1200 Mgmt fee receivable", "912,415"], ["1900 Other assets", "88,470"]].map(([a, b]) => (
          <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "11px 18px", borderBottom: `1px solid ${LINE}`, fontSize: 16, color: INK2 }}>
            <span>{a}</span>
            <span style={{ fontFamily: MONO, color: INK }}>{b}</span>
          </div>
        ))}
      </Win>
      <Bubble at={30} who="Mei Lin" role="Compliance" when="Day 4 · 17:40" text="Is the Form 1 draft ready? Need to review before MASNET." />
      <Cap at={8}>Retyped. Cell by cell.</Cap>
      <Counter from={19.5} to={61} red />
    </Stage>
  );
};

/** 4 · Form 2 — the TRR lives in one person's formulas. */
const Formulas: React.FC = () => {
  const frame = useCurrentFrame();
  const formula = "=IF(AND(B14>0,'Q2 working'!C9<>\"\"),MAX(B14*0.05,SUMPRODUCT(D3:D11,E3:E11))+IFERROR(VLOOKUP(\"TRR\",'Priya adj'!A:C,3,0),0),0)";
  const shown = formula.slice(0, Math.floor(lin(frame, 8, 70, 0, formula.length)));
  const cells = [["Financial resources", "5,318,204"], ["Total risk requirement", "=IF(AND(…"], ["Aggregate indebtedness", "412,880"], ["FR / TRR", "4.1x"]];
  return (
    <Stage>
      <Win x={160} y={120} w={1300} h={520} title="Form2_TRR_Priya_v12.xlsx — personal" at={0} tint="#e8f5e9">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${LINE}`, fontFamily: MONO, fontSize: 17 }}>
          <span style={{ color: GREY, width: 48 }}>C14</span>
          <span style={{ color: GREY }}>fx</span>
          <span style={{ color: INK, whiteSpace: "nowrap", overflow: "hidden" }}>{shown}</span>
        </div>
        {cells.map(([a, b], i) => (
          <div key={a} style={{ display: "grid", gridTemplateColumns: "1fr 320px", alignItems: "center", padding: "0 22px", height: 84, borderBottom: `1px solid ${LINE}`, fontSize: 22, color: INK2, background: i === 1 ? "rgba(47,107,255,0.06)" : "transparent" }}>
            <span>{a}</span>
            <span style={{ fontFamily: MONO, textAlign: "right", color: i === 1 ? BLUE : INK, outline: i === 1 ? `2px solid ${BLUE}` : "none", outlineOffset: -2, height: 54, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>{b}</span>
          </div>
        ))}
      </Win>
      <Bubble at={34} who="Priya Shah" role="Finance" when="Day 6 · 21:15" text="I'm the only one who knows how C14 works. Will fix it tonight." />
      <Bubble at={56} i={1} who="Mei Lin" role="Compliance" when="Day 7 · 08:30" text="Priya is on leave next week. Who owns Form 2?" dark />
      <Cap at={8}>Form 2. One person's formulas.</Cap>
      <Counter from={61} to={146} red />
    </Stage>
  );
};

/** 5 · Doesn't tie. */
const Tie: React.FC = () => {
  const frame = useCurrentFrame();
  const flag = frame >= 30;
  const blink = flag ? 0.5 + 0.5 * Math.abs(Math.sin((frame - 30) / 6)) : 0;
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center", gap: 60 }}>
        {[
          ["LEDGER · TOTAL ASSETS", "6,466,087"],
          ["FORM 1 · TOTAL ASSETS", "6,464,883"],
        ].map(([k, v], i) => {
          const p = pIn(frame, 2 + i * 8, 14);
          return (
            <div key={k} style={{ width: 620, padding: "34px 40px 36px", borderRadius: 18, background: "#fff", boxShadow: "0 18px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: GREY }}>{k}</div>
              <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -4, color: i === 1 && flag ? RED : INK, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          );
        })}
      </div>
      {flag ? (
        <div style={{ position: "absolute", left: "50%", top: 470, transform: `translateX(-50%) scale(${0.97 + blink * 0.03})`, display: "flex", alignItems: "center", gap: 14, background: RED, color: "#fff", borderRadius: 10, padding: "14px 24px", boxShadow: `0 12px 40px rgba(216,35,42,${0.25 + blink * 0.25})` }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#fff", opacity: blink }} />
          <span style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 3, fontWeight: 700 }}>DIFFERENCE</span>
          <span style={{ fontSize: 30, fontWeight: 800 }}>−1,204</span>
          <span style={{ fontSize: 18, opacity: 0.85 }}>· somewhere in 5 files</span>
        </div>
      ) : null}
      <Bubble at={40} who="Mei Lin" role="Compliance" when="Day 9 · 23:48" text="Totals still off by 1,204. Which file is right?" />
      <Cap at={34}>
        Doesn't tie. <span style={{ color: RED }}>Again.</span>
      </Cap>
      <Counter from={146} to={222} red />
    </Stage>
  );
};

/** 6 · Day 12, 2 AM, still not lodged. */
const Day12: React.FC = () => (
  <Stage>
    <Calendar x={810} y={130} head="DAY" big="12" sub="of 14 · 02:07 AM" at={2} />
    <Bubble at={16} who="David Tan" role="Managing Partner" when="Day 12 · 01:50" text="I'm the one signing this. Lodged on MASNET yet?" dark />
    <Bubble at={34} i={1} who="Mei Lin" role="Compliance" when="Day 12 · 02:05" text="Not yet. Form 2 still rebuilding." />
    <Cap at={10}>
      Day 12. <span style={{ color: RED }}>Still not lodged.</span>
    </Cap>
    <Counter from={222} to={290} red />
  </Stage>
);

/** 7 · Black card: the stakes, then the question. */
const Stakes: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 4, 12) * (1 - pIn(frame, 52, 8));
  const b = pIn(frame, 60, 12);
  return (
    <Stage dark>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: a }}>
        <div>
          <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: -3, color: "#fff" }}>
            July 2025. <span style={{ color: RED }}>A CMS licence revoked.</span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 500, color: "#9a9a9a", marginTop: 22 }}>Among the reasons: quarterly returns not submitted.</div>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 2, color: "#6a6a6a", marginTop: 26 }}>mas.gov.sg · Enforcement actions · 3 Jul 2025</div>
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: b, transform: `scale(${0.96 + b * 0.04})` }}>
        <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -3.5, color: "#fff" }}>
          What if it took <span style={{ color: "#fff", textDecoration: "underline", textDecorationColor: BLUE, textUnderlineOffset: 14, textDecorationThickness: 8 }}>2 minutes</span>?
        </div>
      </div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ solution */

const Meet: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 2, 12);
  const b = pIn(frame, 10, 16);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", fontSize: 30, color: GREY, opacity: a }}>Meet</div>
      <div style={{ position: "absolute", left: "50%", top: 400, transform: `translateX(-50%) scale(${0.92 + b * 0.08})`, opacity: b }}>
        <div style={{ display: "flex", alignItems: "center", fontFamily: SANS, fontWeight: 500, fontSize: 190, lineHeight: 1, color: INK, letterSpacing: 54, paddingLeft: 54 }}>
          <span style={{ marginRight: -14 }}>C</span>
          <span style={{ display: "inline-block", marginRight: 54, marginTop: 4 }}>
            <OMark size={142} color={INK} />
          </span>
          <span>R</span>
          <span>E</span>
        </div>
      </div>
    </Stage>
  );
};

const SOURCES = [
  { k: "General ledger", s: "Trial balance · every account", icon: "▤" },
  { k: "Fund administrator", s: "NAV pack · statements", icon: "▣" },
  { k: "Bank statements", s: "SGD · USD · every line", icon: "◫" },
  { k: "Your spreadsheets", s: "Working files · formulas included", icon: "⊞" },
  { k: "Last quarter's lodgement", s: "Form 1 · Form 2 as filed", icon: "▥" },
  { k: "MAS rules", s: "SF(FMR) Regulations · Form notes", icon: "§" },
];

/** 8 · Reads every source: the list rolls, then becomes an orbit around CORE. */
const Reads: React.FC = () => {
  const frame = useCurrentFrame();
  const ROLL = 48; // frames of list rolling
  const orbit = pIn(frame, ROLL + 6, 20);
  const cx = 960, cy = 440;
  return (
    <Stage>
      {/* rolling list */}
      <div style={{ position: "absolute", left: 300, top: 0, opacity: 1 - orbit }}>
        {SOURCES.map((s, i) => {
          const centre = lin(frame, 0, ROLL, 0, SOURCES.length - 1);
          const d = i - centre;
          const y = 420 + d * 120;
          const a = Math.max(0, 1 - Math.abs(d) * 0.45);
          return (
            <div key={s.k} style={{ position: "absolute", left: 0, top: y, display: "flex", gap: 24, alignItems: "flex-start", opacity: a, transform: `scale(${0.9 + a * 0.1})`, transformOrigin: "0 50%" }}>
              <span style={{ fontSize: 30, color: GREY, width: 40, textAlign: "center", marginTop: 4 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 46, fontWeight: 600, color: INK, letterSpacing: -1.5, whiteSpace: "nowrap" }}>{s.k}</div>
                <div style={{ fontSize: 20, color: GREY, marginTop: 4, whiteSpace: "nowrap" }}>{s.s}</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* orbit */}
      <div style={{ position: "absolute", inset: 0, opacity: orbit }}>
        <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
          {SOURCES.map((_, i) => {
            const ang = (i / SOURCES.length) * Math.PI * 2 - Math.PI / 2 + (frame - ROLL) / 400;
            const x = cx + Math.cos(ang) * 440, y = cy + Math.sin(ang) * 230;
            const t = ((frame - ROLL) / 40 + i * 0.17) % 1;
            return (
              <g key={i}>
                <line x1={x} y1={y} x2={cx} y2={cy} stroke="#cfcfcf" strokeWidth={1.5} />
                <circle cx={x + (cx - x) * t} cy={y + (cy - y) * t} r={4} fill={INK} />
              </g>
            );
          })}
        </svg>
        {SOURCES.map((s, i) => {
          const ang = (i / SOURCES.length) * Math.PI * 2 - Math.PI / 2 + (frame - ROLL) / 400;
          const x = cx + Math.cos(ang) * 440, y = cy + Math.sin(ang) * 230;
          return (
            <div key={s.k} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 999, padding: "8px 16px", fontSize: 17, fontWeight: 600, color: INK, boxShadow: "0 6px 20px rgba(0,0,0,0.08)", whiteSpace: "nowrap" }}>
              <span style={{ color: GREY, marginRight: 8 }}>{s.icon}</span>
              {s.k}
            </div>
          );
        })}
        <div style={{ position: "absolute", left: cx - 70, top: cy - 70, width: 140, height: 140, borderRadius: 999, background: INK, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", color: "#fff", fontWeight: 500, fontSize: 30, letterSpacing: 7, paddingLeft: 7 }}>
            C<span style={{ display: "inline-block", margin: "0 7px 0 -1px", marginTop: 2 }}><OMark size={24} color="#fff" /></span>RE
          </div>
        </div>
      </div>
      <Cap at={6} out={ROLL + 8}>Reads every source.</Cap>
      <Cap at={ROLL + 12}>All at once.</Cap>
      <Counter from={0} to={0.0123} lines={[0, 12287]} />
    </Stage>
  );
};

/** 9 · Maps every account to the MAS line item. */
const Maps: React.FC = () => {
  const frame = useCurrentFrame();
  const G = [
    { target: "Cash and bank balances", raw: ["1010 Cash at bank — DBS SGD", "1012 Cash at bank — USD", "Admin: Cash & equivalents"], sum: "4,128,800" },
    { target: "Trade and other receivables", raw: ["1200 Mgmt fee receivable", "Admin: Fees due from fund"], sum: "912,415" },
    { target: "Total risk requirement", raw: ["Form 2 · computed from the rules, not C14"], sum: "1,296,110" },
  ];
  return (
    <Stage>
      <div style={{ position: "absolute", left: 180, top: 110, fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: GREY }}>IN YOUR FILES</div>
      <div style={{ position: "absolute", left: 1080, top: 110, fontFamily: MONO, fontSize: 14, letterSpacing: 3, color: GREY }}>ON THE MAS FORM</div>
      {G.map((g, gi) => {
        const base = 4 + gi * 22;
        const top = 170 + gi * 220;
        const p = pIn(frame, base, 14);
        const ok = pIn(frame, base + 26, 10);
        return (
          <React.Fragment key={g.target}>
            <div style={{ position: "absolute", left: 180, top, width: 780, opacity: p }}>
              {g.raw.map((r, i) => (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: 14, height: 50, fontSize: 26, color: INK2, opacity: pIn(frame, base + i * 4, 10), whiteSpace: "nowrap" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: GREY2 }} />
                  {r}
                </div>
              ))}
            </div>
            <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
              {g.raw.map((_, i) => {
                const y = top + 25 + i * 50, ty = top + 56;
                const q = pIn(frame, base + 8 + i * 3, 14);
                return <path key={i} d={`M 900 ${y} C 990 ${y}, 990 ${ty}, 1080 ${ty}`} stroke="#cfcfcf" strokeWidth={1.6} fill="none" strokeDasharray={400} strokeDashoffset={400 * (1 - q)} />;
              })}
            </svg>
            <div style={{ position: "absolute", left: 1080, top: top + 6, width: 660, padding: "18px 24px", borderRadius: 14, background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: pIn(frame, base + 12, 14) }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2.5, color: GREY }}>{gi === 2 ? "FORM 2" : "FORM 1"}</div>
                <div style={{ fontSize: 27, fontWeight: 700, color: INK, marginTop: 4 }}>{g.target}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 24, color: INK }}>{g.sum}</span>
                <span style={{ width: 30, height: 30, borderRadius: 999, background: GREEN, color: "#fff", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${ok})` }}>✓</span>
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <Cap at={6}>Maps every account to the MAS line.</Cap>
      <Counter from={0.0123} to={0.0211} lines={[12287, 13705]} />
    </Stage>
  );
};

/** 10 · Flags the one gap and shows where. */
const Gap: React.FC = () => {
  const frame = useCurrentFrame();
  const p = pIn(frame, 2, 14);
  const trace = pIn(frame, 26, 16);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 200, top: 140, width: 740, padding: "26px 32px 28px", borderRadius: 18, background: "#fff", boxShadow: "0 18px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>CHECK · LEDGER ↔ FORM 1</div>
        {[["Cash and bank balances", true], ["Trade and other receivables", true], ["Investments", true], ["Other assets", false], ["Total assets", false]].map(([k, ok], i) => (
          <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 62, borderBottom: `1px solid ${LINE}`, fontSize: 25, color: INK2, opacity: pIn(frame, 8 + i * 3, 8) }}>
            <span style={{ fontWeight: i === 4 ? 700 : 500, color: ok ? INK2 : RED }}>{k}</span>
            {ok ? <span style={{ color: GREEN, fontWeight: 800 }}>✓</span> : <span style={{ fontFamily: MONO, color: RED, fontWeight: 700 }}>−1,204</span>}
          </div>
        ))}
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M 940 430 C 1025 430, 1025 330, 1110 330" stroke={RED} strokeWidth={2} fill="none" strokeDasharray={300} strokeDashoffset={300 * (1 - trace)} />
      </svg>
      <div style={{ position: "absolute", left: 1110, top: 230, width: 600, borderRadius: 14, background: "#fff", boxShadow: "0 18px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(216,35,42,0.35)", overflow: "hidden", opacity: trace }}>
        <div style={{ padding: "12px 18px", background: "rgba(216,35,42,0.06)", borderBottom: `1px solid ${LINE}`, fontFamily: MONO, fontSize: 13, letterSpacing: 2, color: RED }}>FOUND · Q3_NAV_pack_FINAL.pdf · p.31 · row 212</div>
        <div style={{ padding: "16px 18px 18px", fontSize: 20, color: INK2, lineHeight: 1.5 }}>
          Accrued expense <b style={{ color: INK }}>S$1,204</b> booked by the administrator on 30 Sep, not yet in the ledger.
        </div>
        <div style={{ padding: "0 18px 18px", display: "flex", gap: 10 }}>
          {["Post to ledger", "Keep Form 1 as is"].map((b, i) => (
            <span key={b} style={{ fontSize: 16, fontWeight: 600, padding: "8px 14px", borderRadius: 999, background: i ? "#f1f1f1" : INK, color: i ? INK2 : "#fff" }}>{b}</span>
          ))}
        </div>
      </div>
      <Cap at={6}>Flags the one gap. Shows where.</Cap>
      <Counter from={0.0211} to={0.0289} lines={[13705, 15123]} />
    </Stage>
  );
};

/** 11 · Form 1, Form 2, ready for MASNET. */
const Ready: React.FC = () => {
  const frame = useCurrentFrame();
  const docs = [
    { t: "Form 1", s: "Statement of Assets and Liabilities", d: 2 },
    { t: "Form 2", s: "Financial Resources · TRR · Aggregate Indebtedness", d: 14 },
  ];
  return (
    <Stage>
      {docs.map((d, i) => {
        const p = pIn(frame, d.d, 16);
        const ok = pIn(frame, d.d + 30, 10);
        return (
          <div key={d.t} style={{ position: "absolute", left: 330 + i * 680, top: 150, width: 580, height: 560, borderRadius: 18, background: "#fff", boxShadow: "0 24px 70px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)", padding: "30px 34px", opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: INK }}>{d.t}</div>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 2.5, color: GREEN, border: `1.5px solid ${GREEN}`, borderRadius: 6, padding: "6px 10px", opacity: ok, transform: `scale(${0.8 + ok * 0.2})` }}>READY · MASNET</div>
            </div>
            <div style={{ fontSize: 18, color: GREY, marginTop: 6 }}>{d.s}</div>
            <div style={{ fontSize: 14, color: GREY2, marginTop: 4, fontFamily: MONO }}>quarter ended 30 Sep · S$</div>
            <Lines n={9} y={150} x={0} width={512} at={d.d + 6} gap={22} w={[0.92, 0.7, 0.85, 0.6, 0.8, 0.75, 0.66, 0.9, 0.5]} />
            <div style={{ position: "absolute", left: 34, right: 34, bottom: 30, display: "flex", justifyContent: "space-between", fontSize: 16, color: GREY }}>
              <span>Every number traced to its source</span>
              <span style={{ color: GREEN, fontWeight: 700, opacity: ok }}>0 open items</span>
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 745, textAlign: "center", opacity: pIn(frame, 40, 12) }}>
        <span style={{ display: "inline-block", padding: "8px 16px", borderRadius: 999, background: "#f1f1f1", fontSize: 18, color: INK2 }}>VCFM? Form 25A, once a year — same pipeline.</span>
      </div>
      <Cap at={8}>
        Form 1. Form 2. <span style={{ color: BLUE }}>2 minutes.</span>
      </Cap>
      <Counter from={0.0289} to={0.0333} lines={[15123, 16541]} />
    </Stage>
  );
};

/** 12 · You review. You lodge. */
const YouLodge: React.FC = () => (
  <Stage>
    <Cap at={4} size={96}>You review. You lodge.</Cap>
    <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 18, padding: "22px 36px", borderRadius: 999, background: INK, color: "#fff", fontSize: 30, fontWeight: 700 }}>
        <span style={{ width: 14, height: 14, borderRadius: 999, background: GREEN }} />
        Lodged on MASNET · Day 1 · 10:14
      </div>
    </div>
    <Counter from={0.0333} to={0.0333} lines={[16541, 16541]} />
  </Stage>
);

/** 13 · End card: the lockup, one line, the button. */
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 2, 14), b = pIn(frame, 16, 14), c = pIn(frame, 28, 12);
  return (
    <Stage>
      <div style={{ position: "absolute", left: "50%", top: 330, transform: `translateX(-50%) scale(${0.94 + a * 0.06})`, opacity: a }}>
        <Lockup size={110} color={INK} subColor="#5c5c5c" dot={BLUE} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontSize: 30, color: INK2, opacity: b }}>MAS returns in 2 minutes.</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 720, display: "flex", justifyContent: "center", opacity: c }}>
        <span style={{ padding: "14px 28px", borderRadius: 999, background: INK, color: "#fff", fontSize: 20, fontWeight: 700 }}>Book a demo →</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: GREY, opacity: c }}>treasurer.net</div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ cut */

type S = { id: string; dur: number; body: React.FC };

export const MASCORE_SCENES: S[] = [
  { id: "quarter-end", dur: 3.2, body: QuarterEnd },
  { id: "sources", dur: 3.2, body: Sources },
  { id: "retype", dur: 3.2, body: Retype },
  { id: "formulas", dur: 3.4, body: Formulas },
  { id: "tie", dur: 2.6, body: Tie },
  { id: "day12", dur: 2.4, body: Day12 },
  { id: "stakes", dur: 4.0, body: Stakes },
  { id: "meet", dur: 1.8, body: Meet },
  { id: "reads", dur: 4.0, body: Reads },
  { id: "maps", dur: 3.4, body: Maps },
  { id: "gap", dur: 3.2, body: Gap },
  { id: "ready", dur: 3.0, body: Ready },
  { id: "you", dur: 2.2, body: YouLodge },
  { id: "end", dur: 3.0, body: End },
];

const frames = (s: S) => Math.round(s.dur * FPS);
export const MASCORE_FRAMES = MASCORE_SCENES.reduce((a, s, i) => a + frames(s) - (i > 0 ? CUT : 0), 0);

export const MasCore: React.FC = () => (
  <AbsoluteFill style={{ background: "#fff" }}>
    <TransitionSeries>
      {MASCORE_SCENES.flatMap((s, i) => {
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
