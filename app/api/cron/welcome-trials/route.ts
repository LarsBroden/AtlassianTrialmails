import { NextResponse } from "next/server";
import { runWelcomeTrials } from "@/lib/welcome-trials";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const expected = env.cronSecret();
  if (!expected) return true;
  const header = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const query = url.searchParams.get("secret") ?? "";
  return header === `Bearer ${expected}` || query === expected;
}

async function handle(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runWelcomeTrials();
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("welcome-trials run failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
