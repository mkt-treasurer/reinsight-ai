"use client";

import { useState } from "react";

interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "date";
}

interface RecordFormProps {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
}

export default function RecordForm({ fields, initial = {}, onSubmit, submitLabel = "Save" }: RecordFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, initial[f.key] != null ? String(initial[f.key]) : ""]))
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (!v) continue;
      if (f.type === "number") data[f.key] = parseFloat(v);
      else data[f.key] = v;
    }
    await onSubmit(data);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
            {f.label}
          </label>
          <input
            type={f.type || "text"}
            value={values[f.key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-[13px] font-medium focus:outline-none focus:border-blue-500"
            step={f.type === "number" ? "any" : undefined}
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold hover:bg-blue-700 disabled:opacity-50 mt-2"
      >
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
