"use client";

import { useMemo, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { PreviewStats } from "@/components/PreviewStats";
import { FilterControls } from "@/components/FilterControls";
import { OutputPanel } from "@/components/OutputPanel";
import type {
  Contact,
  ProcessResult,
  ProcessError,
  StatusFilter,
} from "@/lib/types";

const MAX_BYTES = 4 * 1024 * 1024;

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [excludePartners, setExcludePartners] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const handleFile = async (file: File) => {
    setError(null);
    if (!/\.csv$/i.test(file.name)) {
      setError("File must be a .csv");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — limit is 4 MB.`
      );
      return;
    }

    setBusy(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/process-csv", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const data = (await res.json()) as ProcessResult | ProcessError;
      if (!res.ok || "error" in data) {
        setError(("error" in data && data.error) || "Failed to process file.");
        setResult(null);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const filtered: Contact[] = useMemo(() => {
    if (!result) return [];
    return result.contacts.filter((c) => {
      if (excludePartners && c.isPartner) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [result, excludePartners, statusFilter]);

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Marketplace Review Outreach
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Drop your Atlassian Marketplace transactions CSV. Get a deduplicated BCC list of Cloud customers.
        </p>
      </header>

      {!result && (
        <DropZone onFile={handleFile} disabled={busy} />
      )}

      {busy && (
        <div className="mt-4 text-sm text-slate-600">Processing CSV…</div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-700">Results</h2>
            <button
              onClick={reset}
              className="text-sm text-slate-600 underline hover:text-slate-900"
            >
              Process another file
            </button>
          </div>
          <PreviewStats stats={result.stats} selectedCount={filtered.length} />
          <FilterControls
            excludePartners={excludePartners}
            onExcludePartnersChange={setExcludePartners}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
          <OutputPanel contacts={filtered} />
        </div>
      )}

      <footer className="mt-12 text-xs text-slate-400">
        Cloud licenses only. Data is processed in-memory and never stored.
      </footer>
    </main>
  );
}
