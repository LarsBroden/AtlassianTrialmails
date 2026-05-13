"use client";

import type { StatusFilter } from "@/lib/types";

interface Props {
  excludePartners: boolean;
  onExcludePartnersChange: (v: boolean) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
}

export function FilterControls({
  excludePartners,
  onExcludePartnersChange,
  statusFilter,
  onStatusFilterChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white p-4">
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={excludePartners}
          onChange={(e) => onExcludePartnersChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Exclude partner / reseller domains
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        Status
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All</option>
        </select>
      </label>
    </div>
  );
}
