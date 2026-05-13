import { NextResponse } from "next/server";
import { runWelcomeTrials } from "@/lib/welcome-trials";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface InstallPayload {
  cloudId?: string;
  accountId?: string;
  installedAt?: string;
  environment?: string;
}

function authorize(req: Request): boolean {
  const expected = env.forgeWebhookSecret();
  if (!expected) return false; // explicit secret required — no default-allow in prod
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: InstallPayload = {};
  try {
    const body = await req.text();
    if (body.trim()) payload = JSON.parse(body) as InstallPayload;
  } catch {
    // payload is optional; the run uses Marketplace API to discover the license
  }

  console.log(
    `[lifecycle] install event received: cloudId=${payload.cloudId ?? "-"} ` +
      `accountId=${payload.accountId ?? "-"} ` +
      `installedAt=${payload.installedAt ?? "-"} ` +
      `env=${payload.environment ?? "-"}`
  );

  try {
    const summary = await runWelcomeTrials();
    return NextResponse.json({
      triggeredBy: "forge-install-event",
      install: payload,
      ...summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[lifecycle] welcome run failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
