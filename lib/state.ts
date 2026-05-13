import { Redis } from "@upstash/redis";
import { env } from "./env";

const SENT_PREFIX = "trial:sent:";
const EMAIL_SENT_PREFIX = "trial:email-sent:";
const WATERMARK_KEY = "trial:watermark";

function emailKey(appKey: string, email: string): string {
  return `${EMAIL_SENT_PREFIX}${appKey || "any"}:${email.toLowerCase()}`;
}

class InMemoryRedis {
  private store = new Map<string, string>();
  async get<T>(key: string): Promise<T | null> {
    const v = this.store.get(key);
    return (v ?? null) as T | null;
  }
  async set(key: string, value: string): Promise<"OK"> {
    this.store.set(key, value);
    return "OK";
  }
  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
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

export async function hasBeenSent(addonLicenseId: string): Promise<boolean> {
  const exists = await getClient().exists(SENT_PREFIX + addonLicenseId);
  return exists === 1;
}

export async function markSent(addonLicenseId: string): Promise<void> {
  await getClient().set(
    SENT_PREFIX + addonLicenseId,
    new Date().toISOString()
  );
}

export async function hasEmailBeenSent(appKey: string, email: string): Promise<boolean> {
  if (!email) return false;
  const exists = await getClient().exists(emailKey(appKey, email));
  return exists === 1;
}

export async function markEmailSent(appKey: string, email: string): Promise<void> {
  if (!email) return;
  await getClient().set(emailKey(appKey, email), new Date().toISOString());
}

export async function getWatermark(): Promise<string | null> {
  return await getClient().get<string>(WATERMARK_KEY);
}

export async function setWatermark(iso: string): Promise<void> {
  await getClient().set(WATERMARK_KEY, iso);
}
