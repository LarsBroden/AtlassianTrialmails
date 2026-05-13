function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function optional(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export const env = {
  // Marketplace
  marketplaceVendorId: () => required("MARKETPLACE_VENDOR_ID"),
  marketplaceUserEmail: () => required("MARKETPLACE_USER_EMAIL"),
  marketplaceApiToken: () => required("MARKETPLACE_API_TOKEN"),
  marketplaceAppKey: () => optional("MARKETPLACE_APP_KEY"),

  // Microsoft Graph (client credentials)
  azureTenantId: () => required("AZURE_TENANT_ID"),
  azureClientId: () => required("AZURE_CLIENT_ID"),
  azureClientSecret: () => required("AZURE_CLIENT_SECRET"),
  graphSenderUserId: () => required("GRAPH_SENDER_USER_ID"),
  graphReplyToEmail: () => optional("GRAPH_REPLY_TO_EMAIL"),

  // Upstash Redis (set automatically by Vercel Marketplace integration)
  upstashUrl: () => optional("UPSTASH_REDIS_REST_URL"),
  upstashToken: () => optional("UPSTASH_REDIS_REST_TOKEN"),

  // Operational
  dryRun: () => optional("DRY_RUN", "true").toLowerCase() === "true",
  cronSecret: () => optional("CRON_SECRET"),
  forgeWebhookSecret: () => optional("FORGE_WEBHOOK_SECRET"),
  newTrialLookbackDays: () => {
    const v = parseInt(optional("NEW_TRIAL_LOOKBACK_DAYS", "7"), 10);
    return Number.isFinite(v) && v > 0 ? v : 7;
  },

  // Template links
  calendarUrl: () => optional("CALENDAR_URL", "https://calendly.com/lbconsultinggroup/15min"),
  docsUrl: () => optional("DOCS_URL", "https://marketplace.atlassian.com/apps/1213028"),
  quickstartUrl: () => optional("QUICKSTART_URL", "https://marketplace.atlassian.com/apps/1213028"),
};
