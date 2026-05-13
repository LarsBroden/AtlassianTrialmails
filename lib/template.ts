import { readFileSync } from "node:fs";
import path from "node:path";
import { env } from "./env";

const TEMPLATE_PATH = path.join(process.cwd(), "emails", "welcome-preview.html");

let cachedTemplate: string | null = null;
function loadTemplate(): string {
  if (cachedTemplate === null) {
    cachedTemplate = readFileSync(TEMPLATE_PATH, "utf-8");
  }
  return cachedTemplate;
}

export interface RenderInput {
  firstName: string;
  company: string;
  trialEndDate: string;
  quickstartUrl?: string;
  docsUrl?: string;
  calendarUrl?: string;
}

const FALLBACK_FIRST_NAME = "there";
const FALLBACK_COMPANY = "your team";

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function renderHtml(input: RenderInput): string {
  const tpl = loadTemplate();
  const replacements: Record<string, string> = {
    firstName: htmlEscape(input.firstName?.trim() || FALLBACK_FIRST_NAME),
    company: htmlEscape(input.company?.trim() || FALLBACK_COMPANY),
    trialEndDate: htmlEscape(fmtDate(input.trialEndDate)),
    quickstartUrl: input.quickstartUrl || env.quickstartUrl(),
    docsUrl: input.docsUrl || env.docsUrl(),
    calendarUrl: input.calendarUrl || env.calendarUrl(),
  };
  return tpl.replace(/\{\{(\w+)\}\}/g, (full, key: string) => {
    return Object.prototype.hasOwnProperty.call(replacements, key)
      ? replacements[key]
      : full;
  });
}

export function renderText(input: RenderInput): string {
  const first = input.firstName?.trim() || FALLBACK_FIRST_NAME;
  const company = input.company?.trim() || FALLBACK_COMPANY;
  const endDate = fmtDate(input.trialEndDate);
  const calendar = input.calendarUrl || env.calendarUrl();
  const docs = input.docsUrl || env.docsUrl();
  const quickstart = input.quickstartUrl || env.quickstartUrl();

  return [
    `Hi ${first},`,
    "",
    `Thanks for starting your evaluation of Bulk Clone Professional for Jira at ${company}.`,
    "",
    "We're the Bulk Clone team behind the app, and we wanted to reach out to make sure your trial goes well.",
    "",
    'A few things that usually help new users get to a "this is useful" moment within the first day:',
    "",
    "1. Start with Clone Project — full project + issues + attachments + history, across instances.",
    `2. Watch the 3-minute quickstart: ${quickstart}`,
    `3. Skim the docs, especially permission preservation: ${docs}`,
    "",
    `Your trial runs through ${endDate}. No card on file, no auto-renew.`,
    "",
    `If you'd like a 15-minute walkthrough, book here: ${calendar}`,
    "Or just hit reply — we read every email.",
    "",
    "Happy cloning,",
    "The Bulk Clone team",
    "LB Consulting Group · Bulk Clone Professional for Jira",
  ].join("\n");
}

export const SUBJECT = "Welcome to Bulk Clone Professional — getting the most from your trial";
