"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { fetchApi, Claim, ListResponse } from "@/lib/api";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import RecordForm from "@/components/RecordForm";
import ClaimIntakeModal from "@/components/ClaimIntakeModal";

function formatAmount(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

interface ClaimExt extends Claim {
  case_id: number | null;
  workflow_status: string | null;
  soc_received: string | null;
  soc_sent: string | null;
  total_amount: number | null;
  share: number | null;
  received_date: string | null;
  paid_date: string | null;
  remarks: string | null;
}

const columns = [
  { key: "booking_month" as const, label: "Booking" },
  { key: "account_name" as const, label: "Account", render: (val: unknown) => {
    const name = val as string | null;
    if (!name) return "-";
    return <a href={`/ins/claims/by-account/${encodeURIComponent(name)}`} className="text-blue-600 font-bold hover:text-blue-800" onClick={(e) => e.stopPropagation()}>{name}</a>;
  }},
  { key: "line" as const, label: "Line" },
  { key: "reinsurer" as const, label: "Reinsurer", render: (val: unknown) => {
    const name = val as string | null;
    if (!name) return "-";
    return <a href={`/ins/claims/reinsurer/${encodeURIComponent(name)}`} className="text-blue-600 hover:text-blue-800 font-medium" onClick={(e) => e.stopPropagation()}>{name}</a>;
  }},
  { key: "cedant" as const, label: "Cedant" },
  { key: "status" as const, label: "Status", render: (val: unknown, row: ClaimExt) => {
    const status = val as string | null;
    const ws = row.workflow_status;
    return (
      <div className="flex items-center gap-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
          status === "Open" ? "bg-amber-50 text-amber-700 border border-amber-200" :
          status === "Closed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
          status === "Deleted" ? "bg-red-50 text-red-400 border border-red-200" :
          "bg-slate-50 text-slate-500 border border-slate-200"
        }`}>{status || "-"}</span>
        {ws && !["soc_received", "completed", "booked"].includes(ws) && (
          <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">{ws}</span>
        )}
      </div>
    );
  }},
  { key: "krw_amount" as const, label: "KRW Amount", align: "right" as const, render: (val: unknown) => formatAmount(val as number | null) },
  { key: "ref_no" as const, label: "Ref No.", render: (val: unknown) => {
    const ref = val as string | null;
    if (!ref) return "-";
    return <a href={`/ins/claims/ref/${encodeURIComponent(ref)}`} className="text-blue-600 hover:text-blue-800 text-[11px] font-medium" onClick={(e) => e.stopPropagation()}>{ref}</a>;
  }},
  { key: "account_mgr" as const, label: "Manager" },
];

// Extra columns shown on expand (original Excel fields)
const expandColumns = [
  { key: "soc_received" as const, label: "SOC Received" },
  { key: "soc_sent" as const, label: "SOC Sent" },
  { key: "dol" as const, label: "DOL" },
  { key: "currency" as const, label: "Currency" },
  { key: "total_amount" as const, label: "Total Amount", align: "right" as const, render: (val: unknown) => formatAmount(val as number | null) },
  { key: "share" as const, label: "Share", render: (val: unknown) => val != null ? `${((val as number) * 100).toFixed(1)}%` : "-" },
  { key: "soc_amount" as const, label: "SOC Amount", align: "right" as const, render: (val: unknown) => formatAmount(val as number | null) },
  { key: "received_date" as const, label: "Received Date" },
  { key: "paid_date" as const, label: "Paid Date" },
  { key: "remarks" as const, label: "Remarks" },
  { key: "workflow_status" as const, label: "Workflow" },
];

const editFields = [
  { key: "booking_month", label: "Booking Month" },
  { key: "account_name", label: "Account Name" },
  { key: "line", label: "Line" },
  { key: "reinsurer", label: "Reinsurer" },
  { key: "cedant", label: "Cedant" },
  { key: "currency", label: "Currency" },
  { key: "krw_amount", label: "KRW Amount", type: "number" as const },
  { key: "soc_amount", label: "SOC Amount", type: "number" as const },
  { key: "status", label: "Status" },
  { key: "ref_no", label: "Ref No." },
  { key: "account_mgr", label: "Manager" },
  { key: "remarks", label: "Remarks" },
];

export default function ClaimsPage() {
  const searchParams = useSearchParams();
  const urlReinsurer = searchParams.get("reinsurer");

  const [data, setData] = useState<ListResponse<ClaimExt> | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<ClaimExt | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search) params.set("search", search);
    if (urlReinsurer) params.set("reinsurer", urlReinsurer);
    fetchApi<ListResponse<ClaimExt>>(`/api/claims?${params}`)
      .then(setData).finally(() => setLoading(false));
  }, [page, pageSize, search, urlReinsurer]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!editModal) return;
    await fetchApi(`/api/claims/${editModal.id}`, { method: "PUT", body: JSON.stringify(formData) });
    setEditModal(null);
    load();
  };

  const handleDelete = async (row: ClaimExt) => {
    if (!confirm(`Delete claim ${row.ref_no || row.account_name || row.id}?`)) return;
    await fetchApi(`/api/claims/${row.id}`, { method: "DELETE" });
    load();
  };

  if (loading && !data) return (
    <div className="animate-pulse space-y-3">
      <div className="h-5 w-24 bg-slate-200 rounded" />
      {[...Array(5)].map((_, i) => <div key={i} className="h-9 bg-slate-100 rounded" />)}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">
            Claims
            {urlReinsurer && <span className="text-blue-600 ml-2 text-[14px]">/ {urlReinsurer}</span>}
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {urlReinsurer ? <a href="/ins/claims" className="text-blue-500 hover:text-blue-700">Clear filter</a> : "Settlement of claims tracking"}
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-[12px] font-bold hover:bg-blue-700">+ New Claim</button>
      </div>
      {data && (
        <DataTable columns={columns} expandColumns={expandColumns} data={data.items} total={data.total}
          page={data.page} pageSize={data.page_size} onPageChange={setPage} onPageSizeChange={setPageSize}
          onSearch={setSearch} searchPlaceholder="Search account..."
          onEdit={(row) => setEditModal(row)}
          onDelete={handleDelete}
        />
      )}

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Claim">
        <RecordForm fields={editFields} initial={editModal as unknown as Record<string, unknown> | undefined}
          onSubmit={handleUpdate} submitLabel="Update" />
      </Modal>

      <ClaimIntakeModal open={showNew} onClose={() => { setShowNew(false); load(); }} />
    </div>
  );
}
