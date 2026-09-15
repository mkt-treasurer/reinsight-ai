"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi, Contract, ListResponse } from "@/lib/api";
import DataTable from "@/components/DataTable";
import Modal from "@/components/Modal";
import RecordForm from "@/components/RecordForm";

function formatAmount(val: number | null): string {
  if (val === null) return "-";
  return val.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

const columns = [
  { key: "year" as const, label: "Year" },
  { key: "cont_month" as const, label: "Month" },
  { key: "cover_note_no" as const, label: "Cover Note" },
  { key: "assured" as const, label: "Assured", render: (val: unknown, row: Contract) => (
    <button onClick={(e) => { e.stopPropagation(); window.location.href = `/ins/contracts/${row.id}`; }}
      className="font-bold text-blue-600 hover:text-blue-800 text-left">{String(val || "-")}</button>
  ) },
  { key: "line" as const, label: "Line" },
  { key: "reinsurer" as const, label: "Reinsurer" },
  { key: "cedant" as const, label: "Cedant" },
  { key: "currency" as const, label: "Ccy" },
  { key: "ri_prem" as const, label: "RI Premium", render: (val: unknown) => formatAmount(val as number | null) },
  { key: "rec_date" as const, label: "Rec Date", render: (val: unknown) => (val ? String(val) : "-") },
];

const formFields = [
  { key: "year", label: "Year", type: "number" as const },
  { key: "cont_month", label: "Month" },
  { key: "cover_note_no", label: "Cover Note No." },
  { key: "assured", label: "Assured" },
  { key: "line", label: "Line" },
  { key: "reinsurer", label: "Reinsurer" },
  { key: "cedant", label: "Cedant" },
  { key: "currency", label: "Currency" },
  { key: "ri_prem", label: "RI Premium", type: "number" as const },
  { key: "ri_commission", label: "Commission", type: "number" as const },
  { key: "net_ri_prem", label: "Net RI Premium", type: "number" as const },
  { key: "rec_date", label: "Rec Date", type: "date" as const },
  { key: "paid_date", label: "Paid Date", type: "date" as const },
  { key: "remarks", label: "Remarks" },
];

export default function ContractsPage() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse<Contract> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: "add" | "edit"; record?: Contract } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (search) params.set("search", search);
    fetchApi<ListResponse<Contract>>(`/api/contracts?${params}`)
      .then(setData).finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (formData: Record<string, unknown>) => {
    await fetchApi("/api/contracts", { method: "POST", body: JSON.stringify(formData) });
    setModal(null);
    load();
  };

  const handleUpdate = async (formData: Record<string, unknown>) => {
    if (!modal?.record) return;
    await fetchApi(`/api/contracts/${modal.record.id}`, { method: "PUT", body: JSON.stringify(formData) });
    setModal(null);
    load();
  };

  const handleDelete = async (row: Contract) => {
    if (!confirm(`Delete contract ${row.cover_note_no || row.assured || row.id}?`)) return;
    await fetchApi(`/api/contracts/${row.id}`, { method: "DELETE" });
    load();
  };

  if (loading && !data) return <div className="text-center py-20 text-gray-400 text-sm">Loading...</div>;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-black">Contracts</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">Reinsurance contract management</p>
      </div>
      {data && (
        <DataTable columns={columns} data={data.items} total={data.total}
          page={data.page} pageSize={data.page_size} onPageChange={setPage}
          onSearch={setSearch} searchPlaceholder="Search assured..."
          onAdd={() => router.push("/ins/contracts/process")}
          onEdit={(row) => setModal({ type: "edit", record: row })}
          onDelete={handleDelete}
        />
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.type === "add" ? "New Contract" : "Edit Contract"}>
        <RecordForm
          fields={formFields}
          initial={modal?.record as Record<string, unknown> | undefined}
          onSubmit={modal?.type === "add" ? handleCreate : handleUpdate}
          submitLabel={modal?.type === "add" ? "Create" : "Update"}
        />
      </Modal>
    </div>
  );
}
