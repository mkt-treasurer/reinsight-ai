interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: string;
}

export default function StatCard({ title, value, subtitle, accent }: StatCardProps) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <p className={`text-lg font-extrabold mt-0.5 leading-tight ${accent || "text-slate-900"}`}>
        {value}
      </p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
