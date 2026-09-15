"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

// react-force-graph uses window/canvas — must be client-only.
// Cast to any to bypass overload complaints from the dynamic import wrapper.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as any;

interface PastClaim {
  id: number; ref_no: string; account_name: string;
  cedant: string | null; reinsurer: string | null;
  share: number; krw_amount: number;
  dol?: string | null; line?: string | null;
  usd_amount?: number | null; nature_of_loss?: string | null;
  used?: boolean;
}
interface ContractRow {
  id: number; cover_note_no: string; assured: string;
  cedant: string | null; reinsurer: string | null;
  share: number; line: string | null; year: number;
  period_from?: string | null; period_to?: string | null;
  currency?: string | null; gross_prem_100?: number | null;
  ri_prem?: number | null; workflow_status?: string | null;
  used?: boolean;
}
interface Evidence {
  file_reinsurer?: { name: string; share: number; amount: number };
  past_claims?: { search_method: string; rows: PastClaim[] };
  contracts?: { search_method: string; rows: ContractRow[] };
}

interface GNode {
  id: string;
  label: string;
  group: "claim" | "contract" | "past_claim" | "reinsurer" | "cedant" | "file";
  used?: boolean;
  size?: number;
  meta?: string;
  data?: unknown; // original record (PastClaim | ContractRow | reinsurer-name | cedant-code | ...)
}
interface GLink {
  source: string;
  target: string;
  kind: "insured" | "ref" | "reinsurer" | "cedant";
  used?: boolean;
}

const COLORS: Record<GNode["group"], { fill: string; stroke: string; text: string }> = {
  claim:      { fill: "#2563eb", stroke: "#1d4ed8", text: "#ffffff" }, // blue
  file:       { fill: "#fef3c7", stroke: "#f59e0b", text: "#78350f" }, // amber-light
  past_claim: { fill: "#ede9fe", stroke: "#8b5cf6", text: "#4c1d95" }, // violet-light
  contract:   { fill: "#fef3c7", stroke: "#d97706", text: "#78350f" }, // amber-light
  reinsurer:  { fill: "#dcfce7", stroke: "#16a34a", text: "#166534" }, // green
  cedant:     { fill: "#e2e8f0", stroke: "#64748b", text: "#1e293b" }, // slate
};

export default function EvidenceGraph({
  claimLabel,
  evidence,
  socReinsurers,
  extracted,
}: {
  claimLabel: string;
  evidence: Evidence;
  socReinsurers: string[]; // normalized reinsurer names that won the allocation
  extracted?: Record<string, unknown>;
}) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 720 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims({ w: Math.max(400, r.width), h: 720 });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);


  const { nodes, links } = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const seen = new Set<string>();
    const push = (n: GNode) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      nodes.push(n);
    };

    // Current claim (center)
    const claimId = "claim:current";
    push({ id: claimId, label: claimLabel || "Current Claim", group: "claim", size: 8, data: { kind: "current_claim", label: claimLabel, extracted } });

    // File-level hint
    if (evidence.file_reinsurer?.name) {
      const fid = `file:${evidence.file_reinsurer.name}`;
      push({
        id: fid,
        label: `파일: ${evidence.file_reinsurer.name}`,
        group: "file",
        size: 4,
        meta: `${(evidence.file_reinsurer.share * 100).toFixed(1)}% · ${evidence.file_reinsurer.amount.toLocaleString()}`,
        data: { kind: "file_hint", ...evidence.file_reinsurer },
      });
      links.push({ source: claimId, target: fid, kind: "insured" });
    }

    const normalizeKey = (s: string) => s.trim().toUpperCase();

    // Aggregation maps for reinsurer / cedant grouping nodes
    const reinsurerAgg = new Map<string, { name: string; claims: PastClaim[]; contracts: ContractRow[] }>();
    const cedantAgg = new Map<string, { code: string; claims: PastClaim[]; contracts: ContractRow[] }>();

    // Past claims
    for (const r of evidence.past_claims?.rows || []) {
      const nid = `pc:${r.id}`;
      push({ id: nid, label: r.ref_no, group: "past_claim", size: 3, meta: `${r.account_name} · ${(r.share * 100).toFixed(1)}%`, used: r.used, data: r });
      links.push({ source: claimId, target: nid, kind: "ref", used: r.used });
      if (r.reinsurer) {
        const key = normalizeKey(r.reinsurer);
        const rid = `ri:${key}`;
        const agg = reinsurerAgg.get(rid) || { name: r.reinsurer, claims: [], contracts: [] };
        agg.claims.push(r);
        reinsurerAgg.set(rid, agg);
        links.push({ source: nid, target: rid, kind: "reinsurer", used: r.used });
      }
      if (r.cedant) {
        const cid = `ced:${r.cedant}`;
        const agg = cedantAgg.get(cid) || { code: r.cedant, claims: [], contracts: [] };
        agg.claims.push(r);
        cedantAgg.set(cid, agg);
        links.push({ source: nid, target: cid, kind: "cedant" });
      }
    }

    // Contracts
    for (const c of evidence.contracts?.rows || []) {
      const nid = `ct:${c.id}`;
      push({ id: nid, label: c.cover_note_no, group: "contract", size: 4, meta: `${c.assured} (${c.year}) · ${(c.share * 100).toFixed(1)}%`, used: c.used, data: c });
      links.push({ source: claimId, target: nid, kind: "insured", used: c.used });
      if (c.reinsurer) {
        const key = normalizeKey(c.reinsurer);
        const rid = `ri:${key}`;
        const agg = reinsurerAgg.get(rid) || { name: c.reinsurer, claims: [], contracts: [] };
        agg.contracts.push(c);
        reinsurerAgg.set(rid, agg);
        links.push({ source: nid, target: rid, kind: "reinsurer", used: c.used });
      }
      if (c.cedant) {
        const cid = `ced:${c.cedant}`;
        const agg = cedantAgg.get(cid) || { code: c.cedant, claims: [], contracts: [] };
        agg.contracts.push(c);
        cedantAgg.set(cid, agg);
        links.push({ source: nid, target: cid, kind: "cedant" });
      }
    }

    // Push aggregation nodes with their backing data
    for (const [rid, agg] of reinsurerAgg) {
      push({
        id: rid, label: agg.name, group: "reinsurer", size: 6,
        used: socReinsurers.includes(normalizeKey(agg.name)),
        meta: `past=${agg.claims.length} · contract=${agg.contracts.length}`,
        data: { kind: "reinsurer", ...agg },
      });
    }
    for (const [cid, agg] of cedantAgg) {
      push({
        id: cid, label: agg.code, group: "cedant", size: 3.5,
        meta: `past=${agg.claims.length} · contract=${agg.contracts.length}`,
        data: { kind: "cedant", ...agg },
      });
    }

    return { nodes, links };
  }, [claimLabel, evidence, socReinsurers, extracted]);

  const [selected, setSelected] = useState<GNode | null>(null);

  // Spread out the graph: longer links + stronger repulsion. Must run after nodes are set.
  useEffect(() => {
    const g = fgRef.current;
    if (!g) return;
    try {
      const link = g.d3Force("link");
      if (link) link.distance(420).strength(0.15);
      const charge = g.d3Force("charge");
      if (charge) charge.strength(-1600).distanceMax(1500);
      g.d3ReheatSimulation?.();
    } catch { /* ignore */ }
  }, [dims.w, dims.h, nodes.length]);

  // Fit view when graph changes, then clamp zoom so tiny graphs don't become giants
  useEffect(() => {
    const t = setTimeout(() => {
      const g = fgRef.current;
      if (!g) return;
      g.zoomToFit(400, 60);
      setTimeout(() => {
        try {
          const z = g.zoom();
          if (z > 1.2) g.zoom(1.2, 300);
        } catch {}
      }, 450);
    }, 400);
    return () => clearTimeout(t);
  }, [nodes.length, links.length, dims.w]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-[10px] text-slate-600">
        <Legend color="#2563eb" label="현재 클레임" />
        <Legend color="#f59e0b" label="파일 힌트" />
        <Legend color="#8b5cf6" label="과거 클레임" />
        <Legend color="#d97706" label="계약" />
        <Legend color="#16a34a" label="재보험사" />
        <Legend color="#64748b" label="원수사" />
        <Legend color="#16a34a" label="✓ AI가 사용" dashed />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0, 1fr) 420px" }}>
        <div ref={containerRef} className="rounded-lg border border-slate-200 bg-white overflow-hidden" style={{ height: dims.h }}>
          <ForceGraph2D
            ref={fgRef}
            graphData={{ nodes, links }}
            width={dims.w}
            height={dims.h}
            backgroundColor="#fafafa"
            nodeRelSize={2}
            nodeVal={(n: GNode) => n.size || 3}
            linkColor={(l: GLink) => (l.used ? "rgba(22,163,74,0.8)" : "rgba(148,163,184,0.35)")}
            linkWidth={(l: GLink) => (l.used ? 2 : 1)}
            linkDirectionalParticles={(l: GLink) => (l.used ? 2 : 0)}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleColor={() => "#16a34a"}
            onNodeClick={(node: GNode) => setSelected(node)}
            onBackgroundClick={() => setSelected(null)}
            nodeCanvasObject={(node: GNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const c = COLORS[node.group];
              // Radius in screen-pixels is roughly nodeRelSize * sqrt(nodeVal)
              const r = Math.max(3, (node.size || 3));
              const isUsed = node.used === true;
              const isSelected = selected?.id === node.id;
              ctx.beginPath();
              ctx.arc((node as any).x || 0, (node as any).y || 0, r, 0, 2 * Math.PI);
              ctx.fillStyle = c.fill;
              ctx.fill();
              ctx.lineWidth = (isSelected ? 2 : (isUsed ? 1.5 : 0.5)) / Math.max(0.5, globalScale);
              ctx.strokeStyle = isSelected ? "#0369a1" : (isUsed ? "#16a34a" : c.stroke);
              ctx.stroke();

              // Labels — cap font size so they stay readable at any zoom
              const showLabel = globalScale >= 0.7 || node.group === "claim" || isSelected;
              if (showLabel) {
                // Font in CANVAS pixels: divide by globalScale so it ends up fixed ~10px on screen.
                const fontPx = 10 / globalScale;
                ctx.font = `${node.group === "claim" ? "bold " : ""}${fontPx}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                const label = (node.label || "").length > 22 ? node.label.slice(0, 22) + "…" : node.label;
                const metrics = ctx.measureText(label);
                const padX = 2 / globalScale, padY = 1 / globalScale;
                const x = (node as any).x || 0;
                const y = ((node as any).y || 0) + r + (2 / globalScale);
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.fillRect(x - metrics.width / 2 - padX, y, metrics.width + padX * 2, fontPx + padY * 2);
                ctx.fillStyle = "#0f172a";
                ctx.fillText(label, x, y + padY);
              }
            }}
            nodeLabel={(n: GNode) => {
              const meta = n.meta ? `<div style="color:#475569;font-size:11px">${n.meta}</div>` : "";
              return `<div style="background:#fff;border:1px solid #cbd5e1;padding:4px 6px;border-radius:4px"><b>${n.label}</b>${meta}</div>`;
            }}
            cooldownTicks={200}
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.35}
            enableZoomInteraction={true}
          />
        </div>
        <DetailPanel node={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}

function DetailPanel({ node, onClose }: { node: GNode | null; onClose: () => void }) {
  if (!node) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 flex items-center justify-center text-[11px] text-slate-400" style={{ minHeight: 720 }}>
        노드를 클릭하면 상세 정보가 여기에 표시됩니다
      </div>
    );
  }
  const { group, label, data } = node;
  const d: any = data || {};
  const fmt = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 overflow-auto" style={{ maxHeight: 720 }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{group}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-[13px]">✕</button>
      </div>
      <div className="text-[14px] font-bold text-slate-900 break-words mb-3 pb-2 border-b border-slate-100">{label}</div>

      {group === "claim" && (
        <>
          {d.extracted && Object.entries(d.extracted as Record<string, unknown>).map(([k, v]) => (
            v != null && v !== "" && v !== "-" && (
              <Row key={k} label={k} value={typeof v === "number" ? fmt(v) : String(v)} />
            )
          ))}
        </>
      )}

      {group === "file" && (
        <>
          <Row label="재보험사명" value={d.name} />
          <Row label="지분" value={`${((d.share ?? 0) * 100).toFixed(2)}%`} />
          <Row label="금액" value={fmt(d.amount ?? 0)} />
          {(["ins corp.", "ins corp", "ins", "ns corp.", "ns corp", "ns", "daewoo ins", "daewoo ins corp", "daewoo ins corp.", "daewoo insurance", "dwins"].includes(String(d.name || "").toLowerCase())) && (
            <div className="text-[11px] text-amber-600 mt-2">⚠ INS Corp / DAEWOO INS(우리 브로커) — 재보험 배분 대상 아님</div>
          )}
        </>
      )}

      {group === "past_claim" && (
        <>
          <Row label="Ref No" value={d.ref_no} mono />
          <Row label="피보험자" value={d.account_name} />
          <Row label="사고일 (DOL)" value={d.dol || "-"} />
          <Row label="종목" value={d.line || "-"} />
          <Row label="손해 유형" value={d.nature_of_loss || "-"} />
          <Row label="원수사" value={d.cedant || "-"} />
          <Row label="재보험사" value={d.reinsurer || "-"} highlight={d.used} />
          <Row label="비율" value={`${((d.share ?? 0) * 100).toFixed(2)}%`} />
          <Row label="금액 (KRW)" value={fmt(d.krw_amount ?? 0)} />
          {d.usd_amount ? <Row label="금액 (USD)" value={fmt(d.usd_amount)} /> : null}
          {d.used && <div className="text-[11px] text-emerald-600 mt-3 p-2 rounded bg-emerald-50 border border-emerald-200">✓ AI가 이 근거를 배분에 사용함</div>}
        </>
      )}

      {group === "contract" && (
        <>
          <Row label="Cover Note" value={d.cover_note_no} mono />
          <Row label="피보험자" value={d.assured} />
          <Row label="연도" value={String(d.year)} />
          <Row label="계약 기간" value={`${d.period_from || "-"} ~ ${d.period_to || "-"}`} />
          <Row label="종목" value={d.line || "-"} />
          <Row label="원수사" value={d.cedant || "-"} />
          <Row label="재보험사" value={d.reinsurer || "-"} highlight={d.used} />
          <Row label="비율" value={`${((d.share ?? 0) * 100).toFixed(2)}%`} />
          <Row label="통화" value={d.currency || "-"} />
          {d.gross_prem_100 != null && <Row label="Gross Prem (100%)" value={fmt(d.gross_prem_100)} />}
          {d.ri_prem != null && <Row label="RI Prem" value={fmt(d.ri_prem)} />}
          <Row label="워크플로우" value={d.workflow_status || "-"} />
          {d.used && <div className="text-[11px] text-emerald-600 mt-3 p-2 rounded bg-emerald-50 border border-emerald-200">✓ AI가 이 근거를 배분에 사용함</div>}
        </>
      )}

      {group === "reinsurer" && (
        <>
          <Row label="참조 근거" value={`과거 클레임 ${(d.claims || []).length} · 계약 ${(d.contracts || []).length}`} />
          {(d.claims || []).length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-bold text-violet-700 mb-1">과거 클레임</div>
              <div className="space-y-1">
                {(d.claims as PastClaim[]).map((c) => (
                  <div key={c.id} className={`text-[11px] p-2 rounded ${c.used ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-mono font-bold ${c.used ? "text-emerald-700" : "text-slate-700"}`}>{c.used ? "✓ " : ""}{c.ref_no}</span>
                      <span className="text-slate-500">{c.dol || ""}</span>
                    </div>
                    <div className="text-slate-600 mt-0.5 truncate">{c.account_name}</div>
                    <div className="text-slate-700 mt-0.5">{(c.share * 100).toFixed(2)}% · KRW {fmt(c.krw_amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(d.contracts || []).length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-bold text-amber-700 mb-1">계약</div>
              <div className="space-y-1">
                {(d.contracts as ContractRow[]).map((c) => (
                  <div key={c.id} className={`text-[11px] p-2 rounded ${c.used ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-mono font-bold ${c.used ? "text-emerald-700" : "text-slate-700"}`}>{c.used ? "✓ " : ""}{c.cover_note_no}</span>
                      <span className="text-slate-500">{c.year}</span>
                    </div>
                    <div className="text-slate-600 mt-0.5 truncate">{c.assured}</div>
                    <div className="text-slate-700 mt-0.5">{(c.share * 100).toFixed(2)}% · {c.line || "-"}</div>
                    {(c.period_from || c.period_to) && <div className="text-slate-400 text-[10px]">{c.period_from || "?"} ~ {c.period_to || "?"}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {group === "cedant" && (
        <>
          <Row label="원수사 코드" value={d.code} />
          <Row label="연결된 증거" value={`클레임 ${(d.claims || []).length} · 계약 ${(d.contracts || []).length}`} />
          {(d.claims || []).length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-bold text-violet-700 mb-1">클레임 ({d.claims.length})</div>
              <ul className="text-[11px] space-y-0.5">
                {(d.claims as PastClaim[]).slice(0, 10).map((c) => (
                  <li key={c.id} className="text-slate-600">
                    <span className="font-mono">{c.ref_no}</span> — {c.reinsurer || "-"}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(d.contracts || []).length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-bold text-amber-700 mb-1">계약 ({d.contracts.length})</div>
              <ul className="text-[11px] space-y-0.5">
                {(d.contracts as ContractRow[]).slice(0, 10).map((c) => (
                  <li key={c.id} className="text-slate-600">
                    <span className="font-mono">{c.cover_note_no}</span> — {c.reinsurer || "-"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1 border-b border-slate-50 last:border-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-20 shrink-0 pt-0.5">{label}</div>
      <div className={`text-[12px] ${mono ? "font-mono" : ""} ${highlight ? "font-bold text-emerald-700" : "text-slate-800"} break-words`}>{value}</div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block"
        style={{
          width: dashed ? 14 : 10,
          height: dashed ? 3 : 10,
          background: dashed ? "transparent" : color,
          border: dashed ? `2px solid ${color}` : `1px solid ${color}`,
          borderRadius: dashed ? 0 : 999,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
