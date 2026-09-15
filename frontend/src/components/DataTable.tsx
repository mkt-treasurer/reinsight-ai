"use client";

import React, { useState } from "react";

interface Column<T> {
  key: keyof T;
  label: string;
  align?: "left" | "right";
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  expandColumns?: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSearch?: (search: string) => void;
  searchPlaceholder?: string;
  onAdd?: () => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

export default function DataTable<T extends { id: number }>({
  columns, expandColumns, data, total, page, pageSize, onPageChange, onPageSizeChange, onSearch, searchPlaceholder = "Search...",
  onAdd, onEdit, onDelete,
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const totalPages = Math.ceil(total / pageSize);
  const hasActions = onEdit || onDelete;

  // Visible columns: base + expanded
  const visibleColumns = expanded && expandColumns ? [...columns, ...expandColumns] : columns;

  const toggleSelect = (id: number) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map((r) => r.id)));
  };
  const copyToClipboard = () => {
    const rows = data.filter((r) => selected.has(r.id));
    if (!rows.length) return;
    const allCols = expandColumns ? [...columns, ...expandColumns] : columns;
    const header = allCols.map((c) => c.label).join("\t");
    const body = rows.map((r) => allCols.map((c) => {
      const val = r[c.key];
      if (val === null || val === undefined) return "";
      return String(val);
    }).join("\t")).join("\n");
    navigator.clipboard.writeText(header + "\n" + body);
    alert(`${rows.length} rows copied (${allCols.length} columns)`);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {onSearch && (
          <div className="flex gap-1.5">
            <input type="text" value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch(searchValue)}
              placeholder={searchPlaceholder}
              className="px-3 py-1.5 border border-slate-200 rounded text-[12px] w-56 focus:outline-none focus:border-blue-500 bg-white" />
            <button onClick={() => onSearch(searchValue)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-semibold hover:bg-blue-700">
              Search
            </button>
          </div>
        )}
        {onAdd && (
          <button onClick={onAdd} className="px-3 py-1.5 border border-blue-600 text-blue-600 rounded text-[12px] font-bold hover:bg-blue-50">+ New</button>
        )}
        {expandColumns && (
          <button onClick={() => setExpanded(!expanded)}
            className={`px-2.5 py-1.5 rounded text-[11px] font-bold border ${expanded ? "bg-blue-600 text-white border-blue-600" : "text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
            {expanded ? "Collapse" : "Expand All"}
          </button>
        )}
        {selected.size > 0 && (
          <button onClick={copyToClipboard}
            className="px-3 py-1.5 border border-slate-400 text-slate-600 rounded text-[11px] font-bold hover:bg-slate-100">
            Copy {selected.size} rows
          </button>
        )}
        <span className="ml-auto text-[11px] font-semibold text-slate-400">
          {total.toLocaleString()} records
        </span>
      </div>
      <div className="rounded border border-slate-200 bg-white overflow-x-auto">
        <table className="text-[12px]" style={{ minWidth: expanded ? Math.max(visibleColumns.length * 140, 1200) : "100%" }}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="w-8 px-2 py-2">
                <input type="checkbox" checked={selected.size === data.length && data.length > 0} onChange={toggleAll}
                  className="w-3 h-3 rounded border-slate-300" />
              </th>
              {visibleColumns.map((col, i) => (
                <th key={String(col.key)} className={`${col.align === "right" ? "text-right" : "text-left"} px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap ${i >= columns.length ? "bg-blue-50/50" : ""}`}>
                  {col.label}
                </th>
              ))}
              {hasActions && (
                <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 w-20 sticky right-0 bg-slate-50">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 group ${selected.has(row.id) ? "bg-blue-50/50" : ""}`}>
                <td className="w-8 px-2 py-2">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)}
                    className="w-3 h-3 rounded border-slate-300" />
                </td>
                {visibleColumns.map((col, i) => (
                  <td key={String(col.key)} className={`px-3 py-2 font-medium whitespace-nowrap ${col.align === "right" ? "text-right" : ""} ${i >= columns.length ? "bg-blue-50/30 text-slate-600" : "text-slate-900"}`}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "-")}
                  </td>
                ))}
                {hasActions && (
                  <td className="px-3 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity sticky right-0 bg-white">
                    {onEdit && <button onClick={() => onEdit(row)} className="text-[10px] font-bold text-blue-600 mr-2">Edit</button>}
                    {onDelete && <button onClick={() => onDelete(row)} className="text-[10px] font-bold text-red-500">Del</button>}
                  </td>
                )}
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={visibleColumns.length + (hasActions ? 2 : 1)} className="text-center py-8 text-slate-400 text-sm">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {onPageSizeChange && (
            <>
              <span className="text-[10px] text-slate-400">Show</span>
              <select value={pageSize} onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
                className="px-1.5 py-0.5 border border-slate-200 rounded text-[11px] font-bold bg-white">
                {[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
              className="px-3 py-1 rounded border border-slate-200 text-[11px] font-semibold disabled:opacity-30 hover:bg-slate-100">Prev</button>
            <span className="text-[11px] font-bold">{page} / {totalPages}</span>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-slate-200 text-[11px] font-semibold disabled:opacity-30 hover:bg-slate-100">Next</button>
          </div>
        )}
        <div />
      </div>
    </div>
  );
}
