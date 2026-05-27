import { renderHtml, renderText, subjectFor, type TemplateKind } from "@/lib/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseKind(raw: string | null): TemplateKind {
  return raw === "day9" ? "day9" : "day1";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = parseKind(url.searchParams.get("template"));
  const format = url.searchParams.get("format") ?? "html";

  if (format === "text") {
    return new Response(renderText(kind), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (format === "json") {
    return Response.json({
      template: kind,
      subject: subjectFor(kind),
      html: renderHtml(kind),
      text: renderText(kind),
    });
  }
  return new Response(renderHtml(kind), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
