import { Redis } from "@upstash/redis";
import { env } from "./env";

const SENT_PREFIX = "trial:sent:";
const DAY9_SENT_PREFIX = "trial:day9-sent:";
const EMAIL_SENT_PREFIX = "trial:email-sent:";

// Short TTL for an in-flight claim: long enough for a single sendMail call,
// short enough that a crashed run releases the lock within minutes so the
// next cron retries. On successful send we overwrite with no TTL (permanent).
const CLAIM_TTL_SECONDS = 300;

function emailKey(appKey: string, email: string): string {
  return `${EMAIL_SENT_PREFIX}${appKey || "any"}:${email.toLowerCase()}`;
}

interface SetOptions {
  nx?: boolean;
  ex?: number;
  px?: number;
}

class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  private evictIfExpired(key: string): void {
    const entry = this.store.get(key);
    if (entry?.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.evictIfExpired(key);
    const entry = this.store.get(key);
    return (entry?.value ?? null) as T | null;
  }

  async set(key: string, value: string, opts?: SetOptions): Promise<"OK" | null> {
    this.evictIfExpired(key);
    if (opts?.nx && this.store.has(key)) return null;
    const expiresAt =
      opts?.ex != null
        ? Date.now() + opts.ex * 1000
        : opts?.px != null
          ? Date.now() + opts.px
          : undefined;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async exists(key: string): Promise<number> {
    this.evictIfExpired(key);
    return this.store.has(key) ? 1 : 0;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

let client: Redis | InMemoryRedis | null = null;

function getClient(): Redis | InMemoryRedis {
  if (client) return client;
  const url = env.upstashUrl();
  const token = env.upstashToken();
  if (url && token) {
    client = new Redis({ url, token });
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
      );
    }
    client = new InMemoryRedis();
  }
  return client;
}

// Test-only: reset the singleton so each test gets a fresh in-memory store.
export function __resetClientForTests(): void {
  client = null;
}

// ---------- Day-1 (welcome) primitives ----------

export async function hasBeenSent(addonLicenseId: string): Promise<boolean> {
  const exists = await getClient().exists(SENT_PREFIX + addonLicenseId);
  return exists === 1;
}

export async function claimSendLock(addonLicenseId: string): Promise<boolean> {
  const result = await getClient().set(
    SENT_PREFIX + addonLicenseId,
    new Date().toISOString(),
    { nx: true, ex: CLAIM_TTL_SECONDS }
  );
  return result === "OK";
}

export async function confirmSent(addonLicenseId: string): Promise<void> {
  await getClient().set(
    SENT_PREFIX + addonLicenseId,
    new Date().toISOString()
  );
}

export async function releaseSendLock(addonLicenseId: string): Promise<void> {
  await getClient().del(SENT_PREFIX + addonLicenseId);
}

// ---------- Day-9 (follow-up) primitives ----------

export async function hasDay9BeenSent(addonLicenseId: string): Promise<boolean> {
  const exists = await getClient().exists(DAY9_SENT_PREFIX + addonLicenseId);
  return exists === 1;
}

export async function claimDay9Lock(addonLicenseId: string): Promise<boolean> {
  const result = await getClient().set(
    DAY9_SENT_PREFIX + addonLicenseId,
    new Date().toISOString(),
    { nx: true, ex: CLAIM_TTL_SECONDS }
  );
  return result === "OK";
}

export async function confirmDay9Sent(addonLicenseId: string): Promise<void> {
  await getClient().set(
    DAY9_SENT_PREFIX + addonLicenseId,
    new Date().toISOString()
  );
}

export async function releaseDay9Lock(addonLicenseId: string): Promise<void> {
  await getClient().del(DAY9_SENT_PREFIX + addonLicenseId);
}

// ---------- Per-email cross-license dedupe ----------

export async function hasEmailBeenSent(appKey: string, email: string): Promise<boolean> {
  if (!email) return false;
  const exists = await getClient().exists(emailKey(appKey, email));
  return exists === 1;
}

export async function markEmailSent(appKey: string, email: string): Promise<void> {
  if (!email) return;
  await getClient().set(emailKey(appKey, email), new Date().toISOString());
}
