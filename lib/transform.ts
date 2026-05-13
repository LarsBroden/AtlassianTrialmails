import type { Contact, ContactSource, ContactStatus, ProcessResult } from "./types";
import { isPartnerEmail } from "./partners";
import type { CsvRow } from "./parseCsv";

const normalizeKey = (k: string) => k.toLowerCase().replace(/[\s_-]/g, "");

function makeResolver(row: CsvRow) {
  const lookup = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    lookup.set(normalizeKey(k), v ?? "");
  }
  return (...candidates: string[]) => {
    for (const c of candidates) {
      const v = lookup.get(normalizeKey(c));
      if (v !== undefined && v !== "") return v;
    }
    return "";
  };
}

function splitName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const idx = trimmed.search(/\s+/);
  if (idx < 0) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx).trim(),
  };
}

function deriveStatus(statusRaw: string, maintenanceEndDate: string): ContactStatus {
  if (statusRaw) {
    return statusRaw.toLowerCase() === "active" ? "active" : "inactive";
  }
  const end = Date.parse(maintenanceEndDate);
  if (Number.isFinite(end)) {
    return end >= Date.now() ? "active" : "inactive";
  }
  return "inactive";
}

function isCloud(hosting: string): boolean {
  return hosting.toLowerCase() === "cloud";
}

export function transformRows(rows: CsvRow[]): ProcessResult {
  const byHosting: Record<string, number> = {};
  for (const row of rows) {
    const get = makeResolver(row);
    const hosting = get("hosting") || "Unknown";
    byHosting[hosting] = (byHosting[hosting] ?? 0) + 1;
  }

  const byEmail = new Map<string, Contact>();
  let flaggedPartnerCount = 0;

  const upsert = (c: Contact) => {
    const key = c.email.toLowerCase();
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, c);
      if (c.isPartner) flaggedPartnerCount++;
      return;
    }
    if (existing.source === "billing" && c.source === "technical") {
      byEmail.set(key, c);
    }
  };

  for (const row of rows) {
    const get = makeResolver(row);
    const hosting = get("hosting");
    if (!isCloud(hosting)) continue;

    const statusRaw = get("status", "licenseStatus");
    const maintenanceEndDate = get("maintenanceEndDate");
    const installDate =
      get("maintenanceStartDate", "installDate", "startDate") || "";
    const status = deriveStatus(statusRaw, maintenanceEndDate);

    const techEmail = get("technicalContactEmail").toLowerCase();
    if (techEmail) {
      const displayName = get("technicalContactName");
      const { firstName, lastName } = splitName(displayName);
      upsert({
        email: techEmail,
        firstName,
        lastName,
        displayName,
        company: get("technicalContactCompany", "company"),
        hostingType: hosting || "Cloud",
        status,
        installDate,
        isPartner: isPartnerEmail(techEmail),
        source: "technical" as ContactSource,
      });
    }

    const billEmail = get("billingContactEmail").toLowerCase();
    if (billEmail && billEmail !== techEmail) {
      const displayName = get("billingContactName");
      const { firstName, lastName } = splitName(displayName);
      upsert({
        email: billEmail,
        firstName,
        lastName,
        displayName,
        company: get("billingContactCompany", "company"),
        hostingType: hosting || "Cloud",
        status,
        installDate,
        isPartner: isPartnerEmail(billEmail),
        source: "billing" as ContactSource,
      });
    }
  }

  const contacts = Array.from(byEmail.values()).sort((a, b) =>
    a.email.localeCompare(b.email)
  );

  return {
    stats: {
      totalTransactions: rows.length,
      uniqueEmails: contacts.length,
      byHosting,
      flaggedPartnerCount,
    },
    contacts,
  };
}
