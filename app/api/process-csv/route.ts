import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/parseCsv";
import { transformRows } from "@/lib/transform";
import type { ProcessError, ProcessResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return NextResponse.json<ProcessError>(
      { error: "Could not read request body." },
      { status: 400 }
    );
  }

  if (!text.trim()) {
    return NextResponse.json<ProcessError>(
      { error: "Empty CSV body." },
      { status: 400 }
    );
  }

  try {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      return NextResponse.json<ProcessError>(
        { error: "CSV contains no data rows." },
        { status: 400 }
      );
    }
    const result: ProcessResult = transformRows(rows);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parsing error.";
    return NextResponse.json<ProcessError>(
      { error: `Failed to process CSV: ${message}` },
      { status: 400 }
    );
  }
}
