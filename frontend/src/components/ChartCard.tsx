"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#ea580c"];

interface ChartCardProps {
  title: string;
  data: { label: string; value: number }[];
  type?: "bar" | "pie";
}

function formatKRW(value: number): string {
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
  if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(0)}만`;
  return value.toLocaleString();
}

export default function ChartCard({ title, data, type = "bar" }: ChartCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-[13px] font-bold text-black uppercase tracking-wide mb-4">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#111" }} />
              <YAxis tick={{ fontSize: 11, fill: "#111" }} tickFormatter={formatKRW} />
              <Tooltip
                formatter={(val) => formatKRW(Number(val))}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
              <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%"
                outerRadius={75} innerRadius={40}
                label={(props) => `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                style={{ fontSize: 11 }}>
                {data.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
              </Pie>
              <Tooltip
                formatter={(val) => formatKRW(Number(val))}
                contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
