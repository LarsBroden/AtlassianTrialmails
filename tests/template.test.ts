import { describe, expect, it } from "vitest";
import { renderHtml, renderText, SUBJECT } from "../lib/template";

const baseInput = {
  firstName: "Sara",
  company: "Acme Corp",
  trialEndDate: "2026-06-12",
};

describe("renderHtml", () => {
  it("substitutes all known placeholders", () => {
    const html = renderHtml(baseInput);
    expect(html).not.toMatch(/\{\{firstName\}\}/);
    expect(html).not.toMatch(/\{\{company\}\}/);
    expect(html).not.toMatch(/\{\{trialEndDate\}\}/);
    expect(html).toContain("Sara");
    expect(html).toContain("Acme Corp");
  });

  it("formats the trial end date as a long-form English date", () => {
    const html = renderHtml(baseInput);
    expect(html).toContain("June 12, 2026");
  });

  it("escapes HTML in personalization fields", () => {
    const html = renderHtml({
      ...baseInput,
      company: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("falls back to safe defaults when firstName/company are missing", () => {
    const html = renderHtml({ ...baseInput, firstName: "", company: "" });
    expect(html).toContain("Welcome, there.");
    expect(html).toContain("your team");
  });

  it("renders the team-voice copy, not founder-voice", () => {
    const html = renderHtml(baseInput);
    expect(html).toContain("We're the Bulk Clone team");
    expect(html).toContain("The Bulk Clone team");
    expect(html).not.toContain("I'm Lars");
    expect(html).not.toContain("I read every email");
  });

  it("routes the footer domain to lbconsultinggroup.org", () => {
    const html = renderHtml(baseInput);
    expect(html).toContain("lbconsultinggroup.org");
    expect(html).not.toContain("enterprisemovement.com");
  });
});

describe("renderText", () => {
  it("produces a plain-text version with the same key facts", () => {
    const text = renderText(baseInput);
    expect(text).toContain("Hi Sara");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("June 12, 2026");
    expect(text).toContain("The Bulk Clone team");
  });

  it("uses fallback greeting when firstName is blank", () => {
    const text = renderText({ ...baseInput, firstName: "" });
    expect(text).toContain("Hi there");
  });
});

describe("SUBJECT", () => {
  it("is non-empty and references the product", () => {
    expect(SUBJECT.length).toBeGreaterThan(10);
    expect(SUBJECT).toContain("Bulk Clone Professional");
  });
});
