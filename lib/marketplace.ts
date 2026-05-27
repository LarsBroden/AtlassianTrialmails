import { env } from "./env";
import { isPartnerEmail } from "./partners";

const NON_PROSPECT_LICENSE_TYPES = new Set([
  "OPEN_SOURCE",
  "COMMUNITY",
  "DEVELOPER",
  "ACADEMIC",
  "CLASSROOM",
  "PERSONAL",
  "STARTER",
]);

// Atlassian-affiliated email domains we never want to email. Includes the
// obvious @atlassian.com plus Bugcrowd's alias domain used by security
// researchers in Atlassian's bug bounty program (they install Marketplace
// apps to look for vulnerabilities — not prospects).
const ATLASSIAN_AFFILIATED_DOMAINS = new Set<string>([
  "atlassian.com",
  "bugcrowdninja.com",
]);

function isAtlassianInternalEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return (
    ATLASSIAN_AFFILIATED_DOMAINS.has(domain) || domain.endsWith(".atlassian.com")
  );
}

// Company-name patterns that indicate a test / sandbox / internal Jira tenant
// rather than a real prospect. Tested case-insensitively against the company
// field. Word-boundary anchors (^/-/$) keep false positives down so that real
// company names like "Testify" or "Internal Plumbing" aren't accidentally
// matched.
const NON_PROSPECT_COMPANY_PATTERNS: ReadonlyArray<RegExp> = [
  /bugbounty/i,
  /sandbox/i,
  /(^|-)test(-|$)/i,
  /(^|-)internal(-|$)/i,
];

function isNonProspectCompany(company: string): boolean {
  const trimmed = company.trim();
  if (!trimmed) return false;
  return NON_PROSPECT_COMPANY_PATTERNS.some((p) => p.test(trimmed));
}

export interface TrialLicense {
  addonLicenseId: string;
  appKey: string;
  hosting: string;
  licenseType: string;
  tier: string;
  status: string;
  maintenanceStartDate: string;
  maintenanceEndDate: string;
  lastUpdated: string;
  contactEmail: string;
  contactName: string;
  company: string;
}

interface MarketplaceContact {
  name?: string;
  email?: string;
}

interface MarketplaceLicenseRaw {
  addonLicenseId?: string;
  appEntitlementId?: string;
  appKey?: string;
  hosting?: string;
  licenseType?: string;
  tier?: string;
  status?: string;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  lastUpdated?: string;
  contactDetails?: {
    company?: string;
    technicalContact?: MarketplaceContact;
    billingContact?: MarketplaceContact;
  };
}

interface MarketplacePage {
  licenses: MarketplaceLicenseRaw[];
  _links?: { next?: { href?: string } };
}

const MARKETPLACE_BASE = "https://marketplace.atlassian.com";

function authHeader(): string {
  const credentials = `${env.marketplaceUserEmail()}:${env.marketplaceApiToken()}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

export function normalizeLicense(raw: MarketplaceLicenseRaw): TrialLicense | null {
  const id = raw.addonLicenseId ?? raw.appEntitlementId ?? "";
  if (!id) return null;
  const tech = raw.contactDetails?.technicalContact ?? {};
  const billing = raw.contactDetails?.billingContact ?? {};
  const contactEmail = (tech.email || billing.email || "").toLowerCase();
  if (!contactEmail) return null;
  return {
    addonLicenseId: id,
    appKey: raw.appKey ?? "",
    hosting: raw.hosting ?? "",
    licenseType: (raw.licenseType ?? "").toUpperCase(),
    tier: raw.tier ?? "",
    status: raw.status ?? "",
    maintenanceStartDate: raw.maintenanceStartDate ?? "",
    maintenanceEndDate: raw.maintenanceEndDate ?? "",
    lastUpdated: raw.lastUpdated ?? "",
    contactEmail,
    contactName: tech.name || billing.name || "",
    company: raw.contactDetails?.company ?? "",
  };
}

export type RejectReason =
  | "not-evaluation"
  | "not-cloud"
  | "inactive"
  | "atlassian-internal"
  | "partner-domain"
  | "non-prospect-type"
  | "non-prospect-company"
  | "missing-company"
  | "missing-email"
  | "missing-start-date"
  | "outside-lookback-window";

export interface NewTrialOptions {
  lookbackDays?: number;
  now?: Date;
}

export function classifyTrial(
  license: TrialLicense,
  opts: NewTrialOptions = {}
): { ok: true } | { ok: false; reason: RejectReason } {
  if (license.licenseType !== "EVALUATION") return { ok: false, reason: "not-evaluation" };
  if (license.hosting.toLowerCase() !== "cloud") return { ok: false, reason: "not-cloud" };

  const status = license.status.toLowerCase();
  if (status && status !== "active") return { ok: false, reason: "inactive" };

  if (NON_PROSPECT_LICENSE_TYPES.has(license.licenseType)) {
    return { ok: false, reason: "non-prospect-type" };
  }

  if (!license.contactEmail) return { ok: false, reason: "missing-email" };
  if (isAtlassianInternalEmail(license.contactEmail)) {
    return { ok: false, reason: "atlassian-internal" };
  }
  if (isPartnerEmail(license.contactEmail)) {
    return { ok: false, reason: "partner-domain" };
  }

  if (!license.company.trim()) return { ok: false, reason: "missing-company" };
  if (isNonProspectCompany(license.company)) {
    return { ok: false, reason: "non-prospect-company" };
  }

  if (!license.maintenanceStartDate) {
    return { ok: false, reason: "missing-start-date" };
  }
  const startMs = Date.parse(license.maintenanceStartDate);
  if (!Number.isFinite(startMs)) {
    return { ok: false, reason: "missing-start-date" };
  }
  const now = opts.now ?? new Date();
  const lookbackDays = opts.lookbackDays ?? 7;
  const cutoff = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  if (startMs < cutoff) return { ok: false, reason: "outside-lookback-window" };

  return { ok: true };
}

export function isNewTrial(license: TrialLicense, opts?: NewTrialOptions): boolean {
  return classifyTrial(license, opts).ok;
}

export async function fetchEvaluationLicenses(opts: {
  lastUpdatedFrom?: string;
} = {}): Promise<TrialLicense[]> {
  const vendorId = env.marketplaceVendorId();
  const appKey = env.marketplaceAppKey();
  const params = new URLSearchParams();
  params.set("licenseType", "EVALUATION");
  if (opts.lastUpdatedFrom) params.set("lastUpdated", opts.lastUpdatedFrom);
  if (appKey) params.set("addon", appKey);

  let url: string | undefined = `${MARKETPLACE_BASE}/rest/2/vendors/${vendorId}/reporting/licenses?${params}`;
  const results: TrialLicense[] = [];

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: authHeader(), Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Marketplace API ${res.status}: ${body.slice(0, 200)}`
      );
    }
    const page = (await res.json()) as MarketplacePage;
    for (const raw of page.licenses ?? []) {
      const license = normalizeLicense(raw);
      if (license) results.push(license);
    }
    const nextHref = page._links?.next?.href;
    url = nextHref ? `${MARKETPLACE_BASE}${nextHref}` : undefined;
  }

  return results;
}
