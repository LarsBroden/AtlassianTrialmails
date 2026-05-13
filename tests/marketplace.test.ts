import { describe, expect, it } from "vitest";
import { classifyTrial, isNewTrial, normalizeLicense, type RejectReason } from "../lib/marketplace";

const NOW = new Date("2026-05-13T00:00:00Z");
const OPTS = { now: NOW, lookbackDays: 7 } as const;

const sampleRaw = {
  addonLicenseId: "SEN-L12345",
  appKey: "com.lbcg.bulkclone",
  hosting: "Cloud",
  licenseType: "EVALUATION",
  tier: "100 Users",
  status: "active",
  maintenanceStartDate: "2026-05-10",
  maintenanceEndDate: "2026-06-09",
  lastUpdated: "2026-05-10",
  contactDetails: {
    company: "Acme Corp",
    technicalContact: { name: "Sara Smith", email: "sara@acme.com" },
    billingContact: { name: "Bob Billing", email: "billing@acme.com" },
  },
};

function expectRejected(raw: typeof sampleRaw, reason: RejectReason) {
  const n = normalizeLicense(raw)!;
  const r = classifyTrial(n, OPTS);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.reason).toBe(reason);
}

describe("normalizeLicense", () => {
  it("maps key fields, prefers the technical contact, and lowercases email", () => {
    const n = normalizeLicense({
      ...sampleRaw,
      contactDetails: {
        ...sampleRaw.contactDetails,
        technicalContact: { name: "Sara Smith", email: "Sara@Acme.com" },
      },
    });
    expect(n?.addonLicenseId).toBe("SEN-L12345");
    expect(n?.contactEmail).toBe("sara@acme.com");
    expect(n?.contactName).toBe("Sara Smith");
    expect(n?.company).toBe("Acme Corp");
  });

  it("falls back to billing contact when technical is missing", () => {
    const n = normalizeLicense({
      ...sampleRaw,
      contactDetails: { ...sampleRaw.contactDetails, technicalContact: {} },
    });
    expect(n?.contactEmail).toBe("billing@acme.com");
  });

  it("returns null when no email is present", () => {
    const n = normalizeLicense({
      ...sampleRaw,
      contactDetails: { ...sampleRaw.contactDetails, technicalContact: {}, billingContact: {} },
    });
    expect(n).toBeNull();
  });

  it("uppercases licenseType for stable downstream comparisons", () => {
    const n = normalizeLicense({ ...sampleRaw, licenseType: "evaluation" });
    expect(n?.licenseType).toBe("EVALUATION");
  });
});

describe("classifyTrial — accepts genuine new prospects", () => {
  it("accepts an active cloud evaluation from a real prospect within the lookback window", () => {
    const n = normalizeLicense(sampleRaw)!;
    expect(classifyTrial(n, OPTS)).toEqual({ ok: true });
    expect(isNewTrial(n, OPTS)).toBe(true);
  });

  it("accepts when status is blank (some exports omit it)", () => {
    const n = normalizeLicense({ ...sampleRaw, status: "" })!;
    expect(isNewTrial(n, OPTS)).toBe(true);
  });
});

describe("classifyTrial — rejects non-prospects", () => {
  it("rejects commercial licenses", () => {
    expectRejected({ ...sampleRaw, licenseType: "COMMERCIAL" }, "not-evaluation");
  });

  it("rejects non-cloud hosting", () => {
    expectRejected({ ...sampleRaw, hosting: "Data Center" }, "not-cloud");
  });

  it("rejects inactive/cancelled status", () => {
    expectRejected({ ...sampleRaw, status: "cancelled" }, "inactive");
  });

  it("rejects @atlassian.com internal users", () => {
    expectRejected(
      {
        ...sampleRaw,
        contactDetails: {
          ...sampleRaw.contactDetails,
          technicalContact: { name: "Atlassian Tester", email: "tester@atlassian.com" },
        },
      },
      "atlassian-internal"
    );
  });

  it("rejects subdomain Atlassian emails", () => {
    expectRejected(
      {
        ...sampleRaw,
        contactDetails: {
          ...sampleRaw.contactDetails,
          technicalContact: { name: "Internal", email: "qa@team.atlassian.com" },
        },
      },
      "atlassian-internal"
    );
  });

  it("rejects partner / reseller domains", () => {
    expectRejected(
      {
        ...sampleRaw,
        contactDetails: {
          ...sampleRaw.contactDetails,
          technicalContact: { name: "Partner Person", email: "consultant@adaptavist.com" },
        },
      },
      "partner-domain"
    );
  });

  it("rejects licenses with no company name (likely test/personal account)", () => {
    expectRejected(
      { ...sampleRaw, contactDetails: { ...sampleRaw.contactDetails, company: "" } },
      "missing-company"
    );
  });

  it("rejects licenses that started before the lookback window", () => {
    expectRejected(
      { ...sampleRaw, maintenanceStartDate: "2026-04-01" },
      "outside-lookback-window"
    );
  });

  it("rejects licenses with unparseable maintenanceStartDate", () => {
    expectRejected({ ...sampleRaw, maintenanceStartDate: "" }, "missing-start-date");
  });

  it("uses a default 7-day lookback when no opts are passed", () => {
    const n = normalizeLicense({ ...sampleRaw, maintenanceStartDate: "2020-01-01" })!;
    expect(isNewTrial(n)).toBe(false);
  });
});

describe("classifyTrial — boundary of lookback window", () => {
  it("accepts a license that started exactly at the lookback cutoff", () => {
    const n = normalizeLicense({ ...sampleRaw, maintenanceStartDate: "2026-05-06" })!;
    expect(isNewTrial(n, OPTS)).toBe(true);
  });

  it("rejects a license that started one day before the cutoff", () => {
    expectRejected(
      { ...sampleRaw, maintenanceStartDate: "2026-05-05" },
      "outside-lookback-window"
    );
  });
});
