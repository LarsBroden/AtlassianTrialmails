import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetClientForTests,
  claimDay9Lock,
  claimSendLock,
  confirmDay9Sent,
  confirmSent,
  hasBeenSent,
  hasDay9BeenSent,
  hasEmailBeenSent,
  markEmailSent,
  releaseDay9Lock,
  releaseSendLock,
} from "../lib/state";

beforeEach(() => {
  __resetClientForTests();
});

describe("claimSendLock — atomic per-license claim", () => {
  it("returns true on the first claim and false on a concurrent second claim", async () => {
    expect(await claimSendLock("SEN-L1")).toBe(true);
    expect(await claimSendLock("SEN-L1")).toBe(false);
  });

  it("releases the claim so a later run can retry", async () => {
    expect(await claimSendLock("SEN-L2")).toBe(true);
    await releaseSendLock("SEN-L2");
    expect(await claimSendLock("SEN-L2")).toBe(true);
  });

  it("keeps the lock after confirmSent — the claim becomes a permanent dedupe key", async () => {
    expect(await claimSendLock("SEN-L3")).toBe(true);
    await confirmSent("SEN-L3");
    expect(await claimSendLock("SEN-L3")).toBe(false);
    expect(await hasBeenSent("SEN-L3")).toBe(true);
  });

  it("hasBeenSent reflects an active claim too (not just confirmed ones)", async () => {
    expect(await hasBeenSent("SEN-L4")).toBe(false);
    await claimSendLock("SEN-L4");
    expect(await hasBeenSent("SEN-L4")).toBe(true);
  });
});

describe("claimDay9Lock — atomic per-license day-9 claim", () => {
  it("returns true on first claim, false on a concurrent second claim", async () => {
    expect(await claimDay9Lock("SEN-L1")).toBe(true);
    expect(await claimDay9Lock("SEN-L1")).toBe(false);
  });

  it("releases day-9 claim so a later run can retry", async () => {
    expect(await claimDay9Lock("SEN-L2")).toBe(true);
    await releaseDay9Lock("SEN-L2");
    expect(await claimDay9Lock("SEN-L2")).toBe(true);
  });

  it("confirmDay9Sent makes the claim permanent", async () => {
    expect(await claimDay9Lock("SEN-L3")).toBe(true);
    await confirmDay9Sent("SEN-L3");
    expect(await claimDay9Lock("SEN-L3")).toBe(false);
    expect(await hasDay9BeenSent("SEN-L3")).toBe(true);
  });

  it("day-1 and day-9 dedupe keys are independent", async () => {
    await claimSendLock("SEN-L4");
    await confirmSent("SEN-L4");
    expect(await hasBeenSent("SEN-L4")).toBe(true);
    // Day-9 lock on the same license should still be free
    expect(await hasDay9BeenSent("SEN-L4")).toBe(false);
    expect(await claimDay9Lock("SEN-L4")).toBe(true);
  });
});

describe("per-email dedupe", () => {
  it("tracks per appKey:email and ignores casing", async () => {
    expect(await hasEmailBeenSent("com.example.app", "Sara@Acme.com")).toBe(false);
    await markEmailSent("com.example.app", "Sara@Acme.com");
    expect(await hasEmailBeenSent("com.example.app", "sara@acme.com")).toBe(true);
    expect(await hasEmailBeenSent("com.example.app", "SARA@ACME.COM")).toBe(true);
  });

  it("scopes per-email records by appKey so different apps don't collide", async () => {
    await markEmailSent("com.example.appA", "sara@acme.com");
    expect(await hasEmailBeenSent("com.example.appA", "sara@acme.com")).toBe(true);
    expect(await hasEmailBeenSent("com.example.appB", "sara@acme.com")).toBe(false);
  });

  it("returns false for empty email without throwing", async () => {
    expect(await hasEmailBeenSent("any", "")).toBe(false);
    await markEmailSent("any", "");
    expect(await hasEmailBeenSent("any", "")).toBe(false);
  });
});
