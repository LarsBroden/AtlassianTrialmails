/**
 * Forge handlers that trigger the welcome-trial webhook on app install.
 *
 * Wiring:
 *   1. avi:forge:installed:app fires when a Jira admin installs the app
 *   2. handleInstall enqueues a delayed task (60s) to give the Marketplace
 *      REST API time to reflect the new license record
 *   3. welcomeConsumer fires from the queue and POSTs to the Vercel endpoint
 *      with a shared-secret Bearer token
 *
 * Required Forge environment variables:
 *   WELCOME_WEBHOOK_URL    — full URL of the Vercel /api/lifecycle/installed
 *   WELCOME_WEBHOOK_SECRET — must match FORGE_WEBHOOK_SECRET on Vercel
 *
 * Non-production environments (development, staging) skip the trigger so
 * test installs don't email anyone.
 */

import { Queue } from "@forge/events";

const queue = new Queue({ key: "trial-welcome" });

interface ForgeContext {
  cloudId?: string;
  accountId?: string;
  environmentType?: "development" | "staging" | "production";
}

interface InstallPayload {
  cloudId?: string;
  accountId?: string;
  installedAt: string;
  environment?: string;
}

export const handleInstall = async (
  event: unknown,
  context: ForgeContext
): Promise<void> => {
  if (context?.environmentType !== "production") {
    console.log(
      `[trial-welcome] skipping install trigger in env="${context?.environmentType ?? "unknown"}"`
    );
    return;
  }

  const payload: InstallPayload = {
    cloudId: context.cloudId,
    accountId: context.accountId,
    installedAt: new Date().toISOString(),
    environment: context.environmentType,
  };

  // 60-second delay closes the race between this event and the Marketplace
  // REST API reflecting the new license record.
  await queue.push(payload, { delayInSeconds: 60 });
  console.log(
    `[trial-welcome] enqueued welcome (cloudId=${payload.cloudId ?? "-"}, +60s)`
  );
};

export const welcomeConsumer = async ({
  payload,
}: {
  payload: InstallPayload;
}): Promise<void> => {
  const url = process.env.WELCOME_WEBHOOK_URL;
  const secret = process.env.WELCOME_WEBHOOK_SECRET;

  if (!url || !secret) {
    console.warn(
      "[trial-welcome] WELCOME_WEBHOOK_URL or WELCOME_WEBHOOK_SECRET not configured; skipping"
    );
    return;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    // Throwing causes Forge to retry per its queue retry policy.
    throw new Error(
      `welcome webhook returned ${res.status}: ${body.slice(0, 200)}`
    );
  }

  console.log(
    `[trial-welcome] webhook ok (cloudId=${payload.cloudId ?? "-"})`
  );
};
