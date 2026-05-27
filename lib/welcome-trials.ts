import {
  fetchEvaluationLicenses,
  classifyTrial,
  type TrialLicense,
  type RejectReason,
} from "./marketplace";
import {
  claimSendLock,
  confirmSent,
  releaseSendLock,
  hasBeenSent,
  hasEmailBeenSent,
  markEmailSent,
  claimDay9Lock,
  confirmDay9Sent,
  releaseDay9Lock,
  hasDay9BeenSent,
} from "./state";
import { renderHtml, renderText, subjectFor, type TemplateKind } from "./template";
import { sendMail } from "./graph";
import { env } from "./env";

type ResultStatus =
  | "sent"
  | "dry-run"
  | "already-sent"
  | "already-emailed"
  | "rejected"
  | "not-eligible"
  | "failed";

export interface PassSummary {
  considered: number;
  rejected: number;
  rejectedByReason: Record<string, number>;
  alreadySent: number;
  attempted: number;
  sent: number;
  failed: number;
}

export interface RunSummary {
  dryRun: boolean;
  fetched: number;
  day1: PassSummary;
  day9: PassSummary;
  results: Array<{
    pass: "day1" | "day9";
    licenseId: string;
    email: string;
    company: string;
    status: ResultStatus;
    reason?: RejectReason | string;
    error?: string;
  }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Window we always fetch from the Marketplace API — large enough that day-9
// candidates (started 9-30 days ago) are guaranteed to appear in the result.
const FETCH_LOOKBACK_DAYS = 30;
// Cap on how old a trial can be before we stop offering a day-9 check-in.
// Prevents back-filling welcomes to trials that started long before the
// system was deployed.
const DAY9_MAX_AGE_DAYS = 30;

function emptyPassSummary(): PassSummary {
  return {
    considered: 0,
    rejected: 0,
    rejectedByReason: {},
    alreadySent: 0,
    attempted: 0,
    sent: 0,
    failed: 0,
  };
}

function ageInDays(startIso: string, now: Date): number | null {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return null;
  return (now.getTime() - start) / DAY_MS;
}

function isDay9Eligible(license: TrialLicense, now: Date): { ok: true } | { ok: false; reason: string } {
  if (!license.contactEmail) return { ok: false, reason: "missing-email" };
  const age = ageInDays(license.maintenanceStartDate, now);
  if (age == null) return { ok: false, reason: "missing-start-date" };
  if (age < 9) return { ok: false, reason: "too-early" };
  if (age > DAY9_MAX_AGE_DAYS) return { ok: false, reason: "too-old" };

  const status = license.status.toLowerCase();
  if (status && status !== "active") return { ok: false, reason: "inactive" };

  if (license.maintenanceEndDate) {
    const end = Date.parse(license.maintenanceEndDate);
    if (Number.isFinite(end) && end < now.getTime()) {
      return { ok: false, reason: "trial-ended" };
    }
  }
  return { ok: true };
}

export async function runWelcomeTrials(): Promise<RunSummary> {
  const dryRun = env.dryRun();
  const lookbackDays = env.newTrialLookbackDays();
  const now = new Date();

  // One fetch per cron run, wide enough to cover both day-1 and day-9 candidates.
  const lastUpdatedFrom = new Date(now.getTime() - FETCH_LOOKBACK_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);

  const licenses = await fetchEvaluationLicenses({ lastUpdatedFrom });

  const summary: RunSummary = {
    dryRun,
    fetched: licenses.length,
    day1: emptyPassSummary(),
    day9: emptyPassSummary(),
    results: [],
  };

  // ---------- Day-1 pass ----------
  for (const license of licenses) {
    summary.day1.considered++;
    const classification = classifyTrial(license, { lookbackDays, now });
    if (!classification.ok) {
      summary.day1.rejected++;
      summary.day1.rejectedByReason[classification.reason] =
        (summary.day1.rejectedByReason[classification.reason] ?? 0) + 1;
      summary.results.push({
        pass: "day1",
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: "rejected",
        reason: classification.reason,
      });
      continue;
    }

    // Atomic claim in live mode; read-only check in dry-run.
    let claimed = false;
    if (dryRun) {
      if (await hasBeenSent(license.addonLicenseId)) {
        summary.day1.alreadySent++;
        summary.results.push({
          pass: "day1",
          licenseId: license.addonLicenseId,
          email: license.contactEmail,
          company: license.company,
          status: "already-sent",
        });
        continue;
      }
    } else {
      claimed = await claimSendLock(license.addonLicenseId);
      if (!claimed) {
        summary.day1.alreadySent++;
        summary.results.push({
          pass: "day1",
          licenseId: license.addonLicenseId,
          email: license.contactEmail,
          company: license.company,
          status: "already-sent",
        });
        continue;
      }
    }

    if (await hasEmailBeenSent(license.appKey, license.contactEmail)) {
      if (claimed) await releaseSendLock(license.addonLicenseId);
      summary.day1.alreadySent++;
      summary.results.push({
        pass: "day1",
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: "already-emailed",
      });
      continue;
    }

    summary.day1.attempted++;
    try {
      await sendOne(license, "day1", dryRun);
      if (!dryRun) {
        await confirmSent(license.addonLicenseId);
        await markEmailSent(license.appKey, license.contactEmail);
      }
      summary.day1.sent++;
      summary.results.push({
        pass: "day1",
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: dryRun ? "dry-run" : "sent",
      });
    } catch (err) {
      if (claimed) await releaseSendLock(license.addonLicenseId);
      summary.day1.failed++;
      summary.results.push({
        pass: "day1",
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ---------- Day-9 pass ----------
  // Only considers licenses where day-1 was previously sent. This ensures
  // continuity: a recipient gets the welcome first, then the check-in. Trials
  // that started before the system existed (no day-1 record) are skipped.
  for (const license of licenses) {
    summary.day9.considered++;

    const eligibility = isDay9Eligible(license, now);
    if (!eligibility.ok) {
      summary.day9.rejected++;
      summary.day9.rejectedByReason[eligibility.reason] =
        (summary.day9.rejectedByReason[eligibility.reason] ?? 0) + 1;
      summary.results.push({
        pass: "day9",
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: "not-eligible",
        reason: eligibility.reason,
      });
      continue;
    }

    // Gate: must have received the day-1 welcome first.
    if (!(await hasBeenSent(license.addonLicenseId))) {
      summary.day9.rejected++;
      summary.day9.rejectedByReason["no-day1-record"] =
        (summary.day9.rejectedByReason["no-day1-record"] ?? 0) + 1;
      summary.results.push({
        pass: "day9",
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: "not-eligible",
        reason: "no-day1-record",
      });
      continue;
    }

    let claimed = false;
    if (dryRun) {
      if (await hasDay9BeenSent(license.addonLicenseId)) {
        summary.day9.alreadySent++;
        summary.results.push({
          pass: "day9",
          licenseId: license.addonLicenseId,
          email: license.contactEmail,
          company: license.company,
          status: "already-sent",
        });
        continue;
      }
    } else {
      claimed = await claimDay9Lock(license.addonLicenseId);
      if (!claimed) {
        summary.day9.alreadySent++;
        summary.results.push({
          pass: "day9",
          licenseId: license.addonLicenseId,
          email: license.contactEmail,
          company: license.company,
          status: "already-sent",
        });
        continue;
      }
    }

    summary.day9.attempted++;
    try {
      await sendOne(license, "day9", dryRun);
      if (!dryRun) await confirmDay9Sent(license.addonLicenseId);
      summary.day9.sent++;
      summary.results.push({
        pass: "day9",
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: dryRun ? "dry-run" : "sent",
      });
    } catch (err) {
      if (claimed) await releaseDay9Lock(license.addonLicenseId);
      summary.day9.failed++;
      summary.results.push({
        pass: "day9",
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}

async function sendOne(license: TrialLicense, kind: TemplateKind, dryRun: boolean): Promise<void> {
  const html = renderHtml(kind);
  const text = renderText(kind);
  const subject = subjectFor(kind);
  if (dryRun) {
    console.log(
      `[dry-run/${kind}] would send to ${license.contactEmail} (license ${license.addonLicenseId}, company "${license.company}", trial end ${license.maintenanceEndDate})`
    );
    return;
  }
  await sendMail({
    toEmail: license.contactEmail,
    toName: license.contactName || undefined,
    subject,
    html,
    text,
  });
}
