/**
 * "MAS returns, Day 1" — v4, simplified. ~37s. One big line and one picture per scene, no footnote chips.
 * Order: what MAS is → who files → what they file → the stakes → two problems → Core → four fixes → Day 1 → CTA.
 * Core branding (team decision). Facts: see README "MasFinal". Names, invoices and numbers are illustrative.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Lockup, OMark } from "./Lockup";
import { BLUE, Cap, GREEN, GREY, GREY2, INK, INK2, LINE, MONO, RED, SANS, Stage, Win, pIn, lin } from "./mas-core";

const FPS = 30;
const CUT = 8;

/* ------------------------------------------------------------------ bits */

const CoreMark: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = INK }) => (
  <span style={{ display: "inline-flex", alignItems: "center", fontWeight: 500, fontSize: size, letterSpacing: size * 0.3, paddingLeft: size * 0.3, color, lineHeight: 1 }}>
    C<span style={{ display: "inline-block", margin: `0 ${size * 0.3}px 0 ${-size * 0.08}px`, marginTop: size * 0.05 }}><OMark size={size * 0.78} color={color} /></span>RE
  </span>
);

const Corner: React.FC = () => (
  <div style={{ position: "absolute", top: 44, left: 60, display: "flex", alignItems: "center", gap: 12 }}>
    <CoreMark size={22} color={INK2} />
    <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, color: GREY }}>BY TREASURER</span>
  </div>
);

/** 14-day bar, used in two scenes only. */
const DayBar: React.FC<{ day: number; good?: boolean }> = ({ day, good }) => {
  const frame = useCurrentFrame();
  const X0 = 360, W = 1200, CW = W / 14;
  const col = good ? BLUE : RED;
  const d = lin(frame, 10, 50, 0, day);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 150, height: 80, opacity: pIn(frame, 4, 10) }}>
      <div style={{ position: "absolute", left: X0 - 200, top: 10, width: 180, textAlign: "right", fontSize: 18, color: INK2, fontWeight: 600 }}>Quarter ends<br /><span style={{ color: GREY, fontWeight: 400 }}>30 Sep</span></div>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: X0 + i * CW, top: 24, width: CW - 5, height: 18, borderRadius: 5, background: "#ececec", overflow: "hidden" }}>
          <div style={{ width: `${Math.max(0, Math.min(1, d - i)) * 100}%`, height: "100%", background: col }} />
        </div>
      ))}
      <div style={{ position: "absolute", left: X0 + W + 20, top: 10, width: 200, fontSize: 18, color: INK2, fontWeight: 600 }}>Due on MAS-Tx<br /><span style={{ color: GREY, fontWeight: 400 }}>14 Oct</span></div>
      <div style={{ position: "absolute", left: X0 + Math.min(14, d) * CW - 44, top: 56, width: 88, textAlign: "center", fontSize: 15, fontWeight: 800, color: col }}>DAY {Math.max(1, Math.ceil(d))}</div>
    </div>
  );
};

/** Plain document card with a few rows. */
const Doc: React.FC<{ x: number; y: number; w: number; title: string; sub: string; rows: [string, string][]; at: number; fillAt?: number }> = ({ x, y, w, title, sub, rows, at, fillAt = 9999 }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, at, 14);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, background: "#fff", borderRadius: 14, boxShadow: "0 18px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", padding: "26px 30px 22px", opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: INK, letterSpacing: -0.6 }}>{title}</div>
      <div style={{ fontSize: 16, color: GREY, marginTop: 4 }}>{sub}</div>
      <div style={{ marginTop: 16 }}>
        {rows.map(([k, v], i) => {
          const f = pIn(frame, fillAt + i * 6, 8);
          return (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : "none", fontSize: 18, color: INK2 }}>
              <span>{k}</span>
              <span style={{ fontFamily: MONO, fontSize: 18, color: f > 0 ? BLUE : GREY2, fontWeight: 700, opacity: fillAt < 9999 ? 0.3 + 0.7 * f : 1 }}>{fillAt < 9999 ? (f > 0.5 ? v : "—") : v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ scenes */

/** 1 · What MAS is. */
const WhatIsMas: React.FC = () => {
  const frame = useCurrentFrame();
  const chips = ["Banks", "Insurers", "Fund managers"];
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 200, textAlign: "center", opacity: pIn(frame, 2, 14) }}>
        <div style={{ fontSize: 24, letterSpacing: 6, color: GREY, fontFamily: MONO }}>SINGAPORE</div>
        <div style={{ fontSize: 86, fontWeight: 800, letterSpacing: -3.5, color: INK, marginTop: 12 }}>Monetary Authority of Singapore</div>
        <div style={{ fontSize: 30, color: INK2, marginTop: 14 }}>Singapore's central bank and financial regulator. It licenses:</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 480, display: "flex", justifyContent: "center", gap: 22 }}>
        {chips.map((c, i) => {
          const p = pIn(frame, 24 + i * 8, 12);
          const hi = i === 2;
          return (
            <div key={c} style={{ padding: "18px 34px", borderRadius: 999, fontSize: 30, fontWeight: 700, background: hi ? INK : "#f1f1f1", color: hi ? "#fff" : INK2, opacity: p, transform: `scale(${0.9 + p * 0.1})` }}>{c}</div>
          );
        })}
      </div>
      <Cap at={40} size={70}>MAS regulates every fund manager in Singapore.</Cap>
    </Stage>
  );
};

/** 2 · Who files. */
const WhoFiles: React.FC = () => {
  const frame = useCurrentFrame();
  const firms = ["VC fund", "Private equity", "Hedge fund"];
  return (
    <Stage>
      {firms.map((f, i) => {
        const p = pIn(frame, 4 + i * 7, 12);
        const y = 190 + i * 150;
        return (
          <React.Fragment key={f}>
            <div style={{ position: "absolute", left: 300, top: y, width: 520, padding: "24px 30px", borderRadius: 14, background: "#fff", boxShadow: "0 14px 44px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: p, transform: `translateX(${(1 - p) * -20}px)` }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: INK }}>{f}</span>
              <span style={{ fontSize: 15, fontFamily: MONO, letterSpacing: 2, color: GREY }}>LICENSED BY MAS</span>
            </div>
            <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
              <path d={`M 830 ${y + 46} C 950 ${y + 46}, 950 410, 1080 410`} stroke="#cfcfcf" strokeWidth={2} fill="none" strokeDasharray={500} strokeDashoffset={500 * (1 - pIn(frame, 14 + i * 7, 16))} />
            </svg>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 1080, top: 330, width: 520, padding: "30px 34px", borderRadius: 16, background: INK, color: "#fff", opacity: pIn(frame, 30, 14) }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: "#9a9a9a" }}>MAS-TX · RETURNS PORTAL</div>
        <div style={{ fontSize: 34, fontWeight: 800, marginTop: 8 }}>Quarterly returns</div>
        <div style={{ fontSize: 18, color: "#c9c9c9", marginTop: 10, lineHeight: 1.4 }}>Since Aug 2024, every licensed manager files them. Many for the first time.</div>
      </div>
      <Cap at={36} size={72}>If you manage money here, you file.</Cap>
    </Stage>
  );
};

/** 3 · What they file: two forms, 14 days. */
const TwoForms: React.FC = () => (
  <Stage>
    <DayBar day={0} />
    <Doc x={300} y={290} w={620} title="Form 1" sub="Your firm's balance sheet" rows={[["Cash and bank balances", ""], ["Fees receivable from your funds", ""], ["Other assets · liabilities · capital", ""]]} at={10} />
    <Doc x={1000} y={290} w={620} title="Form 2" sub="Your capital test" rows={[["Financial resources", ""], ["Operational risk requirement", ""], ["Ratio — must stay above 120%", ""]]} at={20} />
    <Cap at={30} size={72}>Two forms. 14 days after quarter end.</Cap>
  </Stage>
);

/** 4 · The stakes (black). */
const Stakes: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 4, 14);
  return (
    <Stage dark>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: a }}>
        <div>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3.5, color: "#fff" }}>
            July 2025. <span style={{ color: RED }}>A licence revoked.</span>
          </div>
          <div style={{ fontSize: 32, color: "#b5b5b5", marginTop: 22 }}>Among the reasons: quarterly returns not filed.</div>
          <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: 2, color: "#6a6a6a", marginTop: 28 }}>mas.gov.sg · enforcement actions</div>
        </div>
      </div>
    </Stage>
  );
};

/** 5 · Problem 1: you pay a consultant, you still do the work. */
const Consultant: React.FC = () => {
  const frame = useCurrentFrame();
  const qs = ["Which year's revenue goes into the average?", "Is the prepaid rent a deduction?", "Is the USD account the firm's own money?", "Did you declare a dividend this quarter?", "Send the fund admin's NAV pack again."];
  return (
    <Stage>
      <Win x={200} y={150} w={620} h={420} title="invoice · compliance consultant" at={4}>
        <div style={{ padding: "26px 28px" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2.5, color: GREY }}>INVOICE · Q3 2026</div>
          <div style={{ fontSize: 22, color: INK2, marginTop: 14 }}>Preparation of MAS quarterly returns</div>
          <div style={{ fontSize: 18, color: GREY, marginTop: 4 }}>Form 1 · Form 2 · MAS-Tx submission</div>
          <div style={{ fontSize: 64, fontWeight: 800, color: INK, marginTop: 24, letterSpacing: -2 }}>S$4,500</div>
          <div style={{ fontSize: 16, color: GREY }}>per quarter · illustrative</div>
        </div>
      </Win>
      <Win x={880} y={110} w={840} h={520} title="mail · 7 questions before we can file" at={14}>
        {qs.map((q, i) => (
          <div key={q} style={{ display: "flex", gap: 14, alignItems: "center", padding: "16px 24px", borderBottom: `1px solid ${LINE}`, fontSize: 21, color: INK2, opacity: pIn(frame, 22 + i * 6, 10) }}>
            <span style={{ width: 30, height: 30, borderRadius: 999, background: "#f1f1f1", fontSize: 14, fontWeight: 700, color: INK2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
            {q}
          </div>
        ))}
      </Win>
      <Cap at={34} size={66}>You pay a consultant. You still answer the questions.</Cap>
    </Stage>
  );
};

/** 6 · Problem 2: the capital test lives in one spreadsheet. */
const Spreadsheet: React.FC = () => {
  const frame = useCurrentFrame();
  const blink = 0.5 + 0.5 * Math.abs(Math.sin(frame / 6));
  const rows: [string, string, boolean][] = [["Financial resources", "3,200,118", false], ["Operational risk requirement", "=MAX(0.05*AVERAGE('FY23'!R9, …", false], ["Ratio", "#REF!", true], ["Above 120%?", "#REF!", true]];
  return (
    <Stage>
      <Win x={300} y={130} w={1320} h={480} title="Q3_capital_test_v9_Priya.xlsx — personal" at={2} tint="#e8f5e9">
        {rows.map(([a, b, bad], i) => (
          <div key={a} style={{ display: "grid", gridTemplateColumns: "1fr 560px", alignItems: "center", padding: "0 28px", height: 104, borderBottom: `1px solid ${LINE}`, fontSize: 26, color: INK2, background: bad ? `rgba(216,35,42,${0.04 + blink * 0.05})` : "transparent", opacity: pIn(frame, 6 + i * 6, 10) }}>
            <span style={{ fontWeight: i >= 2 ? 700 : 500 }}>{a}</span>
            <span style={{ fontFamily: MONO, textAlign: "right", color: bad ? RED : INK, fontWeight: bad ? 800 : 500, fontSize: bad ? 30 : 22, whiteSpace: "nowrap", overflow: "hidden" }}>{b}</span>
          </div>
        ))}
      </Win>
      <div style={{ position: "absolute", left: 300, top: 640, fontSize: 24, color: INK2, opacity: pIn(frame, 40, 12) }}>One person built it. She is on leave until the 15th.</div>
      <Cap at={10} size={70}>The capital test lives in one spreadsheet.</Cap>
    </Stage>
  );
};

/** 7 · Core card. */
const MeetCore: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 4, 14);
  return (
    <Stage dark>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30, opacity: a, transform: `scale(${0.96 + a * 0.04})` }}>
        <CoreMark size={140} color="#fff" />
        <div style={{ fontSize: 34, color: "#c9c9c9" }}>by Treasurer · does the returns for you</div>
      </div>
    </Stage>
  );
};

/** 8 · Core reads your files and fills MAS's forms. */
const Fills: React.FC = () => {
  const frame = useCurrentFrame();
  const files = ["Your ledger", "Bank statements", "Fund admin's NAV pack"];
  return (
    <Stage>
      <Corner />
      {files.map((f, i) => {
        const p = pIn(frame, 4 + i * 6, 12);
        const y = 250 + i * 120;
        return (
          <React.Fragment key={f}>
            <div style={{ position: "absolute", left: 120, top: y, width: 380, padding: "20px 26px", borderRadius: 14, background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.06)", fontSize: 24, fontWeight: 700, color: INK, opacity: p }}>{f}</div>
            <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
              <path d={`M 500 ${y + 36} C 600 ${y + 36}, 600 420, 700 420`} stroke={BLUE} strokeWidth={2.5} fill="none" strokeDasharray={400} strokeDashoffset={400 * (1 - pIn(frame, 16 + i * 6, 16))} opacity={0.6} />
            </svg>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 700, top: 365, width: 110, height: 110, borderRadius: 999, background: INK, display: "flex", alignItems: "center", justifyContent: "center", opacity: pIn(frame, 26, 12) }}>
        <CoreMark size={24} color="#fff" />
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d="M 810 420 L 900 420" stroke={BLUE} strokeWidth={2.5} strokeDasharray={100} strokeDashoffset={100 * (1 - pIn(frame, 36, 10))} opacity={0.6} />
      </svg>
      <Doc x={920} y={200} w={420} title="Form 1" sub="Balance sheet" rows={[["Cash and bank balances", "4,478,800"], ["Fees receivable", "912,415"], ["Total assets", "5,603,685"]]} at={30} fillAt={44} />
      <Doc x={1370} y={200} w={420} title="Form 2" sub="Capital test" rows={[["Financial resources", "3,200,118"], ["Risk requirement", "279,950"], ["Ratio", "1,143%"]]} at={36} fillAt={56} />
      <Cap at={10} size={72}>Reads your files. Fills MAS's forms.</Cap>
    </Stage>
  );
};

/** 9 · The capital test, by MAS's rule, in three lines. */
const CapitalTest: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    ["3-year average income", "5,599,000"],
    ["× 5%  (MAS's rule, floor S$100,000)", "279,950"],
    ["Your capital ÷ that", "1,143%"],
  ];
  const ok = pIn(frame, 60, 12);
  return (
    <Stage>
      <Corner />
      <div style={{ position: "absolute", left: 260, top: 170, width: 1400 }}>
        {rows.map(([k, v], i) => {
          const p = pIn(frame, 8 + i * 14, 14);
          return (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "26px 36px", borderRadius: 16, background: "#fff", boxShadow: "0 14px 44px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.06)", marginBottom: 16, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
              <span style={{ fontSize: 32, fontWeight: 600, color: INK2 }}>{k}</span>
              <span style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800, color: i === 2 ? BLUE : INK }}>{v}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, fontSize: 28, color: INK, opacity: ok }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>✓</span>
          Above 120%. Nothing to notify.
        </div>
      </div>
      <Cap at={10} size={70}>Runs the capital test by MAS's rule.</Cap>
    </Stage>
  );
};

/** 10 · Watches the ratio every month. */
const Monitor: React.FC = () => {
  const frame = useCurrentFrame();
  const pts = [1143, 1080, 990, 870, 760, 640, 520, 410, 330, 260, 190, 150];
  const X0 = 300, Y0 = 560, W = 1320, H = 340;
  const ymax = 1200;
  const draw = pIn(frame, 8, 60);
  const n = Math.max(1, Math.floor(draw * pts.length));
  const path = pts.slice(0, n).map((v, i) => `${i === 0 ? "M" : "L"} ${X0 + (i / 11) * W} ${Y0 - (v / ymax) * H}`).join(" ");
  const y120 = Y0 - (120 / ymax) * H;
  const alert = pIn(frame, 56, 12);
  return (
    <Stage>
      <Corner />
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        <line x1={X0} y1={y120} x2={X0 + W} y2={y120} stroke={RED} strokeWidth={2} strokeDasharray="10 8" />
        <text x={X0 + W} y={y120 - 10} textAnchor="end" fontFamily={MONO} fontSize={15} fill={RED} letterSpacing={2}>120% — MUST NOTIFY MAS</text>
        <path d={path} stroke={BLUE} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.slice(0, n).map((v, i) => (
          <circle key={i} cx={X0 + (i / 11) * W} cy={Y0 - (v / ymax) * H} r={6} fill={BLUE} />
        ))}
        {["Oct", "Jan", "Apr", "Jul", "Sep"].map((m, i) => (
          <text key={m} x={X0 + (i / 4) * W} y={Y0 + 34} textAnchor="middle" fontFamily={MONO} fontSize={14} fill={GREY} letterSpacing={2}>{m.toUpperCase()}</text>
        ))}
      </svg>
      <div style={{ position: "absolute", left: 1100, top: 300, width: 560, padding: "20px 24px", borderRadius: 14, background: INK, color: "#fff", opacity: alert, transform: `translateY(${(1 - alert) * 12}px)` }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, color: "#9a9a9a" }}>CORE · ALERT · 3 MONTHS EARLY</div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, lineHeight: 1.3 }}>Ratio heading toward 120% by September. Top up capital, or cut the dividend.</div>
      </div>
      <Cap at={10} size={70}>Watches it every month. Warns before 120%.</Cap>
    </Stage>
  );
};

/** 11 · Same way for the annual pack and Form 25A. */
const Annual: React.FC = () => {
  const frame = useCurrentFrame();
  const items = [["Every quarter", "Form 1 · Form 2"], ["Every year", "Forms 1–6, audited"], ["VC fund managers", "Form 25A"]];
  return (
    <Stage>
      <Corner />
      <div style={{ position: "absolute", left: 0, right: 0, top: 260, display: "flex", justifyContent: "center", gap: 26 }}>
        {items.map(([k, v], i) => {
          const p = pIn(frame, 6 + i * 10, 14);
          return (
            <div key={k} style={{ width: 460, padding: "34px 36px", borderRadius: 18, background: "#fff", boxShadow: "0 18px 60px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)", opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 3, color: GREY }}>{k.toUpperCase()}</div>
              <div style={{ fontSize: 38, fontWeight: 800, color: INK, marginTop: 10, letterSpacing: -1 }}>{v}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, fontSize: 18, color: GREEN, fontWeight: 700, opacity: pIn(frame, 30 + i * 8, 10) }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: GREEN, color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                Same mapping
              </div>
            </div>
          );
        })}
      </div>
      <Cap at={12} size={72}>Annual pack and Form 25A, the same way.</Cap>
    </Stage>
  );
};

/** 12 · Day 1. */
const DayOne: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <Corner />
      <DayBar day={1} good />
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "22px 36px", borderRadius: 999, background: INK, color: "#fff", fontSize: 30, fontWeight: 700, opacity: pIn(frame, 20, 14) }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: GREEN }} />
          Reviewed · Signed · Submitted on MAS-Tx · 1 Oct
        </div>
        <div style={{ fontSize: 26, color: GREY, marginTop: 24, opacity: pIn(frame, 36, 12) }}>Thirteen days early. Every number traced to its source.</div>
      </div>
      <Cap at={10} size={74}>Submitted on Day 1. You review, you sign.</Cap>
    </Stage>
  );
};

/** 13 · CTA. */
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 2, 14), b = pIn(frame, 16, 14), c = pIn(frame, 30, 12);
  return (
    <Stage>
      <div style={{ position: "absolute", left: "50%", top: 250, transform: `translateX(-50%) scale(${0.94 + a * 0.06})`, opacity: a }}>
        <Lockup size={100} color={INK} subColor="#5c5c5c" dot={BLUE} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontSize: 34, fontWeight: 700, color: INK, opacity: b, padding: "0 200px", lineHeight: 1.35 }}>
        Send us last quarter's Form 1, Form 2 and your trial balance.
        <br />
        <span style={{ color: BLUE }}>We send them back filled, in a day.</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 720, display: "flex", justifyContent: "center", opacity: c }}>
        <span style={{ padding: "16px 32px", borderRadius: 999, background: INK, color: "#fff", fontSize: 22, fontWeight: 700 }}>Request a demo →</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", fontFamily: MONO, fontSize: 16, letterSpacing: 3, color: GREY, opacity: c }}>treasurer.net/core</div>
    </Stage>
  );
};

/* ------------------------------------------------------------------ cut */

type S = { id: string; dur: number; body: React.FC };

export const MASFINAL_SCENES: S[] = [
  { id: "what-is-mas", dur: 3.4, body: WhatIsMas },
  { id: "who-files", dur: 3.4, body: WhoFiles },
  { id: "two-forms", dur: 3.4, body: TwoForms },
  { id: "stakes", dur: 3.0, body: Stakes },
  { id: "consultant", dur: 3.8, body: Consultant },
  { id: "spreadsheet", dur: 3.2, body: Spreadsheet },
  { id: "meet-core", dur: 1.8, body: MeetCore },
  { id: "fills", dur: 3.8, body: Fills },
  { id: "capital-test", dur: 3.6, body: CapitalTest },
  { id: "monitor", dur: 3.6, body: Monitor },
  { id: "annual", dur: 2.8, body: Annual },
  { id: "day-one", dur: 2.8, body: DayOne },
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
