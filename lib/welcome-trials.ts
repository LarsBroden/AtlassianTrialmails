import { fetchEvaluationLicenses, classifyTrial, type TrialLicense, type RejectReason } from "./marketplace";
import {
  hasBeenSent,
  claimSendLock,
  confirmSent,
  releaseSendLock,
  hasEmailBeenSent,
  markEmailSent,
  getWatermark,
  setWatermark,
} from "./state";
import { renderHtml, renderText, SUBJECT } from "./template";
import { sendMail } from "./graph";
import { env } from "./env";

export interface RunSummary {
  dryRun: boolean;
  fetched: number;
  rejected: number;
  rejectedByReason: Record<string, number>;
  alreadySent: number;
  attempted: number;
  sent: number;
  failed: number;
  watermark: { from: string | null; to: string | null };
  results: Array<{
    licenseId: string;
    email: string;
    company: string;
    status: "sent" | "dry-run" | "already-sent" | "already-emailed" | "rejected" | "failed";
    reason?: RejectReason | string;
    error?: string;
  }>;
}

function firstName(fullName: string): string {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return "";
  const i = trimmed.search(/\s+/);
  return i < 0 ? trimmed : trimmed.slice(0, i);
}

function isoDateMinusOneDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function runWelcomeTrials(): Promise<RunSummary> {
  const dryRun = env.dryRun();
  const lookbackDays = env.newTrialLookbackDays();
  const now = new Date();

  const watermark = await getWatermark();
  const lastUpdatedFrom = watermark
    ?? new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

  const licenses = await fetchEvaluationLicenses({ lastUpdatedFrom });
  const summary: RunSummary = {
    dryRun,
    fetched: licenses.length,
    rejected: 0,
    rejectedByReason: {},
    alreadySent: 0,
    attempted: 0,
    sent: 0,
    failed: 0,
    watermark: { from: watermark, to: watermark },
    results: [],
  };

  let maxSuccessDate = watermark ?? "";
  let earliestFailedDate: string | undefined;

  const noteSuccess = (license: TrialLicense) => {
    if (license.lastUpdated && license.lastUpdated > maxSuccessDate) {
      maxSuccessDate = license.lastUpdated;
    }
  };
  const noteFailure = (license: TrialLicense) => {
    if (
      license.lastUpdated &&
      (!earliestFailedDate || license.lastUpdated < earliestFailedDate)
    ) {
      earliestFailedDate = license.lastUpdated;
    }
  };

  for (const license of licenses) {
    const classification = classifyTrial(license, { lookbackDays, now });
    if (!classification.ok) {
      summary.rejected++;
      summary.rejectedByReason[classification.reason] =
        (summary.rejectedByReason[classification.reason] ?? 0) + 1;
      summary.results.push({
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: "rejected",
        reason: classification.reason,
      });
      noteSuccess(license);
      continue;
    }

    // In dry-run we want a read-only check; in live we want an atomic claim
    // so two overlapping runs can't both send the same license.
    let claimed = false;
    if (dryRun) {
      if (await hasBeenSent(license.addonLicenseId)) {
        summary.alreadySent++;
        summary.results.push({
          licenseId: license.addonLicenseId,
          email: license.contactEmail,
          company: license.company,
          status: "already-sent",
        });
        noteSuccess(license);
        continue;
      }
    } else {
      claimed = await claimSendLock(license.addonLicenseId);
      if (!claimed) {
        summary.alreadySent++;
        summary.results.push({
          licenseId: license.addonLicenseId,
          email: license.contactEmail,
          company: license.company,
          status: "already-sent",
        });
        noteSuccess(license);
        continue;
      }
    }

    if (await hasEmailBeenSent(license.appKey, license.contactEmail)) {
      if (claimed) await releaseSendLock(license.addonLicenseId);
      summary.alreadySent++;
      summary.results.push({
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: "already-emailed",
      });
      noteSuccess(license);
      continue;
    }

    summary.attempted++;
    try {
      await sendOneWelcome(license, dryRun);
      if (!dryRun) {
        await confirmSent(license.addonLicenseId);
        await markEmailSent(license.appKey, license.contactEmail);
      }
      summary.sent++;
      summary.results.push({
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: dryRun ? "dry-run" : "sent",
      });
      noteSuccess(license);
    } catch (err) {
      if (claimed) await releaseSendLock(license.addonLicenseId);
      summary.failed++;
      summary.results.push({
        licenseId: license.addonLicenseId,
        email: license.contactEmail,
        company: license.company,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
      noteFailure(license);
    }
  }

  // Compute the new watermark. Never advance past any failed license so a
  // transient failure gets retried on the next run instead of being lost.
  let newWatermark = maxSuccessDate;
  if (earliestFailedDate) {
    const safeBoundary = isoDateMinusOneDay(earliestFailedDate);
    if (newWatermark > safeBoundary) newWatermark = safeBoundary;
  }

  if (!dryRun && newWatermark && newWatermark !== watermark) {
    await setWatermark(newWatermark);
    summary.watermark.to = newWatermark;
  }

  return summary;
}

async function sendOneWelcome(license: TrialLicense, dryRun: boolean): Promise<void> {
  const input = {
    firstName: firstName(license.contactName),
    company: license.company,
    trialEndDate: license.maintenanceEndDate,
  };
  const html = renderHtml(input);
  const text = renderText(input);
  if (dryRun) {
    console.log(
      `[dry-run] would send welcome to ${license.contactEmail} (license ${license.addonLicenseId}, company "${license.company}", trial end ${license.maintenanceEndDate})`
    );
    return;
  }
  await sendMail({
    toEmail: license.contactEmail,
    toName: license.contactName || undefined,
    subject: SUBJECT,
    html,
    text,
  });
}
