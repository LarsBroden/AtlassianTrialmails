import { readFileSync } from "node:fs";
import path from "node:path";

export type TemplateKind = "day1" | "day9";

interface TemplateMeta {
  file: string;
  subject: string;
}

const TEMPLATES: Record<TemplateKind, TemplateMeta> = {
  day1: {
    file: "welcome-preview.html",
    subject: "Welcome to Bulk Clone Professional for Jira Cloud",
  },
  day9: {
    file: "day9-followup.html",
    subject: "Day 9 — How is your Bulk Clone Professional trial going?",
  },
};

const cache: Partial<Record<TemplateKind, string>> = {};

function loadTemplate(kind: TemplateKind): string {
  const cached = cache[kind];
  if (cached) return cached;
  const meta = TEMPLATES[kind];
  const fullPath = path.join(process.cwd(), "emails", meta.file);
  const html = readFileSync(fullPath, "utf-8");
  cache[kind] = html;
  return html;
}

export function renderHtml(kind: TemplateKind): string {
  return loadTemplate(kind);
}

export function subjectFor(kind: TemplateKind): string {
  return TEMPLATES[kind].subject;
}

// Plain-text alternative for clients that don't render HTML. These mirror the
// information density of the HTML but with none of the layout — same links,
// same key facts, same signature.
export function renderText(kind: TemplateKind): string {
  if (kind === "day1") {
    return [
      "Welcome to Bulk Clone Professional for Jira Cloud",
      "",
      "Thank you for evaluating Bulk Clone Professional for Jira Cloud. We're genuinely excited to have you on board and want to make sure you get the most out of your trial from day one.",
      "",
      "A personal note from Lars Brodén, Product Manager: We've been building Bulk Clone since 2015 and this Cloud app is our best work yet. If you have any questions during your trial — big or small — just reply to this email and I'll get back to you personally.",
      "",
      "Getting started resources:",
      "  • Documentation: https://www.lbconsultinggroup.org/bulk-clone-cloud-solution/",
      "  • Video tutorials: https://www.lbconsultinggroup.org/bulk-clone-professional-cloud-video-tutorials/",
      "  • Cloud migration guide: https://www.lbconsultinggroup.org/bulk-clone-proffessional-for-cloud-migration-plan/",
      "  • Release notes: https://www.lbconsultinggroup.org/release-notes-bulk-clone-professional-cloud/",
      "",
      "3 videos to watch first:",
      "  1. Overall Introduction — https://youtu.be/-l4MCuohOwE",
      "  2. All Bulk Clone Admin Functions — https://youtu.be/sF8yAyvL2kE",
      "  3. Scheduling Bulk Clone Jobs — https://youtu.be/Wij5qfKUNkw",
      "",
      "Built on Atlassian Forge — your Jira data never leaves Atlassian's infrastructure. We are part of Atlassian's Bug Bounty Program and on track for Cloud Fortified certification mid-July 2026.",
      "",
      "Support portal: https://bulkclone-support.atlassian.net/servicedesk/customer/portal/1",
      "Marketplace listing: https://marketplace.atlassian.com/apps/1213028/bulk-clone-professional-for-jira",
      "",
      "Happy cloning,",
      "Lars Brodén",
      "Product Manager — Bulk Clone Professional for Jira",
      "LB Consulting Group",
      "",
      "—",
      "LB Consulting Group AB, Valhallavägen 80, 114 27 Stockholm, Sweden",
      "You are receiving this email because you recently started a free trial of Bulk Clone Professional for Jira Cloud.",
    ].join("\n");
  }
  // day9
  return [
    "Day 9 — How is your Bulk Clone Professional trial going?",
    "",
    "You're 9 days into your Bulk Clone Professional trial and we wanted to check in personally. We hope it's already saving your team time — and if there's anything we can do to help you get more out of it, we're here.",
    "",
    "A personal note from Lars Brodén, Product Manager: I always reach out personally at day 9 because this is typically when teams have had enough time to explore the core features but may have questions before going deeper. If anything hasn't worked as expected, or if you'd like a walkthrough — just reply to this email and I'll get back to you directly.",
    "",
    "A few things worth checking at day 9:",
    "  • Have you tried cloning a full Epic with subtasks and links intact?",
    "  • Have you explored saving a cloning configuration as a reusable template?",
    "  • Have you tried scheduling a recurring clone job using Jira Automation?",
    "  • Have you explored cloning across multiple projects or spaces?",
    "",
    "Key resources:",
    "  • Documentation: https://www.lbconsultinggroup.org/bulk-clone-cloud-solution/",
    "  • Video tutorials: https://www.lbconsultinggroup.org/bulk-clone-professional-cloud-video-tutorials/",
    "  • Cloud migration guide: https://www.lbconsultinggroup.org/bulk-clone-proffessional-for-cloud-migration-plan/",
    "  • Release notes: https://www.lbconsultinggroup.org/release-notes-bulk-clone-professional-cloud/",
    "",
    "Support portal: https://bulkclone-support.atlassian.net/servicedesk/customer/portal/1",
    "Marketplace listing: https://marketplace.atlassian.com/apps/1213028/bulk-clone-professional-for-jira",
    "",
    "You have 21 days remaining in your trial. We want to make sure every one of those days counts for your team.",
    "",
    "Lars Brodén",
    "Product Manager — Bulk Clone Professional for Jira",
    "LB Consulting Group",
    "",
    "—",
    "LB Consulting Group AB, Valhallavägen 80, 114 27 Stockholm, Sweden",
    "You are receiving this email because you are currently evaluating Bulk Clone Professional for Jira Cloud.",
  ].join("\n");
}
