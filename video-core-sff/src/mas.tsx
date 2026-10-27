/**
 * "Your MAS returns, done in minutes" — 30s back-office film for Singapore fund managers (LinkedIn / YouTube).
 * The Singapore counterpart of the Korean FSS film (video-wooricard-fss): same house look — dark navy stage
 * with a faint blue grid, mono kickers, Pretendard headlines, a four-step flow bar — but in English and
 * personalised to MAS: the forms, the deadlines and the portals are the real ones.
 *
 * Facts on screen (mas.gov.sg, checked 27 Oct 2026):
 *   Form 1 (Statement of Assets and Liabilities) and Form 2 (Financial Resources, Total Risk Requirement and
 *   Aggregate Indebtedness) — CMS licensees, quarterly within 14 days of quarter end, annually within 5 months
 *   of FYE, lodged via MASNET.  Form 25A — venture capital fund managers, annual declaration within one month
 *   of FYE, via MAS-Tx.  July 2025: MAS revoked a CMS licence, citing among other breaches quarterly returns
 *   not submitted for FY2024 and the quarter ended 31 Mar 2025.
 * Numbers in the CHECK table are illustrative. "2 hours → 2 minutes" is the team's own claim.
 */
import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { TransitionKind } from "./timeline";
import { presentationFor } from "./transitions";
import { CaptionTiming } from "./ui";

const FPS = 30;
const SANS = "Pretendard, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'JetBrains Mono', Consolas, 'Courier New', monospace";
const SAFE = 128;

/* house palette, lifted from video-wooricard-fss/src/theme.ts */
const K = {
  dark: "#0d1526",
  darkDeep: "#080e1c",
  onDark: "#e8eef7",
  onDark2: "#8ea0bd",
  onDark3: "#4a5b78",
  line: "rgba(148,163,184,0.14)",
  line2: "rgba(148,163,184,0.26)",
  brand: "#3b82f6",
  brandLite: "#60a5fa",
  brandSoft: "rgba(59,130,246,0.08)",
  emerald: "#34d399",
  red: "#f87171",
  redInk: "#b3261e",
  paper: "#f2f5f9",
  ink: "#0f172a",
  ink2: "#334155",
  ink3: "#64748b",
  ink4: "#94a3b8",
  paperLine: "#e2e8f0",
};

const EASE = Easing.bezier(0.22, 1, 0.32, 1);
const pIn = (frame: number, delay = 0, duration = 22) =>
  interpolate(frame - delay, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

const TR: Record<TransitionKind, number> = { fade: 12, goldwipe: 11, slide: 10, slideup: 10, wipe: 10 };

/* ------------------------------------------------------------------ chrome */

/** Dark navy stage with a faint blue grid and a slow blue glow. */
const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 240) * 40;
  return (
    <AbsoluteFill style={{ background: K.dark, overflow: "hidden", fontFamily: SANS }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${K.brandSoft} 1px, transparent 1px), linear-gradient(90deg, ${K.brandSoft} 1px, transparent 1px)`,
          backgroundSize: "88px 88px",
          opacity: 0.85,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 760px at ${16 + drift / 20}% -8%, rgba(59,130,246,0.20), transparent 62%),
                       radial-gradient(900px 620px at 94% 108%, rgba(52,211,153,0.08), transparent 60%),
                       linear-gradient(180deg, rgba(13,21,38,0) 0%, rgba(8,14,28,0.7) 100%)`,
        }}
      />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 280px 80px rgba(3,7,18,0.55)" }} />
      {children}
    </AbsoluteFill>
  );
};

/** Singapore b-roll behind a scene, graded down so type reads on top. */
const Broll: React.FC<{ src: string; opacity?: number; zoom?: number; grade?: string; from?: number }> = ({ src, opacity = 0.3, zoom = 0.1, grade = "saturate(0.35) brightness(0.85) contrast(1.08)", from = 0 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 200], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={from}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.04 + p * zoom})`, filter: grade }}
      />
    </AbsoluteFill>
  );
};

const BrandMark: React.FC<{ tone?: "dark" | "light" }> = ({ tone = "dark" }) => (
  <div style={{ position: "absolute", top: 54, left: SAFE, display: "flex", alignItems: "center", gap: 11 }}>
    <span style={{ width: 12, height: 12, background: K.brand, transform: "rotate(45deg)" }} />
    <span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700, letterSpacing: 5, color: tone === "dark" ? K.onDark2 : K.ink3 }}>TREASURER</span>
  </div>
);

const STAGES = ["Collect", "Map", "Check", "Lodge"];

/** Progress strip at the top of each step scene: four stages of one workflow. */
const FlowBar: React.FC<{ active: number; delay?: number; tone?: "dark" | "light" }> = ({ active, delay = 0, tone = "dark" }) => {
  const frame = useCurrentFrame();
  const dim = tone === "dark" ? K.onDark3 : K.ink4;
  const mid = tone === "dark" ? K.onDark2 : K.ink3;
  const strong = tone === "dark" ? K.onDark : K.ink;
  const line = tone === "dark" ? K.line : K.paperLine;
  const hi = tone === "dark" ? K.brandLite : K.brand;
  return (
    <div style={{ position: "absolute", left: SAFE, top: 128, display: "flex", alignItems: "center", gap: 14, opacity: pIn(frame, delay, 14) }}>
      {STAGES.map((s, i) => {
        const on = i === active;
        const done = i < active;
        return (
          <React.Fragment key={s}>
            {i > 0 ? <span style={{ fontFamily: MONO, fontSize: 15, color: done || on ? hi : dim }}>→</span> : null}
            <span style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${on ? "rgba(59,130,246,0.6)" : line}`, background: on ? "rgba(59,130,246,0.14)" : "transparent", borderRadius: 4, padding: "8px 14px 9px" }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 1.6, color: on ? hi : dim }}>0{i + 1}</span>
              <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.5, color: on ? strong : done ? mid : dim }}>{s}</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Step: React.FC<{ n: string; tone?: "dark" | "light"; delay?: number }> = ({ n, tone = "dark", delay = 2 }) => {
  const frame = useCurrentFrame();
  return <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, letterSpacing: 5, color: tone === "dark" ? K.brandLite : K.brand, opacity: pIn(frame, delay, 12) }}>{n}</div>;
};

const Head: React.FC<{ children: React.ReactNode; size?: number; tone?: "dark" | "light"; delay?: number; style?: React.CSSProperties }> = ({ children, size = 58, tone = "dark", delay = 8, style }) => {
  const frame = useCurrentFrame();
  const p = pIn(frame, delay, 18);
  return (
    <div style={{ marginTop: 24, fontSize: size, fontWeight: 700, letterSpacing: -size * 0.055, lineHeight: 1.12, color: tone === "dark" ? K.onDark : K.ink, opacity: p, transform: `translateY(${(1 - p) * 16}px)`, ...style }}>
      {children}
    </div>
  );
};

const Sub: React.FC<{ children: React.ReactNode; delay: number; tone?: "dark" | "light"; size?: number; style?: React.CSSProperties }> = ({ children, delay, tone = "dark", size = 26, style }) => {
  const frame = useCurrentFrame();
  return <div style={{ marginTop: 30, fontSize: size, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.45, color: tone === "dark" ? K.onDark2 : K.ink3, opacity: pIn(frame, delay, 16), ...style }}>{children}</div>;
};

/** Small emerald mono line at the bottom-left, the "so what" of a step. */
const Footline: React.FC<{ text: string; delay: number; tone?: "dark" | "light" }> = ({ text, delay, tone = "dark" }) => {
  const frame = useCurrentFrame();
  const col = tone === "dark" ? K.emerald : "#047857";
  return (
    <div style={{ position: "absolute", left: SAFE, bottom: 110, display: "flex", alignItems: "center", gap: 14, opacity: pIn(frame, delay, 16) }}>
      <span style={{ width: 26, height: 1, background: col, opacity: 0.6 }} />
      <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, letterSpacing: 3, color: col, textTransform: "uppercase" }}>{text}</span>
    </div>
  );
};

/* ------------------------------------------------------------------ scenes */

type S = { id: string; dur: number; in?: TransitionKind; body: React.FC<{ t: CaptionTiming }>; mark?: boolean };

/** 1 · hook — Marina Bay at night, what this is and who it is for. */
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [0, 140], [1.06, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const tags = [
    { t: "Form 1 · Form 2", s: "MASNET · every quarter" },
    { t: "Form 25A", s: "MAS-Tx · every year" },
  ];
  return (
    <Stage>
      <Broll src="clips/sg-30570498.mp4" opacity={0.62} zoom={0.12} from={30} grade="saturate(0.5) brightness(1.0) contrast(1.05)" />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, rgba(8,14,28,0.18) 0%, rgba(8,14,28,0.78) 62%, rgba(8,14,28,0.94) 100%)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${push})` }}>
        <div style={{ textAlign: "center", marginTop: -40 }}>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, letterSpacing: 7, color: K.brandLite, opacity: pIn(frame, 2, 14) }}>SINGAPORE · MAS REGULATORY RETURNS</div>
          <div style={{ marginTop: 30, fontSize: 92, fontWeight: 700, letterSpacing: -4.6, lineHeight: 1.08, color: K.onDark, opacity: pIn(frame, 8, 18), transform: `translateY(${(1 - pIn(frame, 8, 18)) * 16}px)` }}>
            Your MAS returns,
            <br />
            <span style={{ color: K.brandLite }}>done in minutes.</span>
          </div>
          <div style={{ marginTop: 52, display: "flex", justifyContent: "center" }}>
            {tags.map((g, i) => {
              const p = pIn(frame, 44 + i * 9, 15);
              return (
                <React.Fragment key={g.t}>
                  {i > 0 ? <span style={{ width: 1, margin: "4px 50px", background: K.line2, opacity: p }} /> : null}
                  <div style={{ opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
                    <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1.2, color: K.onDark }}>{g.t}</div>
                    <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 16, letterSpacing: 1.6, color: K.onDark2 }}>{g.s}</div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ marginTop: 44, fontSize: 24, fontWeight: 500, color: K.onDark2, opacity: pIn(frame, 76, 16) }}>For fund managers licensed by MAS</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", right: SAFE, bottom: 60, fontFamily: MONO, fontSize: 14, letterSpacing: 1.4, color: "rgba(232,238,247,0.5)", opacity: pIn(frame, 20, 14) }}>Marina Bay, Singapore</div>
    </Stage>
  );
};

/** 2 · the clock — every quarter, 14 days. */
const Deadline: React.FC = () => {
  const frame = useCurrentFrame();
  const forms = [
    { n: "Form 1", t: "Statement of Assets and Liabilities" },
    { n: "Form 2", t: "Financial Resources · Total Risk Requirement · Aggregate Indebtedness" },
  ];
  const cal = pIn(frame, 30, 18);
  const arrow = pIn(frame, 52, 16);
  const warn = pIn(frame, 92, 16);
  return (
    <Stage>
      <div style={{ position: "absolute", left: SAFE, top: 190, width: 760 }}>
        <Step n="THE CLOCK" />
        <Head size={64}>
          Every quarter.
          <br />
          <span style={{ color: K.brandLite }}>14 days</span> after quarter end.
        </Head>
        <Sub delay={22}>Lodged on MASNET, by every CMS licensee — fund managers included.</Sub>
        <div style={{ marginTop: 36 }}>
          {forms.map((f, i) => {
            const p = pIn(frame, 40 + i * 12, 15);
            return (
              <div key={f.n} style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: i ? 16 : 0, opacity: p, transform: `translateX(${(1 - p) * 20}px)` }}>
                <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1.2, color: i === 1 ? K.brandLite : K.onDark, whiteSpace: "nowrap" }}>{f.n}</span>
                <span style={{ fontSize: 20, fontWeight: 500, color: K.onDark2, lineHeight: 1.3 }}>{f.t}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* calendar: quarter end → lodgement date */}
      <div style={{ position: "absolute", left: 1040, top: 250, display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ width: 300, border: `1px solid ${K.line2}`, background: "rgba(148,163,184,0.06)", borderRadius: 6, padding: "22px 26px 24px", opacity: cal, transform: `translateY(${(1 - cal) * 14}px)` }}>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: 2.6, color: K.onDark3 }}>QUARTER ENDS</div>
          <div style={{ marginTop: 10, fontSize: 44, fontWeight: 700, letterSpacing: -2, color: K.onDark }}>30 Sep</div>
        </div>
        <svg width={120} height={40} style={{ opacity: arrow }}>
          <line x1={0} y1={20} x2={arrow * 100} y2={20} stroke={K.brandLite} strokeWidth={2} />
          <polygon points={`${arrow * 100},12 ${arrow * 100 + 14},20 ${arrow * 100},28`} fill={K.brandLite} />
          <text x={50} y={10} textAnchor="middle" fontFamily={MONO} fontSize={13} fill={K.brandLite} letterSpacing={2}>14 DAYS</text>
        </svg>
        <div style={{ width: 300, border: `2px solid ${K.brand}`, background: "rgba(59,130,246,0.14)", borderRadius: 6, padding: "22px 26px 24px", opacity: pIn(frame, 62, 16), boxShadow: `0 0 ${24 + pIn(frame, 66, 20) * 30}px rgba(59,130,246,0.35)` }}>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: 2.6, color: K.brandLite }}>LODGE BY</div>
          <div style={{ marginTop: 10, fontSize: 44, fontWeight: 700, letterSpacing: -2, color: K.onDark }}>14 Oct</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 1040, top: 420, width: 748, fontFamily: MONO, fontSize: 16, lineHeight: 1.8, letterSpacing: 1.2, color: K.onDark2, opacity: pIn(frame, 76, 16) }}>
        Annual: Forms 1–6 within 5 months of FYE · Audited
        <br />
        VCFM: Form 25A within 1 month of FYE · MAS-Tx
      </div>

      {/* the stakes, from MAS's own enforcement page */}
      <div style={{ position: "absolute", left: 1040, top: 560, width: 748, borderLeft: `3px solid ${K.red}`, padding: "6px 0 6px 22px", opacity: warn, transform: `translateY(${(1 - warn) * 10}px)` }}>
        <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.4, color: K.onDark }}>
          July 2025: MAS revoked a CMS licence, citing <span style={{ color: K.red }}>quarterly returns not submitted</span> among the breaches.
        </div>
        <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 14, letterSpacing: 1.4, color: K.onDark2 }}>mas.gov.sg · Enforcement actions · 3 Jul 2025</div>
      </div>
      <Footline text="Miss it and MAS notices" delay={104} />
    </Stage>
  );
};

/** 3 · STEP 01 COLLECT — four sources into one. */
const Collect: React.FC = () => {
  const frame = useCurrentFrame();
  const SRC = ["General ledger", "Fund administrator NAV", "Bank statements · SGD, USD", "Your own Excel"];
  const SX = 952, SY = 318, PITCH = 128;
  const HUB = { x: 1500, y: SY + (PITCH * (SRC.length - 1)) / 2 };
  const hub = pIn(frame, 46, 16);
  const one = pIn(frame, 70, 18);
  return (
    <Stage>
      <FlowBar active={0} delay={4} />
      <div style={{ position: "absolute", left: SAFE, top: 330, width: 720 }}>
        <Step n="STEP 01" />
        <Head size={66} style={{ letterSpacing: -4.4 }}>
          Scattered data,
          <br />
          collected <span style={{ color: K.brandLite }}>automatically</span>
        </Head>
        <Sub delay={40} size={25}>Ledger, admin, bank, spreadsheets — pulled every quarter, by the system.</Sub>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {SRC.map((_, i) => {
          const y = SY + i * PITCH;
          const p = pIn(frame, 30 + i * 6, 20);
          if (p <= 0.01) return null;
          const x1 = SX + 340;
          return <line key={i} x1={x1} y1={y} x2={x1 + (HUB.x - 36 - x1) * p} y2={y + (HUB.y - y) * p} stroke="rgba(96,165,250,0.45)" strokeWidth={1.7} strokeDasharray="5 5" />;
        })}
        {hub > 0.4 ? <line x1={HUB.x + 40} y1={HUB.y} x2={HUB.x + 40 + one * 150} y2={HUB.y} stroke={K.emerald} strokeWidth={2.4} /> : null}
      </svg>
      {SRC.map((s, i) => {
        const p = pIn(frame, 12 + i * 6, 14);
        return (
          <div key={s} style={{ position: "absolute", left: SX, top: SY + i * PITCH - 31, width: 340, border: `1px solid ${K.line2}`, background: "rgba(148,163,184,0.06)", borderRadius: 5, padding: "16px 22px 18px", opacity: p, transform: `translateX(${(1 - p) * -16}px)` }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8, color: K.onDark, whiteSpace: "nowrap" }}>{s}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: HUB.x - 36, top: HUB.y - 36, width: 72, height: 72, borderRadius: 36, background: K.brand, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 ${20 + hub * 44}px rgba(59,130,246,0.6)`, opacity: hub }}>
        <span style={{ width: 22, height: 22, background: "#fff", transform: "rotate(45deg)" }} />
      </div>
      <div style={{ position: "absolute", left: HUB.x + 206, top: HUB.y - 30, opacity: pIn(frame, 78, 16) }}>
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: 2.4, color: K.emerald }}>ONE SOURCE</div>
        <div style={{ marginTop: 8, fontSize: 30, fontWeight: 700, letterSpacing: -1, color: K.onDark }}>for every form</div>
      </div>
    </Stage>
  );
};

/** 4 · STEP 02 MAP — the names in your systems → the line item on Form 1. */
const MapNames: React.FC = () => {
  const frame = useCurrentFrame();
  const GROUPS = [
    { target: "Cash and bank balances", form: "Form 1 · line item", raw: ["Cash at bank", "CASH_EQV", "Bank balances"] },
    { target: "Trade and other receivables", form: "Form 1 · line item", raw: ["Mgmt fee receivable", "AR_FEES", "Fees due from fund"] },
  ];
  const LX = 900, RX = 1500, LW = 420;
  return (
    <Stage>
      <FlowBar active={1} delay={4} />
      <div style={{ position: "absolute", left: SAFE, top: 318, width: 700 }}>
        <Step n="STEP 02" />
        <Head size={58}>
          Every system's own name,
          <br />
          mapped to the <span style={{ color: K.brandLite }}>MAS line item</span>
        </Head>
        <Sub delay={44} size={27}>Ledger accounts, admin fields, spreadsheet headers — learned once, reused every quarter.</Sub>
      </div>
      <div style={{ position: "absolute", left: LX, top: 196, width: LW, fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: 2.2, color: K.onDark3, opacity: pIn(frame, 10, 14) }}>IN YOUR SYSTEMS</div>
      <div style={{ position: "absolute", left: RX - 18, top: 196, width: 360, fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: 2.2, color: K.brandLite, opacity: pIn(frame, 14, 14) }}>ON THE MAS FORM</div>
      {GROUPS.map((g, gi) => {
        const base = gi === 0 ? 14 : 62;
        const top = gi === 0 ? 250 : 650;
        const tY = top + 78;
        return (
          <React.Fragment key={g.target}>
            <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
              {g.raw.map((_, i) => {
                const y = top + i * 62;
                const p = pIn(frame, base + 22 + i * 5, 18);
                if (p <= 0.01) return null;
                const x1 = LX + LW;
                const mx = (x1 + RX) / 2;
                return <path key={i} d={`M ${x1} ${y} C ${mx} ${y}, ${mx} ${tY}, ${RX - 18} ${tY}`} stroke="rgba(96,165,250,0.5)" strokeWidth={1.8} fill="none" strokeDasharray={900} strokeDashoffset={900 * (1 - p)} />;
              })}
            </svg>
            {g.raw.map((r, i) => {
              const p = pIn(frame, base + i * 6, 14);
              return (
                <div key={r} style={{ position: "absolute", left: LX, top: top + i * 62 - 22, width: LW, borderBottom: `1px solid ${K.line}`, padding: "8px 6px 10px", fontFamily: i === 1 ? MONO : SANS, fontSize: i === 1 ? 22 : 26, fontWeight: 600, letterSpacing: i === 1 ? 1 : -0.6, color: K.onDark2, opacity: p, transform: `translateX(${(1 - p) * -14}px)` }}>
                  {r}
                </div>
              );
            })}
            <div style={{ position: "absolute", left: RX, top: tY - 46, width: 340, border: `2px solid ${K.brand}`, background: "rgba(59,130,246,0.14)", borderRadius: 6, padding: "16px 22px 18px", opacity: pIn(frame, base + 34, 16), boxShadow: `0 0 ${20 + pIn(frame, base + 40, 20) * 28}px rgba(59,130,246,0.3)` }}>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: 2.4, color: K.brandLite }}>{g.form.toUpperCase()}</div>
              <div style={{ marginTop: 8, fontSize: 26, fontWeight: 700, letterSpacing: -0.8, color: K.onDark, lineHeight: 1.2 }}>{g.target}</div>
            </div>
          </React.Fragment>
        );
      })}
      <Footline text="Mapped once · reused every quarter" delay={96} />
    </Stage>
  );
};

/** 5 · STEP 03 CHECK — light stage, the ledger-vs-form table, one mismatch flagged. */
const Check: React.FC = () => {
  const frame = useCurrentFrame();
  const ROWS = [
    { h: "Cash and bank balances", a: "4,128,800", b: "4,128,800", d: "0" },
    { h: "Trade and other receivables", a: "912,415", b: "912,415", d: "0" },
    { h: "Investments", a: "1,336,402", b: "1,336,402", d: "0" },
    { h: "Other assets", a: "88,470", b: "87,266", d: "−1,204", bad: true },
    { h: "Total assets", a: "6,466,087", b: "6,464,883", d: "−1,204", bad: true, sum: true },
  ];
  const TABLE_TOP = 442, PITCH = 80, BAD_ROW = 3;
  const flag = frame >= 60;
  const blink = flag ? 0.45 + 0.55 * Math.abs(Math.sin((frame - 60) / 7)) : 0;
  const push = interpolate(frame, [56, 130], [1, 1.04], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <AbsoluteFill style={{ fontFamily: SANS, background: K.paper }}>
      <Broll src="clips/sg-33702866.mp4" opacity={0.09} zoom={0.04} grade="grayscale(1) brightness(1.1)" from={60} />
      <FlowBar active={2} delay={4} tone="light" />
      <div style={{ position: "absolute", left: SAFE, top: 206 }}>
        <Step n="STEP 03" tone="light" />
        <Head size={48} tone="light" style={{ marginTop: 14 }}>
          Ledger vs Form 1 — <span style={{ color: K.redInk }}>only the gaps</span> are flagged
        </Head>
      </div>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "50% 62%" }}>
        <div style={{ position: "absolute", left: SAFE, right: SAFE, top: 340, display: "flex", alignItems: "center", gap: 16, paddingBottom: 16, borderBottom: `1px solid ${K.paperLine}`, opacity: pIn(frame, 20, 12) }}>
          <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: 3, color: K.ink3 }}>GENERAL LEDGER ↔ FORM 1 · S$</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: 2, color: flag ? "#fff" : K.ink4, background: flag ? K.redInk : "rgba(15,23,42,0.06)", borderRadius: 4, padding: "8px 14px 9px", opacity: pIn(frame, 50, 12) }}>1 MISMATCH</span>
        </div>
        <div style={{ position: "absolute", left: SAFE, right: SAFE, top: 396, display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr", paddingLeft: 18, paddingBottom: 10, borderBottom: `2px solid ${K.ink}`, fontFamily: MONO, fontSize: 17, letterSpacing: 1.4, color: K.ink3, opacity: pIn(frame, 22, 12) }}>
          <span>LINE ITEM</span>
          <span style={{ textAlign: "right" }}>LEDGER</span>
          <span style={{ textAlign: "right" }}>FORM 1</span>
          <span style={{ textAlign: "right" }}>DIFF</span>
        </div>
        {ROWS.map((r, i) => {
          const p = pIn(frame, 28 + i * 5, 12);
          const bad = !!r.bad && flag;
          return (
            <div key={r.h} style={{ position: "absolute", left: SAFE, right: SAFE, top: TABLE_TOP + i * PITCH, display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr", alignItems: "center", padding: "16px 0 17px", paddingLeft: 18, borderBottom: "1px solid rgba(15,23,42,0.10)", borderLeft: bad ? `4px solid ${K.redInk}` : "4px solid transparent", background: bad ? `rgba(179,38,30,${0.05 + blink * 0.06})` : r.sum ? "rgba(15,23,42,0.04)" : "transparent", opacity: p }}>
              <span style={{ fontSize: 27, fontWeight: r.sum ? 700 : 600, color: K.ink }}>{r.h}</span>
              <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 27, fontWeight: r.sum ? 700 : 500, color: K.ink2 }}>{r.a}</span>
              <span style={{ textAlign: "right", fontFamily: MONO, fontSize: 27, fontWeight: r.sum ? 700 : 500, color: bad ? K.redInk : K.ink2 }}>{r.b}</span>
              <span style={{ justifySelf: "end", fontFamily: MONO, fontSize: 27, fontWeight: 700, color: bad ? K.redInk : K.ink4, border: bad ? `2px solid rgba(179,38,30,${0.4 + blink * 0.5})` : "2px solid transparent", borderRadius: 3, padding: "4px 10px" }}>{r.d}</span>
            </div>
          );
        })}
        {flag ? (
          <div style={{ position: "absolute", left: 560, top: TABLE_TOP + BAD_ROW * PITCH - 24, display: "flex", alignItems: "center", gap: 11, background: K.redInk, borderRadius: 4, padding: "10px 18px 11px", boxShadow: `0 10px 30px rgba(179,38,30,${0.3 + blink * 0.3})`, opacity: 0.55 + blink * 0.45, transform: `scale(${0.98 + blink * 0.03})` }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, background: "#fff", opacity: blink }} />
            <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, letterSpacing: 3, color: "#fff" }}>MISMATCH</span>
            <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.4)" }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: -0.5 }}>Other assets −1,204 · traced to row 212 of the admin file</span>
          </div>
        ) : null}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: SAFE, bottom: 84, fontSize: 26, fontWeight: 600, letterSpacing: -0.8, color: K.ink3, opacity: pIn(frame, 92, 16) }}>Everything else passes. You decide on the one line that didn't.</div>
      <div style={{ position: "absolute", right: SAFE, bottom: 40, fontFamily: MONO, fontSize: 15, letterSpacing: 1, color: K.ink4, opacity: 0.8 }}>Illustrative figures</div>
    </AbsoluteFill>
  );
};

/** 6 · STEP 04 LODGE — the matched data goes into both forms, MASNET-ready. */
const Lodge: React.FC = () => {
  const frame = useCurrentFrame();
  const SRC = { x: 760, y: 540 };
  const OUT = [
    { t: "Form 1", s: "Statement of Assets and Liabilities · MASNET", y: 346 },
    { t: "Form 2", s: "Financial Resources & TRR · MASNET", y: 700 },
  ];
  return (
    <Stage>
      <FlowBar active={3} delay={4} />
      <div style={{ position: "absolute", left: SAFE, top: 182 }}>
        <Step n="STEP 04" />
        <Head size={54} style={{ letterSpacing: -3.4 }}>
          The same numbers,
          <br />
          into <span style={{ color: K.brandLite }}>both forms</span>, ready to lodge
        </Head>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
        {OUT.map((o, i) => {
          const p = pIn(frame, 24 + i * 8, 22);
          if (p <= 0.01) return null;
          const x1 = SRC.x + 170, x2 = 1180, mx = (x1 + x2) / 2;
          return <path key={o.t} d={`M ${x1} ${SRC.y} C ${mx} ${SRC.y}, ${mx} ${o.y}, ${x1 + (x2 - x1) * p} ${SRC.y + (o.y - SRC.y) * p}`} stroke="rgba(96,165,250,0.55)" strokeWidth={2.2} fill="none" />;
        })}
      </svg>
      <div style={{ position: "absolute", left: SRC.x - 170, top: SRC.y - 62, width: 340, border: `2px solid ${K.brand}`, background: "rgba(59,130,246,0.14)", borderRadius: 6, padding: "20px 24px 22px", textAlign: "center", opacity: pIn(frame, 10, 16), boxShadow: `0 0 ${24 + pIn(frame, 16, 20) * 36}px rgba(59,130,246,0.35)` }}>
        <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: 2.6, color: K.brandLite }}>CHECKED</div>
        <div style={{ marginTop: 10, fontSize: 34, fontWeight: 700, letterSpacing: -1.4, color: K.onDark }}>One data set</div>
      </div>
      {OUT.map((o, i) => {
        const p = pIn(frame, 42 + i * 8, 16);
        const ok = pIn(frame, 78 + i * 8, 12);
        return (
          <div key={o.t} style={{ position: "absolute", left: 1180, top: o.y - 70, width: 520, border: `1px solid ${K.line2}`, background: "rgba(148,163,184,0.06)", borderRadius: 6, overflow: "hidden", opacity: p, transform: `translateX(${(1 - p) * 18}px)` }}>
            <div style={{ padding: "18px 24px 16px", borderBottom: `1px solid ${K.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1.2, color: K.onDark }}>{o.t}</div>
                <div style={{ marginTop: 7, fontFamily: MONO, fontSize: 15, letterSpacing: 1.2, color: K.onDark2 }}>{o.s}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: 2, color: K.emerald, border: "1px solid rgba(52,211,153,0.5)", borderRadius: 4, padding: "6px 10px", opacity: ok, transform: `scale(${0.9 + ok * 0.1})` }}>READY</div>
            </div>
            <div style={{ padding: "16px 24px 20px" }}>
              {[0.9, 0.72, 0.84].map((w, k) => (
                <div key={k} style={{ height: 8, width: `${w * 100}%`, background: "rgba(148,163,184,0.2)", borderRadius: 3, marginBottom: 10, opacity: pIn(frame, 50 + i * 8 + k * 4, 12) }} />
              ))}
            </div>
          </div>
        );
      })}
      <Footline text="Never reconciled twice" delay={88} />
    </Stage>
  );
};

/** 7 · payoff — 2 hours → 2 minutes, over the CBD. */
const Payoff: React.FC = () => {
  const frame = useCurrentFrame();
  const a = pIn(frame, 6, 16);
  const arrow = pIn(frame, 26, 14);
  const b = pIn(frame, 34, 18);
  const steps = pIn(frame, 58, 16);
  return (
    <Stage>
      <Broll src="clips/sg-33702866.mp4" opacity={0.5} zoom={0.1} from={120} grade="saturate(0.4) brightness(0.95) contrast(1.08)" />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(8,14,28,0.26) 0%, rgba(8,14,28,0.82) 64%, rgba(8,14,28,0.95) 100%)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", marginTop: -30 }}>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, letterSpacing: 7, color: K.brandLite, opacity: pIn(frame, 2, 14) }}>PER FORM · PER QUARTER</div>
          <div style={{ marginTop: 26, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 36 }}>
            <span style={{ fontSize: 100, fontWeight: 700, letterSpacing: -5, color: K.onDark2, opacity: a, textDecoration: b > 0.6 ? "line-through" : "none", textDecorationColor: K.red, textDecorationThickness: 6 }}>2 hours</span>
            <span style={{ fontSize: 64, color: K.brandLite, opacity: arrow, transform: `translateX(${(arrow - 1) * 20}px)` }}>→</span>
            <span style={{ fontSize: 140, fontWeight: 700, letterSpacing: -7, color: K.onDark, opacity: b, transform: `scale(${0.9 + b * 0.1})` }}>
              2 <span style={{ color: K.brandLite }}>minutes</span>
            </span>
          </div>
          <div style={{ marginTop: 34, display: "flex", justifyContent: "center", gap: 18, fontFamily: MONO, fontSize: 18, letterSpacing: 3, color: K.onDark2, opacity: steps }}>
            {STAGES.map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 ? <span style={{ color: K.onDark3 }}>·</span> : null}
                <span style={{ textTransform: "uppercase" }}>{s === "Lodge" ? "Lodged" : s === "Map" ? "Mapped" : s + "ed"}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/** 8 · outro — wordmark, one line, the site. */
const Outro: React.FC<{ t: CaptionTiming }> = () => {
  const frame = useCurrentFrame();
  const E2 = Easing.bezier(0.16, 1, 0.3, 1);
  const q = (a: number, b: number) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E2 });
  const mark = q(0, 18), word = q(6, 30), rule = q(26, 48), tag = q(34, 54), site = q(48, 68);
  return (
    <Stage>
      <AbsoluteFill style={{ background: "radial-gradient(900px 560px at 50% 50%, rgba(59,130,246,0.2), transparent 70%)", opacity: mark }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26 }}>
            <span style={{ width: 26, height: 26, background: K.brand, transform: `rotate(${45 + (1 - mark) * 135}deg) scale(${0.3 + mark * 0.7})`, opacity: mark }} />
            <span style={{ fontFamily: MONO, fontSize: 58, fontWeight: 700, letterSpacing: 8 + word * 18, color: K.onDark, opacity: word, whiteSpace: "nowrap" }}>TREASURER</span>
          </div>
          <div style={{ margin: "30px auto 0", width: rule * 180, height: 2, background: K.brand }} />
          <div style={{ marginTop: 30, fontSize: 30, fontWeight: 600, letterSpacing: -1, color: K.onDark, opacity: tag }}>MAS returns, collected to lodged.</div>
          <div style={{ marginTop: 14, fontSize: 22, fontWeight: 500, color: K.onDark2, opacity: tag }}>AI transformation for financial institutions · Singapore · Hong Kong · Korea</div>
          <div style={{ marginTop: 34, fontFamily: MONO, fontSize: 22, letterSpacing: 4, color: K.onDark2, opacity: site }}>treasurer.net</div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/* ------------------------------------------------------------------ cut */

export const MAS_SCENES: S[] = [
  { id: "hook", dur: 4.8, body: Hook },
  { id: "deadline", dur: 5.0, in: "fade", body: Deadline, mark: true },
  { id: "collect", dur: 4.0, in: "slide", body: Collect, mark: true },
  { id: "map", dur: 4.4, in: "slide", body: MapNames, mark: true },
  { id: "check", dur: 4.4, in: "wipe", body: Check, mark: true },
  { id: "lodge", dur: 4.0, in: "slide", body: Lodge, mark: true },
  { id: "payoff", dur: 3.4, in: "fade", body: Payoff },
  { id: "outro", dur: 3.0, in: "fade", body: Outro },
];

const frames = (s: S) => Math.round(s.dur * FPS);
const trIn = (s: S) => (s.in ? TR[s.in] : 0);
export const MAS_FRAMES = MAS_SCENES.reduce((a, s, i) => a + frames(s) - (i > 0 ? trIn(s) : 0), 0);

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, MAS_FRAMES], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: "rgba(148,163,184,0.12)" }}>
      <div style={{ width: `${p * 100}%`, height: "100%", background: `linear-gradient(90deg, ${K.brand}, ${K.brandLite})` }} />
    </div>
  );
};

export const Mas: React.FC = () => (
  <AbsoluteFill style={{ background: K.dark }}>
    <TransitionSeries>
      {MAS_SCENES.flatMap((s, i) => {
        const Body = s.body;
        const t: CaptionTiming = { enter: i > 0 ? trIn(s) : 0, exitAt: frames(s) - 6 };
        const nodes: React.ReactNode[] = [];
        if (i > 0 && s.in) {
          nodes.push(<TransitionSeries.Transition key={`t-${s.id}`} presentation={presentationFor(s.in)} timing={linearTiming({ durationInFrames: trIn(s) })} />);
        }
        nodes.push(
          <TransitionSeries.Sequence key={s.id} durationInFrames={frames(s)}>
            <Body t={t} />
            {s.mark ? <BrandMark tone={s.id === "check" ? "light" : "dark"} /> : null}
          </TransitionSeries.Sequence>
        );
        return nodes;
      })}
    </TransitionSeries>
    <Progress />
  </AbsoluteFill>
);
