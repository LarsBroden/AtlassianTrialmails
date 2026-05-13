import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../lib/parseCsv";
import { transformRows } from "../lib/transform";

const fixture = readFileSync(
  join(__dirname, "..", "fixtures", "sample-transactions.csv"),
  "utf8"
);

describe("transformRows", () => {
  const rows = parseCsv(fixture);
  const result = transformRows(rows);

  it("counts all transactions regardless of hosting", () => {
    expect(result.stats.totalTransactions).toBe(12);
  });

  it("breaks down hosting before cloud filter", () => {
    expect(result.stats.byHosting.Cloud).toBe(10);
    expect(result.stats.byHosting["Data Center"]).toBe(1);
    expect(result.stats.byHosting.Server).toBe(1);
  });

  it("filters non-cloud rows out of contacts", () => {
    const hostings = new Set(result.contacts.map((c) => c.hostingType));
    expect(hostings.has("Server")).toBe(false);
    expect(hostings.has("Data Center")).toBe(false);
  });

  it("dedupes case-insensitively by email", () => {
    const lower = result.contacts.map((c) => c.email.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
    const aliceCount = lower.filter((e) => e === "alice@acmecorp.com").length;
    expect(aliceCount).toBe(1);
  });

  it("yields the expected number of unique cloud emails", () => {
    expect(result.stats.uniqueEmails).toBe(11);
  });

  it("flags partner-domain contacts", () => {
    expect(result.stats.flaggedPartnerCount).toBe(1);
    const partner = result.contacts.find((c) => c.isPartner);
    expect(partner?.email).toBe("partner@adaptavist.com");
  });

  it("preserves embedded commas in company names via quote-aware parsing", () => {
    const sara = result.contacts.find((c) => c.email === "sara@acme.com");
    expect(sara?.company).toBe("Acme, Inc");
  });

  it("trusts the explicit status column when present", () => {
    const cancelled = result.contacts.find(
      (c) => c.email === "inactive@cancelled.com"
    );
    expect(cancelled?.status).toBe("inactive");
  });

  it("derives inactive from an expired maintenanceEndDate when status is blank", () => {
    const expired = result.contacts.find((c) => c.email === "old@expired.com");
    expect(expired?.status).toBe("inactive");
  });

  it("derives active from a future maintenanceEndDate when status is blank", () => {
    const future = result.contacts.find((c) => c.email === "future@goodco.com");
    expect(future?.status).toBe("active");
  });

  it("derives inactive when neither status nor maintenanceEndDate is present", () => {
    const mystery = result.contacts.find((c) => c.email === "nodate@mystery.com");
    expect(mystery?.status).toBe("inactive");
  });

  it("splits the display name on the first whitespace", () => {
    const alice = result.contacts.find((c) => c.email === "alice@acmecorp.com");
    expect(alice?.firstName).toBe("Alice");
    expect(alice?.lastName).toBe("Johnson");
    const cher = result.contacts.find((c) => c.email === "cher@singlenamecorp.com");
    expect(cher?.firstName).toBe("Cher");
    expect(cher?.lastName).toBe("");
  });

  it("prefers the technical contact source when an email appears as both", () => {
    const alice = result.contacts.find((c) => c.email === "alice@acmecorp.com");
    expect(alice?.source).toBe("technical");
  });

  it("emits separate contacts when technical and billing emails differ", () => {
    const tech = result.contacts.find((c) => c.email === "techlead@bigcorp.com");
    const billing = result.contacts.find((c) => c.email === "ap@bigcorp.com");
    expect(tech?.source).toBe("technical");
    expect(billing?.source).toBe("billing");
  });
});
