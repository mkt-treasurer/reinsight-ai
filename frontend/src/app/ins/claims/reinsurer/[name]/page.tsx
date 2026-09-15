"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { fetchApi, Claim, ListResponse } from "@/lib/api";
import StatCard from "@/components/StatCard";

function fmt(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

export default function ReinsurerDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const reinsurerName = decodeURIComponent(name);
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<ListResponse<Claim>>(`/api/claims?reinsurer=${encodeURIComponent(reinsurerName)}&page_size=500`)
      .then((d) => { setClaims(d.items); setLoading(false); });
  }, [reinsurerName]);

  if (loading) return <div className="animate-pulse"><div className="h-5 w-40 bg-slate-200 rounded mb-4" /><div className="h-64 bg-slate-100 rounded" /></div>;

  const openClaims = claims.filter((c) => c.status === "Open");
  const totalKrw = claims.reduce((s, c) => s + (c.krw_amount || 0), 0);
  const openKrw = openClaims.reduce((s, c) => s + (c.krw_amount || 0), 0);
  const accounts = [...new Set(claims.map((c) => c.account_name).filter(Boolean))];
  const lines = [...new Set(claims.map((c) => c.line).filter(Boolean))];

  // Group by account
  const byAccount = new Map<string, Claim[]>();
  for (const c of claims) {
    const key = c.account_name || "Unknown";
    if (!byAccount.has(key)) byAccount.set(key, []);
    byAccount.get(key)!.push(c);
  }
  const accountGroups = [...byAccount.entries()].sort((a, b) => {
    const aTotal = a[1].reduce((s, c) => s + Math.abs(c.krw_amount || 0), 0);
    const bTotal = b[1].reduce((s, c) => s + Math.abs(c.krw_amount || 0), 0);
    return bTotal - aTotal;
  });

  return (
    <div>
      <div className="mb-5">
        <button onClick={() => router.push("/ins/claims")} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 mb-2 block">&lt; Back to claims</button>
        <h1 className="text-lg font-extrabold text-slate-900">{reinsurerName}</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Reinsurer claim summary</p>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatCard title="Total Claims" value={claims.length} />
        <StatCard title="Open" value={openClaims.length} accent="text-amber-600" />
        <StatCard title="Total KRW" value={fmt(totalKrw)} accent="text-blue-600" />
        <StatCard title="Open KRW" value={fmt(openKrw)} accent="text-amber-600" />
        <StatCard title="Accounts" value={accounts.length} />
      </div>

      <div className="flex gap-2 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lines:</span>
        {lines.map((l) => (
          <span key={l} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">{l}</span>
        ))}
      </div>

      {/* By Account */}
      <div className="space-y-1">
        {accountGroups.map(([account, group]) => {
          const grpTotal = group.reduce((s, c) => s + (c.krw_amount || 0), 0);
          const grpOpen = group.filter((c) => c.status === "Open").length;
          return (
            <div key={account} className="rounded border border-slate-200 bg-white overflow-hidden">
              <div onClick={() => router.push(`/ins/claims/by-account/${encodeURIComponent(account)}`)}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-bold text-slate-900">{account}</span>
                  <span className="text-[11px] text-slate-400">{group.length} claims</span>
                  {grpOpen > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{grpOpen} open</span>}
                </div>
                <span className="text-[13px] font-bold">{fmt(grpTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
