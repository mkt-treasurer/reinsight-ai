/**
 * "MAS returns, Day 1" — ~38s back-office film for Singapore fund managers. TREASURER brand (the regulatory-
 * reporting engine behind the Korean FSS film), not Core. White look shared with mas-core.tsx, but its own spine:
 * a 14-day bar across the top (quarter end → MAS-Tx due date). Without Treasurer the marker crawls to Day 12;
 * with Treasurer everything happens on Day 1.
 *
 * MAS facts on screen (checked 27 Oct 2026):
 *   Form 1 (Statement of Assets and Liabilities) and Form 2 (Financial Resources, Total Risk Requirement and
 *   Aggregate Indebtedness) — quarterly within 14 days of quarter end, annually within 5 months, submitted online
 *   via MAS-Tx (mas.gov.sg form pages; the Aug 2024 LFMC toolkit still says MASNET). Line labels are from the
 *   post-2018 Form 1/2 PDFs. Operational risk requirement: the higher of 5% of average annual gross income
 *   (3 preceding financial years; 2% above S$10m) and S$100,000 (S$50,000 for A/I-only) — SFA 04-N13 paras
 *   4.1.2–4.1.4. Financial resources must not fall below TRR; notify MAS immediately if below 120% — para 3.1.1.
 * All names and numbers are illustrative.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { BLUE, Bubble, Cap, GREEN, GREY, GREY2, INK, INK2, LINE, Lines, MONO, RED, SANS, Stage, Win, pIn, lin } from "./mas-core";

const FPS = 30;
const CUT = 6;
const BRAND = "#1d4ed8";

/* ------------------------------------------------------------------ chrome */

const Mark: React.FC = () => (
  <div style={{ position: "absolute", top: 44, left: 60, display: "flex", alignItems: "center", gap: 10 }}>
    <span style={{ width: 11, height: 11, background: BRAND, transform: "rotate(45deg)" }} />
    <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: 5, color: INK2 }}>TREASURER</span>
  </div>
);

/**
 * The spine: 14 cells from "Q3 ended · 30 Sep" to "MAS-Tx · 14 Oct". `from`→`to` is the day the marker moves
 * between during this scene (fractional allowed); `len` frames for the move. Red cells in the old way, blue with Treasurer.
 */
const DayBar: React.FC<{ from: number; to: number; len?: number; at?: number; good?: boolean; label?: string }> = ({ from, to, len = 60, at = 0, good, label }) => {
  const frame = useCurrentFrame();
  const day = lin(frame, at, at + len, from, to);
  const col = good ? BRAND : RED;
  const X0 = 300, W = 1320, CW = W / 14;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 36, height: 70, opacity: pIn(frame, 0, 10) }}>
      <div style={{ position: "absolute", left: X0 - 170, top: 14, width: 160, textAlign: "right", fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: GREY, lineHeight: 1.5 }}>
        Q3 ENDED<br /><span style={{ color: INK, fontWeight: 700 }}>30 SEP</span>
      </div>
      {Array.from({ length: 14 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, day - i));
        return (
          <div key={i} style={{ position: "absolute", left: X0 + i * CW, top: 24, width: CW - 4, height: 16, borderRadius: 4, background: "#ececec", overflow: "hidden" }}>
            <div style={{ width: `${fill * 100}%`, height: "100%", background: col }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: X0 + W + 10, top: 14, width: 170, fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: GREY, lineHeight: 1.5 }}>
        DUE · MAS-Tx<br /><span style={{ color: INK, fontWeight: 700 }}>14 OCT</span>
      </div>
      {/* marker */}
      <div style={{ position: "absolute", left: X0 + Math.min(14, day) * CW - 1, top: 16, width: 3, height: 32, background: col, borderRadius: 2 }} />
      <div style={{ position: "absolute", left: X0 + Math.min(14, day) * CW - 60, top: 52, width: 120, textAlign: "center", fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: 2, color: col }}>
        {label ?? `DAY ${Math.max(1, Math.ceil(day))}`}
      </div>
    </div>
  );
};

/** Big bottom-right day counter. */
const Day: React.FC<{ n: number; good?: boolean; at?: number }> = ({ n, good, at = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", right: 60, bottom: 46, textAlign: "right", opacity: pIn(frame, at, 10) }}>
      <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>DAY OF 14</div>
      <div style={{ fontSize: 34, fontWeight: 800, color: good ? BRAND : RED, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{n}</div>
    </div>
  );
};

/** Source chip bottom-left. */
const Src: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const frame = useCurrentFrame();
  return <div style={{ position: "absolute", left: 60, bottom: 46, fontFamily: MONO, fontSize: 13, letterSpacing: 1.5, color: GREY, background: "#f3f3f3", borderRadius: 6, padding: "7px 12px", opacity: pIn(frame, at, 10) }}>{text}</div>;
};

/** Step label at top-left of the solution scenes. */
const StepTag: React.FC<{ n: number; text: string }> = ({ n, text }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 60, top: 130, display: "flex", alignItems: "center", gap: 14, opacity: pIn(frame, 2, 12) }}>
      <span style={{ width: 36, height: 36, borderRadius: 999, background: BRAND, color: "#fff", fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
      <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 3, color: INK2, textTransform: "uppercase" }}>{text}</span>
    </div>
  );
};

/** A MAS form rendered as a document, with real line labels. */
const FormDoc: React.FC<{ x: number; y: number; w: number; h: number; title: string; sub: string; rows: [string, string?, boolean?][]; at: number; hiAt?: number }> = ({ x, y, w, h, title, sub, rows, at, hiAt = 9999 }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 16);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: "#fff", borderRadius: 10, boxShadow: "0 18px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", padding: "26px 30px", opacity: p, transform: `translateY(${(1 - p) * 24}px)`, overflow: "hidden" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: GREY }}>SFA · FINANCIAL AND MARGIN REQUIREMENTS REGULATIONS · REG 27</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: INK, marginTop: 8, letterSpacing: -0.5 }}>{title}</div>
      <div style={{ fontSize: 13, color: GREY, marginTop: 2 }}>{sub}</div>
      <div style={{ marginTop: 16 }}>
        {rows.map(([k, v, head], i) => {
          const hi = frame >= hiAt + i * 6 && !head;
          return (
            <div key={k + i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: head ? "10px 0 4px" : "6px 6px", marginLeft: head ? 0 : 6, borderBottom: head ? "none" : `1px solid ${LINE}`, fontSize: head ? 12 : 15, fontFamily: head ? MONO : SANS, letterSpacing: head ? 2 : 0, color: head ? GREY : INK2, background: hi ? "rgba(29,78,216,0.08)" : "transparent", borderRadius: 4, opacity: pIn(frame, at + 8 + i * 2, 8) }}>
              <span>{k}</span>
              {v !== undefined ? <span style={{ fontFamily: MONO, color: hi ? BRAND : INK, fontWeight: hi ? 700 : 400 }}>{v}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FORM1_ROWS: [string, string?, boolean?][] = [
  ["ASSETS · CURRENT ASSETS", undefined, true],
  ["(5) Trade debtors for fund management", ""],
  ["(7) Securities and units in a CIS (at fair value) · (c) others", ""],
  ["(9) Deposits with banks and cash balances · (b) corporation's own balances", ""],
  ["(13) Other current assets · (a) deposits (b) pre-payments (c) others", ""],
  ["Total Current Assets", ""],
  ["LIABILITIES · CURRENT", undefined, true],
  ["(5) Trade creditors for fund management", ""],
  ["(9) Amount due to directors and connected persons", ""],
  ["SHAREHOLDERS' FUNDS", undefined, true],
  ["Paid-up capital · (1) ordinary shares", ""],
  ["Unappropriated profit or loss", ""],
];

const FORM2_ROWS: [string, string?, boolean?][] = [
  ["(I) BASE CAPITAL", undefined, true],
  ["(1) Paid-up capital (a) ordinary shares", ""],
  ["(3) Unappropriated profit or loss account", ""],
  ["Less: (a) Dividend declared (b) Interim loss", ""],
  ["(II) FINANCIAL RESOURCES", undefined, true],
  ["(2) Deductions: non-current assets · pre-paid expenses · unsecured amounts due from related corporations", ""],
  ["Financial Resources (\"FR\")", ""],
  ["(III) TOTAL RISK REQUIREMENT", undefined, true],
  ["(A) Operational risk requirement — 5% of average annual gross income, min S$100,000", ""],
  ["Total Risk Requirement (\"TRR\")", ""],
  ["FR/TRR Ratio: FR/TRR × 100% — notify MAS if below 120%", ""],
];

/* ------------------------------------------------------------------ problem */

/** 1 · Quarter end: the MAS-Tx task appears. */
const QuarterEnd: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <Mark />
      <DayBar from={0} to={0} label="QUARTER END" />
      <Win x={360} y={190} w={1200} h={420} title="mastx.mas.gov.sg · Regular Data Returns" at={6} tint="#eef2ff">
        <div style={{ padding: "26px 32px 0" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2.5, color: GREY }}>QUARTERLY FINANCIAL RETURNS · QUARTER ENDED 30 SEP 2026</div>
          {[
            ["Form 1", "Statement of Assets and Liabilities", "Due 14 Oct 2026", "Not submitted"],
            ["Form 2", "Statement of Financial Resources, Total Risk Requirement and Aggregate Indebtedness", "Due 14 Oct 2026", "Not submitted"],
          ].map((r, i) => (
            <div key={r[0]} style={{ display: "grid", gridTemplateColumns: "120px 1fr 190px 170px", alignItems: "center", gap: 20, marginTop: i ? 12 : 22, padding: "18px 20px", borderRadius: 10, border: `1px solid ${LINE}`, opacity: pIn(frame, 18 + i * 10, 12) }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: INK }}>{r[0]}</span>
              <span style={{ fontSize: 17, color: INK2, lineHeight: 1.3 }}>{r[1]}</span>
              <span style={{ fontSize: 15, color: GREY }}>{r[2]}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: RED, background: "rgba(216,35,42,0.08)", borderRadius: 999, padding: "6px 12px", textAlign: "center" }}>{r[3]}</span>
            </div>
          ))}
          <div style={{ marginTop: 22, fontSize: 15, color: GREY, opacity: pIn(frame, 44, 10) }}>Regulation 27 · within 14 days from the end of each quarter · annual audited Forms 1–6 within 5 months</div>
        </div>
      </Win>
      <Cap at={8}>Two forms. Fourteen days.</Cap>
      <Day n={0} at={10} />
    </Stage>
  );
};

/** 2 · What MAS actually asks for: the real line items and formulas. */
const WhatMasAsks: React.FC = () => (
  <Stage>
    <Mark />
    <DayBar from={0} to={1} len={40} />
    <FormDoc x={150} y={130} w={790} h={590} title="Form 1 · Statement of Assets and Liabilities" sub="as at 30 Sep 2026 · S$" rows={FORM1_ROWS} at={4} />
    <FormDoc x={980} y={130} w={790} h={590} title="Form 2 · Financial Resources, TRR, Aggregate Indebtedness" sub="as at 30 Sep 2026 · S$" rows={FORM2_ROWS} at={14} />
    <Cap at={14}>MAS's line items. MAS's formulas.</Cap>
    <Src text="Form 1 / Form 2 (post-2018) · SFA 04-N13 paras 3.1.1, 4.1.2" at={40} />
    <Day n={1} />
  </Stage>
);

/** 3 · Where the numbers live: six files, three years of revenue, one spreadsheet. */
const Files: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <Mark />
      <DayBar from={1} to={6} len={100} />
      <Win x={110} y={130} w={560} h={300} title="xero · trial balance · 30 Sep" at={4} rot={-1}>
        {[["1010 Cash at bank — DBS SGD", "2,904,117"], ["1012 Cash at bank — USD", "1,224,683"], ["1200 Mgmt fee receivable", "912,415"], ["1900 Prepaid rent & insurance", "88,470"]].map(([a, b]) => (
          <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "11px 18px", borderBottom: `1px solid ${LINE}`, fontSize: 16, color: INK2 }}>
            <span>{a}</span>
            <span style={{ fontFamily: MONO, color: INK }}>{b}</span>
          </div>
        ))}
      </Win>
      <Win x={700} y={110} w={500} h={260} title="Q3_NAV_pack_FINAL.pdf · 42 pp" at={12} rot={1}>
        <div style={{ padding: "14px 18px 0", fontSize: 14, fontWeight: 700, color: INK }}>Fund administrator · statement of net assets</div>
        <Lines n={6} y={46} x={18} width={460} />
      </Win>
      <Win x={1230} y={130} w={560} h={250} title="FY2023 · FY2024 · FY2025 audited P&L" at={20} rot={-0.6}>
        <div style={{ padding: "14px 18px 0", fontSize: 14, fontWeight: 700, color: INK }}>Total revenue, less fee · commission · interest expenses</div>
        {[["FY2023", "4,912,000"], ["FY2024", "5,604,000"], ["FY2025", "6,281,000"]].map(([a, b]) => (
          <div key={a} style={{ display: "flex", justifyContent: "space-between", padding: "8px 18px", borderBottom: `1px solid ${LINE}`, fontSize: 15, color: INK2 }}>
            <span>{a}</span>
            <span style={{ fontFamily: MONO, color: INK }}>{b}</span>
          </div>
        ))}
      </Win>
      <Win x={420} y={400} w={520} h={240} title="statements · DBS SGD · USD · Sep" at={28} rot={0.8}>
        <Lines n={6} y={20} x={18} width={480} w={[0.95, 0.9, 0.92, 0.88, 0.94, 0.9]} />
      </Win>
      <Win x={980} y={420} w={460} h={220} title="Form1_Form2_Q2_lodged.pdf · MAS-Tx" at={36} rot={-1.2}>
        <div style={{ padding: "14px 18px 0", fontSize: 14, fontWeight: 700, color: INK }}>Last quarter, as lodged</div>
        <Lines n={4} y={46} x={18} width={420} />
      </Win>
      <Win x={1300} y={430} w={520} h={230} title="Q3_Form2_TRR_v9_Priya.xlsx — personal" at={44} tint="#e8f5e9">
        <div style={{ padding: "12px 16px", fontFamily: MONO, fontSize: 13, color: INK2, lineHeight: 1.7 }}>
          C14 =MAX(0.05*AVERAGE('FY23'!R9,'FY24'!R9,'FY25'!R9),100000)<br />
          C18 =C9-C13 <span style={{ color: GREY }}>'deductions? ask auditor</span><br />
          C20 =C18/C14 <span style={{ color: RED }}>'120% check — manual</span>
        </div>
      </Win>
      <Bubble at={62} who="Mei Lin" role="Compliance" when="Day 5 · 18:20" text="Which revenue goes into AAGI — before or after the rebate?" />
      <Cap at={10}>Six files. Three years. One spreadsheet.</Cap>
      <Day n={5} />
    </Stage>
  );
};

/** 4 · Day 12: #REF! */
const Day12: React.FC = () => {
  const frame = useCurrentFrame();
  const blink = 0.5 + 0.5 * Math.abs(Math.sin(frame / 6));
  return (
    <Stage>
      <Mark />
      <DayBar from={6} to={12} len={50} />
      <Win x={300} y={150} w={1320} h={430} title="Q3_Form2_TRR_v9_Priya.xlsx — personal" at={0} tint="#e8f5e9">
        {[["Financial Resources (FR)", "3,200,118", false], ["Operational risk requirement", "280,000", false], ["Total Risk Requirement (TRR)", "#REF!", true], ["FR/TRR Ratio", "#REF!", true]].map(([a, b, bad], i) => (
          <div key={String(a)} style={{ display: "grid", gridTemplateColumns: "1fr 320px", alignItems: "center", padding: "0 26px", height: 92, borderBottom: `1px solid ${LINE}`, fontSize: 24, color: INK2, background: bad ? `rgba(216,35,42,${0.04 + blink * 0.05})` : "transparent", opacity: pIn(frame, 4 + i * 5, 10) }}>
            <span style={{ fontWeight: i >= 2 ? 700 : 500 }}>{a}</span>
            <span style={{ fontFamily: MONO, textAlign: "right", color: bad ? RED : INK, fontWeight: bad ? 800 : 500 }}>{b}</span>
          </div>
        ))}
      </Win>
      <Bubble at={20} who="Priya Shah" role="Finance" when="Day 12 · 01:40" text="Deleted the FY23 tab by mistake. Rebuilding the TRR tonight." />
      <Bubble at={40} i={1} who="David Tan" role="Managing Partner" when="Day 12 · 08:05" text="I sign this on the 14th. Is the 120% test done?" dark />
      <Cap at={8}>
        Day 12. <span style={{ color: RED }}>FR/TRR: #REF!</span>
      </Cap>
      <Day n={12} />
    </Stage>
  );
};

/** 5 · Reset: the same quarter, in Treasurer. */
const Reset: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 4, 14);
  return (
    <Stage>
      <Mark />
      <DayBar from={12} to={1} len={30} good label="DAY 1" />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: a }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3.5, color: INK }}>
            The same quarter, <span style={{ color: BRAND }}>in Treasurer.</span>
          </div>
          <div style={{ fontSize: 26, color: GREY, marginTop: 18 }}>Same engine as our FSS reporting module. New template: MAS Form 1 and Form 2.</div>
        </div>
      </div>
      <Day n={1} good />
    </Stage>
  );
};

/* ------------------------------------------------------------------ solution */

/** 6 · Step 1: reads what each MAS line needs. */
const ReadsForm: React.FC = () => {
  const frame = useCurrentFrame();
  const needs = [
    { line: "Form 1 (9)(b) Deposits with banks and cash balances — corporation's own balances", need: "GL cash accounts, excluding client / trust money", rule: "Form 1 note" },
    { line: "Form 1 (5) Trade debtors for fund management", need: "Management & performance fees receivable from the funds", rule: "Form 1" },
    { line: "Form 2 (II)(2) Deductions from financial resources", need: "Non-current assets · pre-payments · unsecured related-party receivables", rule: "Form 2" },
    { line: "Form 2 (III)(A) Operational risk requirement", need: "Average annual gross income, 3 preceding FYs; 5%; floor S$100,000", rule: "SFA 04-N13 para 4.1.2–4.1.4" },
    { line: "FR/TRR ratio", need: "FR ÷ TRR × 100%; notify MAS immediately if below 120%", rule: "SFA 04-N13 para 3.1.1" },
  ];
  return (
    <Stage>
      <Mark />
      <DayBar from={1} to={1} good label="DAY 1" />
      <StepTag n={1} text="Reads the form" />
      <div style={{ position: "absolute", left: 60, top: 190, width: 1800 }}>
        {needs.map((n, i) => {
          const p = pIn(frame, 10 + i * 10, 12);
          return (
            <div key={n.line} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr 260px", gap: 24, alignItems: "center", padding: "22px 24px", borderRadius: 12, background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)", marginBottom: 14, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.3 }}>{n.line}</div>
              <div style={{ fontSize: 20, color: INK2, lineHeight: 1.35 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: BRAND, marginRight: 8 }}>NEEDS</span>
                {n.need}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1.5, color: GREY, textAlign: "right" }}>{n.rule}</div>
            </div>
          );
        })}
      </div>
      <Cap at={8}>Reads what every MAS line needs.</Cap>
      <Day n={1} good />
    </Stage>
  );
};

/** 7 · Step 2: maps your accounts to MAS lines. */
const MapsAccounts: React.FC = () => {
  const frame = useCurrentFrame();
  const G = [
    { raw: ["1010 Cash at bank — DBS SGD", "1012 Cash at bank — USD", "1015 Fixed deposit · 3 months"], target: "Form 1 · (9)(b) Deposits with banks and cash balances — own", sum: "4,478,800" },
    { raw: ["1200 Mgmt fee receivable — Fund I", "1210 Performance fee accrued — Fund II"], target: "Form 1 · (5) Trade debtors for fund management", sum: "912,415" },
    { raw: ["1900 Prepaid rent & insurance", "1950 Office fit-out (non-current)"], target: "Form 2 · (II)(2) Deductions from financial resources", sum: "212,470" },
  ];
  const LX = 60, RX = 1010, LW = 820;
  return (
    <Stage>
      <Mark />
      <DayBar from={1} to={1} good label="DAY 1" />
      <StepTag n={2} text="Maps your accounts" />
      <div style={{ position: "absolute", left: LX, top: 190, fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>YOUR CHART OF ACCOUNTS</div>
      <div style={{ position: "absolute", left: RX, top: 190, fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: BRAND }}>MAS LINE</div>
      {G.map((g, gi) => {
        const base = 8 + gi * 20;
        const top = 230 + gi * 180;
        const ty = top + 30;
        return (
          <React.Fragment key={g.target}>
            {g.raw.map((r, i) => (
              <div key={r} style={{ position: "absolute", left: LX, top: top + i * 44, width: LW, fontSize: 21, color: INK2, opacity: pIn(frame, base + i * 4, 10), whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: GREY2, marginRight: 14, verticalAlign: "middle" }} />
                {r}
              </div>
            ))}
            <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
              {g.raw.map((_, i) => {
                const y = top + 14 + i * 44;
                const q = pIn(frame, base + 8 + i * 3, 14);
                return <path key={i} d={`M ${LX + 560} ${y} C ${LX + 700} ${y}, ${RX - 140} ${ty}, ${RX - 20} ${ty}`} stroke="#cfcfcf" strokeWidth={1.6} fill="none" strokeDasharray={600} strokeDashoffset={600 * (1 - q)} />;
              })}
            </svg>
            <div style={{ position: "absolute", left: RX, top: top - 16, width: 820, padding: "16px 22px", borderRadius: 12, background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, opacity: pIn(frame, base + 12, 14) }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: INK, lineHeight: 1.3 }}>{g.target}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 20, color: INK }}>{g.sum}</span>
                <span style={{ width: 28, height: 28, borderRadius: 999, background: GREEN, color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pIn(frame, base + 24, 10)})` }}>✓</span>
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <Cap at={8}>Maps every account to a MAS line. Once.</Cap>
      <Src text="Mapping is kept; next quarter it is reused and only new accounts are asked about" at={60} />
      <Day n={1} good />
    </Stage>
  );
};

/** 8 · Step 3: Form 2 by the rule, not by a macro. */
const Computes: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = [
    { k: "Average annual gross income", f: "(4,912,000 + 5,604,000 + 6,281,000) ÷ 3", v: "5,599,000", r: "para 4.1.4 · total revenue less fee, commission, interest expenses" },
    { k: "Operational risk requirement", f: "max( 5% × 5,599,000 , 100,000 )", v: "279,950", r: "para 4.1.2" },
    { k: "Total risk requirement (TRR)", f: "ORR + other requirements MAS imposes (none)", v: "279,950", r: "para 3.2.1 · below the S$10m / 5× FR threshold" },
    { k: "Financial resources (FR)", f: "base capital 2,000,000 + unapp. profit 1,412,588 − deductions 212,470", v: "3,200,118", r: "Form 2 (II)" },
  ];
  const ratio = pIn(frame, 70, 14);
  return (
    <Stage>
      <Mark />
      <DayBar from={1} to={1} good label="DAY 1" />
      <StepTag n={3} text="Computes by the rule" />
      <div style={{ position: "absolute", left: 60, top: 190, width: 1220 }}>
        {steps.map((s, i) => {
          const p = pIn(frame, 8 + i * 12, 12);
          return (
            <div key={s.k} style={{ display: "grid", gridTemplateColumns: "300px 1fr 170px", gap: 20, alignItems: "center", padding: "14px 22px", borderRadius: 12, background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)", marginBottom: 12, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
              <div>
                <div style={{ fontSize: 19, fontWeight: 700, color: INK }}>{s.k}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.2, color: GREY, marginTop: 3 }}>SFA 04-N13 {s.r}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 17, color: INK2 }}>{s.f}</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: INK, textAlign: "right" }}>{s.v}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 1320, top: 190, width: 540, padding: "28px 30px", borderRadius: 16, background: INK, color: "#fff", opacity: ratio, transform: `scale(${0.96 + ratio * 0.04})` }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, color: "#9a9a9a" }}>FR / TRR × 100%</div>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, marginTop: 6 }}>1,143%</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: GREEN }} />
          <span style={{ fontSize: 18 }}>Above 120%. No notification due.</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 1.5, color: "#9a9a9a", marginTop: 14 }}>SFA 04-N13 para 3.1.1 · Regulations 6 and 7</div>
      </div>
      <Cap at={8}>Form 2 by SFA 04-N13. Not by a macro.</Cap>
      <Day n={1} good />
    </Stage>
  );
};

/** 9 · Step 4: ties to the ledger, explains every jump. */
const Checks: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    ["Form 1 total current assets = GL current assets", "5,603,685 = 5,603,685", true],
    ["Form 1 balances: assets = liabilities + shareholders' funds", "✓", true],
    ["Form 2 base capital = Form 1 paid-up capital + unappropriated profit", "✓", true],
    ["Own balances exclude client money held in trust", "✓ · trust account 7xx excluded", true],
    ["Other current assets vs Q2", "+38% · prepaid insurance S$61,400 · NAV pack p.31, row 212", false],
  ];
  return (
    <Stage>
      <Mark />
      <DayBar from={1} to={1} good label="DAY 1" />
      <StepTag n={4} text="Checks before you do" />
      <div style={{ position: "absolute", left: 60, top: 190, width: 1800 }}>
        {rows.map(([k, v, ok], i) => {
          const p = pIn(frame, 8 + i * 9, 12);
          return (
            <div key={String(k)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px", gap: 20, alignItems: "center", padding: "18px 24px", borderRadius: 12, background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)", marginBottom: 12, opacity: p, borderLeft: ok ? "4px solid transparent" : `4px solid #d97706` }}>
              <div style={{ fontSize: 21, fontWeight: 600, color: INK }}>{k}</div>
              <div style={{ fontFamily: MONO, fontSize: 17, color: ok ? INK2 : "#b45309" }}>{v}</div>
              <div style={{ textAlign: "right", fontSize: 22, fontWeight: 800, color: ok ? GREEN : "#d97706" }}>{ok ? "✓" : "?"}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 690, fontSize: 22, color: INK2, opacity: pIn(frame, 60, 12) }}>
        Four checks pass. One jump explained with its source row. <b style={{ color: INK }}>You decide whether it stays.</b>
      </div>
      <Cap at={8}>Ties to the ledger. Explains every jump.</Cap>
      <Day n={1} good />
    </Stage>
  );
};

/** 10 · Step 5: MAS's own form, filled, every cell with its source. */
const Filled: React.FC = () => {
  const frame = useCurrentFrame();
  const f1: [string, string?, boolean?][] = [
    ["ASSETS · CURRENT ASSETS", undefined, true],
    ["(5) Trade debtors for fund management", "912,415"],
    ["(7) Securities and units in a CIS · (c) others", "—"],
    ["(9) Deposits with banks and cash balances · (b) own", "4,478,800"],
    ["(13) Other current assets", "212,470"],
    ["Total Current Assets", "5,603,685"],
  ];
  const f2: [string, string?, boolean?][] = [
    ["(II) FINANCIAL RESOURCES", undefined, true],
    ["Financial Resources (\"FR\")", "3,200,118"],
    ["(III) TOTAL RISK REQUIREMENT", undefined, true],
    ["(A) Operational risk requirement", "279,950"],
    ["Total Risk Requirement (\"TRR\")", "279,950"],
    ["FR/TRR Ratio", "1,143%"],
  ];
  const btn = pIn(frame, 64, 12);
  return (
    <Stage>
      <Mark />
      <DayBar from={1} to={1} good label="DAY 1" />
      <StepTag n={5} text="Fills MAS's form" />
      <FormDoc x={150} y={180} w={790} h={360} title="Form 1 · Statement of Assets and Liabilities" sub="quarter ended 30 Sep 2026 · S$ · every cell carries its source row" rows={f1} at={4} hiAt={30} />
      <FormDoc x={980} y={180} w={790} h={360} title="Form 2 · Financial Resources, TRR, Aggregate Indebtedness" sub="quarter ended 30 Sep 2026 · S$" rows={f2} at={12} hiAt={38} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 600, display: "flex", justifyContent: "center", gap: 14, opacity: btn }}>
        <span style={{ padding: "12px 24px", borderRadius: 999, background: BRAND, color: "#fff", fontSize: 19, fontWeight: 700 }}>Export for MAS-Tx</span>
        <span style={{ padding: "12px 24px", borderRadius: 999, background: "#f1f1f1", color: INK2, fontSize: 19, fontWeight: 600 }}>Working file with sources · .xlsx</span>
      </div>
      <Cap at={8}>MAS's form, filled. Day 1.</Cap>
      <Day n={1} good />
    </Stage>
  );
};

/** 11 · Thirteen days to spare. */
const Spare: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <Mark />
      <DayBar from={1} to={1} good label="LODGED" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "20px 34px", borderRadius: 999, background: INK, color: "#fff", fontSize: 28, fontWeight: 700, opacity: pIn(frame, 4, 14) }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: GREEN }} />
          Reviewed by Mei Lin · Signed by David Tan · Lodged on MAS-Tx · 1 Oct, 11:20
        </div>
        <div style={{ marginTop: 44, display: "flex", justifyContent: "center", gap: 14, opacity: pIn(frame, 30, 14) }}>
          {["Annual Forms 1–6 · same engine", "VCFM Form 25A · same engine", "FSS 업무보고서 · already live"].map((x) => (
            <span key={x} style={{ padding: "10px 18px", borderRadius: 999, background: "#f1f1f1", fontSize: 18, color: INK2 }}>{x}</span>
          ))}
        </div>
      </div>
      <Cap at={10}>
        Review. Lodge. <span style={{ color: BRAND }}>Thirteen days to spare.</span>
      </Cap>
      <Day n={1} good />
    </Stage>
  );
};

/** 12 · End card — TREASURER wordmark, like the FSS film's outro, in the white look. */
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const mark = pIn(frame, 0, 18), word = pIn(frame, 6, 24), rule = pIn(frame, 26, 22), tag = pIn(frame, 34, 20), site = pIn(frame, 48, 20);
  return (
    <Stage>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26 }}>
            <span style={{ width: 26, height: 26, background: BRAND, transform: `rotate(${45 + (1 - mark) * 135}deg) scale(${0.3 + mark * 0.7})`, opacity: mark }} />
            <span style={{ fontFamily: MONO, fontSize: 58, fontWeight: 700, letterSpacing: 8 + word * 18, color: INK, opacity: word, whiteSpace: "nowrap" }}>TREASURER</span>
          </div>
          <div style={{ margin: "30px auto 0", width: rule * 180, height: 2, background: BRAND }} />
          <div style={{ marginTop: 30, fontSize: 30, fontWeight: 600, letterSpacing: -1, color: INK, opacity: tag }}>MAS returns, collected to lodged.</div>
          <div style={{ marginTop: 12, fontSize: 20, color: GREY, opacity: tag }}>Form 1 · Form 2 · every cell traced to its source row</div>
          <div style={{ marginTop: 34, fontFamily: MONO, fontSize: 22, letterSpacing: 4, color: INK2, opacity: site }}>treasurer.net</div>
        </div>
      </div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ cut */

type S = { id: string; dur: number; body: React.FC };

export const MASRET_SCENES: S[] = [
  { id: "quarter-end", dur: 3.4, body: QuarterEnd },
  { id: "what-mas-asks", dur: 4.0, body: WhatMasAsks },
  { id: "files", dur: 4.0, body: Files },
  { id: "day12", dur: 3.4, body: Day12 },
  { id: "reset", dur: 2.4, body: Reset },
  { id: "reads", dur: 3.6, body: ReadsForm },
  { id: "maps", dur: 3.6, body: MapsAccounts },
  { id: "computes", dur: 4.0, body: Computes },
  { id: "checks", dur: 3.6, body: Checks },
  { id: "filled", dur: 3.8, body: Filled },
  { id: "spare", dur: 3.0, body: Spare },
  { id: "end", dur: 3.2, body: End },
];

const frames = (s: S) => Math.round(s.dur * FPS);
export const MASRET_FRAMES = MASRET_SCENES.reduce((a, s, i) => a + frames(s) - (i > 0 ? CUT : 0), 0);

export const MasReturns: React.FC = () => (
  <AbsoluteFill style={{ background: "#fff", fontFamily: SANS }}>
    <TransitionSeries>
      {MASRET_SCENES.flatMap((s, i) => {
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
