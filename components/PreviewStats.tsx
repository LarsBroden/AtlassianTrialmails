"use client";

import type { ProcessStats } from "@/lib/types";

interface Props {
  stats: ProcessStats;
  selectedCount: number;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

export function PreviewStats({ stats, selectedCount }: Props) {
  const cloudCount = stats.byHosting["Cloud"] ?? stats.byHosting["cloud"] ?? 0;
  const cloudPct = stats.totalTransactions
    ? Math.round((cloudCount / stats.totalTransactions) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Transactions" value={stats.totalTransactions} />
        <StatCard label="Unique cloud emails" value={stats.uniqueEmails} />
        <StatCard label="Cloud share" value={`${cloudPct}%`} />
        <StatCard label="Partner emails flagged" value={stats.flaggedPartnerCount} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
        <span className="font-medium text-slate-700">By hosting:</span>
        {Object.entries(stats.byHosting).map(([h, n]) => (
          <span key={h} className="tabular-nums">
            {h} <span className="font-medium text-slate-900">{n}</span>
          </span>
        ))}
        <span className="ml-auto text-slate-500">
          Selected for outreach: <span className="font-medium text-slate-900 tabular-nums">{selectedCount}</span>
        </span>
      </div>
    </div>
  );
}
