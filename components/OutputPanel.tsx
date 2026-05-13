"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Contact } from "@/lib/types";

interface Props {
  contacts: Contact[];
}

const CSV_HEADERS = [
  "FirstName",
  "LastName",
  "Email",
  "Company",
  "HostingType",
  "Status",
  "InstallDate",
  "DisplayName",
] as const;

function csvEscape(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(contacts: Contact[]): string {
  const lines: string[] = [CSV_HEADERS.join(",")];
  for (const c of contacts) {
    lines.push(
      [
        c.firstName,
        c.lastName,
        c.email,
        c.company,
        c.hostingType,
        c.status,
        c.installDate,
        c.displayName,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\r\n");
}

export function OutputPanel({ contacts }: Props) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const bcc = useMemo(() => contacts.map((c) => c.email).join("; "), [contacts]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bcc);
      } else if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand("copy");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — textarea is selectable as a fallback
    }
  };

  const handleDownload = () => {
    const csv = buildCsv(contacts);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `marketplace-contacts-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const empty = contacts.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">
            BCC list ({contacts.length} email{contacts.length === 1 ? "" : "s"})
          </label>
          <button
            onClick={handleCopy}
            disabled={empty}
            className={clsx(
              "rounded-md px-4 py-2 text-sm font-medium transition",
              empty
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : copied
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            {copied ? "Copied" : "Copy BCC list"}
          </button>
        </div>
        <textarea
          ref={textareaRef}
          readOnly
          value={bcc}
          placeholder="No contacts match the current filters."
          className="w-full h-32 resize-y rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-500">
          Paste the BCC list into Outlook. Send as BCC so recipients don&apos;t see each other.
        </p>
        <button
          onClick={handleDownload}
          disabled={empty}
          className={clsx(
            "rounded-md border px-3 py-2 text-sm font-medium transition",
            empty
              ? "border-slate-200 text-slate-400 cursor-not-allowed"
              : "border-slate-300 text-slate-700 hover:bg-slate-50"
          )}
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}
