import { renderHtml, renderText, SUBJECT } from "@/lib/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "html";
  const input = {
    firstName: url.searchParams.get("firstName") ?? "Sara",
    company: url.searchParams.get("company") ?? "Acme Corp",
    trialEndDate:
      url.searchParams.get("trialEndDate") ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  };

  if (format === "text") {
    return new Response(renderText(input), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (format === "json") {
    return Response.json({
      subject: SUBJECT,
      html: renderHtml(input),
      text: renderText(input),
    });
  }
  return new Response(renderHtml(input), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
