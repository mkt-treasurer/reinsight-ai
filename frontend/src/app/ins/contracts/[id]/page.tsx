"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { fetchApi, Contract } from "@/lib/api";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import RecordForm from "@/components/RecordForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7601";

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

interface Link {
  id: number;
  contract_id: number;
  claim_id: number;
  score: number;
  signals: string[] | null;
  ai_reasoning: string | null;
  status: string;
  account_name: string | null;
  reinsurer: string | null;
  ref_no: string | null;
  krw_amount: number | null;
}

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [editModal, setEditModal] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchApi<Contract>(`/api/contracts/${id}`),
      fetchApi<Link[]>(`/api/contracts/${id}/links`),
    ]).then(([c, l]) => {
      setContract(c);
      setLinks(l);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const runMatch = async () => {
    setMatching(true);
    const result = await fetchApi<Link[]>(`/api/contracts/${id}/match`, { method: "POST" });
    setLinks(result);
    setMatching(false);
  };

  const updateStatus = async (linkId: number, status: string) => {
    await fetchApi(`/api/contracts/${id}/links/${linkId}/status?status=${status}`, { method: "PUT" });
    setLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, status } : l));
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    await fetchApi(`/api/contracts/${id}`, { method: "PUT", body: JSON.stringify(data) });
    const updated = await fetchApi<Contract>(`/api/contracts/${id}`);
    setContract(updated);
    setEditModal(false);
  };

  if (loading || !contract) return <div className="text-center py-20 text-gray-400 text-sm">Loading...</div>;

  const confirmed = links.filter((l) => l.status === "confirmed");
  const candidates = links.filter((l) => l.status === "candidate");
  const rejected = links.filter((l) => l.status === "rejected");

  return (
    <div>
      <div className="mb-5">
        <button onClick={() => router.push("/ins/contracts")}
          className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 mb-2 block">&lt; Back to contracts</button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold text-black">{contract.assured || `Contract #${id}`}</h1>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 border border-gray-200">{contract.cover_note_no}</span>
          <button onClick={() => setEditModal(true)}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800">Edit</button>
        </div>
      </div>

      {/* Contract info */}
      <div className="grid grid-cols-6 gap-3 mb-5">
        <StatCard title="Year" value={contract.year || "-"} />
        <StatCard title="Line" value={contract.line || "-"} />
        <StatCard title="Reinsurer" value={contract.reinsurer || "-"} />
        <StatCard title="Cedant" value={contract.cedant || "-"} />
        <StatCard title="RI Premium" value={fmt(contract.ri_prem)} accent="text-blue-600" />
        <StatCard title="Period" value={`${contract.period_from || "?"} ~ ${contract.period_to || "?"}`} />
      </div>

      {/* Claim matching section */}
      <div className="border-t border-gray-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-extrabold text-black">Claim Candidates</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">AI-powered matching with rule-based scoring + Gemini analysis</p>
          </div>
          <button onClick={runMatch} disabled={matching}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700 disabled:opacity-50">
            {matching ? "Analyzing..." : links.length > 0 ? "Re-analyze" : "Find Matches"}
          </button>
        </div>

        {links.length === 0 && !matching && (
          <div className="text-center py-12 text-gray-400 text-[13px] border border-gray-200 rounded-lg bg-white">
            Click "Find Matches" to run AI-powered claim matching
          </div>
        )}

        {matching && (
          <div className="text-center py-12 text-blue-600 text-[13px] border border-blue-200 rounded-lg bg-blue-50 font-medium">
            Running rule-based scoring + Gemini analysis...
          </div>
        )}

        {/* Confirmed */}
        {confirmed.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[12px] font-bold uppercase tracking-wide text-emerald-600 mb-2">Confirmed ({confirmed.length})</h3>
            <LinkTable links={confirmed} onStatusChange={updateStatus} />
          </div>
        )}

        {/* Candidates */}
        {candidates.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[12px] font-bold uppercase tracking-wide text-amber-600 mb-2">Candidates ({candidates.length})</h3>
            <LinkTable links={candidates} onStatusChange={updateStatus} />
          </div>
        )}

        {/* Rejected */}
        {rejected.length > 0 && (
          <div className="mb-4">
            <details>
              <summary className="text-[12px] font-bold uppercase tracking-wide text-gray-400 mb-2 cursor-pointer">
                Rejected ({rejected.length})
              </summary>
              <LinkTable links={rejected} onStatusChange={updateStatus} />
            </details>
          </div>
        )}
      </div>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Contract">
        <RecordForm
          fields={[
            { key: "assured", label: "Assured" },
            { key: "line", label: "Line" },
            { key: "reinsurer", label: "Reinsurer" },
            { key: "cedant", label: "Cedant" },
            { key: "ri_prem", label: "RI Premium", type: "number" as const },
            { key: "currency", label: "Currency" },
          ]}
          initial={contract as unknown as Record<string, unknown>}
          onSubmit={handleUpdate}
          submitLabel="Update"
        />
      </Modal>
    </div>
  );
}

function LinkTable({ links, onStatusChange }: { links: Link[]; onStatusChange: (id: number, status: string) => void }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-center px-3 py-2 text-[10px] font-bold uppercase text-gray-400 w-16">Score</th>
            <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Account</th>
            <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Reinsurer</th>
            <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Ref No.</th>
            <th className="text-right px-3 py-2 text-[10px] font-bold uppercase text-gray-400">KRW</th>
            <th className="text-left px-3 py-2 text-[10px] font-bold uppercase text-gray-400">Signals</th>
            <th className="text-center px-3 py-2 text-[10px] font-bold uppercase text-gray-400 w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <>
              <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block w-10 text-center px-1.5 py-0.5 rounded text-[11px] font-extrabold ${
                    l.score >= 70 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    l.score >= 50 ? "bg-blue-50 text-blue-700 border border-blue-200" :
                    l.score >= 30 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                    "bg-gray-50 text-gray-500 border border-gray-200"
                  }`}>{l.score}</span>
                </td>
                <td className="px-3 py-2 font-bold text-black">{l.account_name || "-"}</td>
                <td className="px-3 py-2 font-medium">{l.reinsurer || "-"}</td>
                <td className="px-3 py-2 text-gray-500">{l.ref_no || "-"}</td>
                <td className="px-3 py-2 text-right font-bold">{fmt(l.krw_amount)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {l.signals?.map((s, i) => (
                      <span key={i} className="px-1 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-600">{s}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {l.status !== "confirmed" && (
                      <button onClick={() => onStatusChange(l.id, "confirmed")}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                        Confirm
                      </button>
                    )}
                    {l.status !== "rejected" && (
                      <button onClick={() => onStatusChange(l.id, "rejected")}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                        Reject
                      </button>
                    )}
                    {l.ai_reasoning && (
                      <button onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                        AI
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {expandedId === l.id && l.ai_reasoning && (
                <tr key={`${l.id}-reason`}>
                  <td colSpan={7} className="px-6 py-2 bg-blue-50 border-b border-blue-100">
                    <span className="text-[11px] font-bold text-blue-600 mr-2">AI:</span>
                    <span className="text-[12px] text-black">{l.ai_reasoning}</span>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
