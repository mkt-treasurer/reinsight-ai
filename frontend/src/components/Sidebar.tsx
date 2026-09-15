"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavChild {
  href: string;
  label: string;
  code?: string;
  group?: string;
}

interface NavItem {
  href: string;
  code: string;
  label: string;
  sublabel?: string;
  children?: NavChild[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Navigation",
    items: [
      { href: "/ins", code: "00", label: "Overview", sublabel: "현황" },
      {
        href: "/ins/claims",
        code: "01",
        label: "Claims",
        sublabel: "보험금",
        children: [
          { href: "/ins/claims", code: "A", label: "All" },
          { href: "/ins/claims/by-account", code: "B", label: "By Account" },
          { href: "/ins/process", code: "C", label: "Drafts" },
          { href: "/ins/audit-data", code: "D", label: "Data Audit" },
        ],
      },
      {
        href: "/ins/contracts",
        code: "02",
        label: "Premium",
        sublabel: "보험료",
        children: [
          { href: "/ins/contracts", code: "A", label: "All" },
          { href: "/ins/contracts/by-cover-note", code: "B", label: "By Cover Note" },
          { href: "/ins/contracts/process", code: "C", label: "Drafts" },
          { href: "/ins/contracts/audit", code: "D", label: "Data Audit" },
        ],
      },
      { href: "/ins/policies", code: "03", label: "Policies", sublabel: "증권" },
    ],
  },
  {
    title: "AI Features",
    items: [
      { href: "/ins/documents", code: "04", label: "Documents", sublabel: "문서" },
      {
        href: "/ins/tools",
        code: "05",
        label: "Tools",
        sublabel: "도구",
        children: [
          { href: "/ins/tools/slip-generator", code: "A", label: "Slip Generator", group: "Generators" },
          { href: "/ins/tools/rq-slip", code: "B", label: "RQ Slip · Placement", group: "Generators" },
          { href: "/ins/tools/rq-slip/cases", code: "C", label: "RQ Slip · 검수 큐", group: "Generators" },
          { href: "/ins/tools/weekly-dashboard", code: "D", label: "Weekly 대시보드", group: "Analytics" },
          { href: "/ins/tools/ops", code: "E", label: "Operations · 계약관리", group: "Analytics" },
          { href: "/ins/tools/news-insights", code: "F", label: "뉴스 인사이트", group: "Analytics" },
          { href: "/ins/tools/bd", code: "G", label: "영업 발굴", group: "Analytics" },
        ],
      },
      { href: "/ins/chat", code: "06", label: "AI Agent", sublabel: "에이전트" },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        href: "/ins/admin/slip-testbench",
        code: "07",
        label: "Slip Testbench",
        sublabel: "QA 비교",
        children: [
          { href: "/ins/admin/slip-testbench", code: "A", label: "Compare" },
          { href: "/ins/admin/slip-testbench/runs", code: "B", label: "Runs" },
        ],
      },
      {
        href: "/ins/whats-new",
        code: "08",
        label: "What's New",
        sublabel: "업데이트",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-slate-900 text-white min-h-screen flex flex-col border-r border-slate-900">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-baseline justify-between">
          <div className="text-[14px] font-bold tracking-tight">
            InsightRe
          </div>
          <span className="text-[9px] font-mono text-slate-500 tabular-nums">
            v1.0
          </span>
        </div>
        <div className="text-[9px] text-slate-500 uppercase tracking-[0.25em] mt-1">
          Reinsurance Desk
        </div>
      </div>

      <nav className="flex-1 pb-3">
        {navSections.map((section, sIdx) => (
          <div key={section.title} className={sIdx > 0 ? "mt-3" : ""}>
            <div className="px-4 pt-4 pb-1.5">
              <div className="text-[9px] font-bold tracking-[0.3em] uppercase text-slate-600">
                {section.title}
              </div>
            </div>
            <div className="px-2">
              {section.items.map((item) => {
                const isActive = item.children
                  ? pathname === item.href || pathname.startsWith(item.href + "/")
                  : pathname === item.href;
                const isOpen =
                  item.children &&
                  (pathname.startsWith(item.href) ||
                    item.children.some(
                      (c) => pathname === c.href || pathname.startsWith(c.href)
                    ));
                const highlighted = isActive || isOpen;

                return (
                  <div key={item.href} className="mb-px">
                    <Link
                      href={item.children ? item.children[0].href : item.href}
                      className={`group flex items-center gap-2 px-3 py-1.5 border-l-2 transition-colors ${
                        highlighted
                          ? "bg-slate-800 border-red-500 text-white"
                          : "border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                      }`}
                    >
                      <span
                        className={`text-[9px] font-mono tabular-nums w-5 ${
                          highlighted ? "text-red-400" : "text-slate-600"
                        }`}
                      >
                        {item.code}
                      </span>
                      <span className="flex-1 text-[11px] uppercase tracking-[0.12em] font-semibold">
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span
                          className={`text-[9px] ${
                            highlighted ? "text-slate-400" : "text-slate-600"
                          }`}
                        >
                          {item.sublabel}
                        </span>
                      )}
                    </Link>
                    {item.children && isOpen && (
                      <div className="mt-px mb-1">
                        {(() => {
                          const groups: { name: string | null; items: NavChild[] }[] = [];
                          for (const c of item.children) {
                            const g = c.group || null;
                            const last = groups[groups.length - 1];
                            if (last && last.name === g) last.items.push(c);
                            else groups.push({ name: g, items: [c] });
                          }
                          return groups.map((group, gi) => (
                            <div key={gi} className={gi > 0 ? "mt-1.5" : ""}>
                              {group.name && (
                                <div className="pl-5 pr-3 pt-1 pb-0.5 text-[8px] font-bold tracking-[0.25em] uppercase text-slate-600">
                                  {group.name}
                                </div>
                              )}
                              {group.items.map((child) => {
                                const childActive = pathname === child.href;
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    className={`flex items-center gap-2 pl-5 pr-3 py-1 border-l-2 transition-colors ${
                                      childActive
                                        ? "border-red-500 bg-slate-800/60 text-white"
                                        : "border-transparent text-slate-500 hover:text-slate-300"
                                    }`}
                                  >
                                    <span
                                      className={`text-[9px] font-mono w-4 ${
                                        childActive ? "text-red-400" : "text-slate-700"
                                      }`}
                                    >
                                      {child.code || "·"}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-wider">
                                      {child.label}
                                    </span>
                                  </Link>
                                );
                              })}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer meta */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-300">
              INS Insurance
            </div>
            <div className="text-[9px] text-slate-600 mt-0.5 uppercase tracking-wider">
              insightre.ai
            </div>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-slate-500">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"
            ></span>
            <span className="uppercase tracking-wider">Live</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
