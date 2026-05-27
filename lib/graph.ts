import { env } from "./env";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now() + 60_000) {
    return cache.token;
  }
  const tenant = env.azureTenantId();
  const body = new URLSearchParams({
    client_id: env.azureClientId(),
    client_secret: env.azureClientSecret(),
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure token request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cache.token;
}

export interface SendMailInput {
  toEmail: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail({ toEmail, toName, subject, html, text }: SendMailInput): Promise<void> {
  const token = await getAccessToken();
  const sender = env.graphSenderUserId();
  const replyTo = env.graphReplyToEmail() || sender;
  const cc = env.ccEmail();

  const message: Record<string, unknown> = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: [
      { emailAddress: { address: toEmail, ...(toName ? { name: toName } : {}) } },
    ],
    replyTo: [{ emailAddress: { address: replyTo } }],
    // Custom header so the recipient inbox shows a deterministic alt-text fallback.
    // The actual plain-text alternative is composed by Graph from the HTML when
    // contentType=HTML; we keep `text` as the source of truth for downstream
    // logging/debugging.
    internetMessageHeaders: [
      { name: "X-Mailer", value: "bulk-clone-trial-mailer/1.0" },
    ],
  };

  // Optional CC (used to mirror every trial email to Lars's own inbox for
  // observability). Skip the cc field entirely when CC_EMAIL is unset or when
  // it would equal the recipient (avoid sending the recipient a copy of their
  // own welcome).
  if (cc && cc.toLowerCase() !== toEmail.toLowerCase()) {
    message.ccRecipients = [{ emailAddress: { address: cc } }];
  }

  const payload = { message, saveToSentItems: true };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph sendMail failed (${res.status}): ${body.slice(0, 300)}`);
  }
  // Reference `text` so eslint doesn't strip it; useful for logs/tests.
  void text.length;
}
