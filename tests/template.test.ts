import { describe, expect, it } from "vitest";
import { renderHtml, renderText, subjectFor } from "../lib/template";

describe("renderHtml('day1')", () => {
  const html = renderHtml("day1");

  it("returns a non-trivial HTML document", () => {
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toMatch(/<!DOCTYPE html>/i);
  });

  it("contains the welcome hero copy and the trial-started badge", () => {
    expect(html).toContain("Welcome — Trial Started");
    expect(html).toContain("let's get you cloning");
  });

  it("identifies Lars as Product Manager (the new founder-as-PM voice)", () => {
    expect(html).toContain("Lars Brodén");
    expect(html).toContain("Product Manager");
  });

  it("links to the docs, video tutorials, migration guide, and release notes", () => {
    expect(html).toContain("https://www.lbconsultinggroup.org/bulk-clone-cloud-solution/");
    expect(html).toContain("https://www.lbconsultinggroup.org/bulk-clone-professional-cloud-video-tutorials/");
    expect(html).toContain("https://www.lbconsultinggroup.org/bulk-clone-proffessional-for-cloud-migration-plan/");
    expect(html).toContain("https://www.lbconsultinggroup.org/release-notes-bulk-clone-professional-cloud/");
  });

  it("links to the support portal and the Marketplace listing for app 1213028", () => {
    expect(html).toContain("https://bulkclone-support.atlassian.net/servicedesk/customer/portal/1");
    expect(html).toContain("marketplace.atlassian.com/apps/1213028");
  });

  it("includes the LB Consulting Group AB Stockholm footer", () => {
    expect(html).toContain("LB Consulting Group AB");
    expect(html).toContain("Valhallavägen 80");
  });

  it("contains no leftover handlebars-style placeholders", () => {
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe("renderHtml('day9')", () => {
  const html = renderHtml("day9");

  it("returns a non-trivial HTML document", () => {
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toMatch(/<!DOCTYPE html>/i);
  });

  it("opens with the Day-9 badge and the trial-going question", () => {
    expect(html).toContain("Day 9 of Your Trial");
    expect(html).toContain("21 Days Remaining");
    expect(html).toContain("How is your trial");
  });

  it("includes the day-9 check-in checklist", () => {
    expect(html).toContain("A few things worth checking at day 9");
    expect(html).toContain("Have you tried cloning a full Epic");
  });

  it("re-surfaces docs, videos, and support portal links", () => {
    expect(html).toContain("https://www.lbconsultinggroup.org/bulk-clone-cloud-solution/");
    expect(html).toContain("https://bulkclone-support.atlassian.net/servicedesk/customer/portal/1");
  });

  it("contains no leftover handlebars-style placeholders", () => {
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe("renderText", () => {
  it("day1 plain-text version covers the key facts and signature", () => {
    const text = renderText("day1");
    expect(text).toContain("Welcome to Bulk Clone Professional");
    expect(text).toContain("Lars Brodén");
    expect(text).toContain("Product Manager");
    expect(text).toContain("https://www.lbconsultinggroup.org/bulk-clone-cloud-solution/");
  });

  it("day9 plain-text version mentions the check-in framing and 21 days remaining", () => {
    const text = renderText("day9");
    expect(text).toContain("Day 9");
    expect(text).toContain("21 days remaining");
    expect(text).toContain("Lars Brodén");
  });
});

describe("subjectFor", () => {
  it("day1 subject references the welcome", () => {
    expect(subjectFor("day1")).toContain("Welcome");
    expect(subjectFor("day1")).toContain("Bulk Clone Professional");
  });
  it("day9 subject signals the check-in", () => {
    expect(subjectFor("day9")).toContain("Day 9");
  });
});
