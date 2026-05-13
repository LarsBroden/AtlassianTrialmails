export const PARTNER_DOMAINS: ReadonlySet<string> = new Set([
  "adaptavist.com",
  "eficode.com",
  "valiantys.com",
  "e7solutions.com",
  "carahsoft.com",
  "sourcesense.com",
  "automation-consultants.com",
  "praecipio.com",
  "padahsolutions.com",
  "tsoftlatam.com",
  "trundl.com",
  "connection.com",
]);

export function isPartnerEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return PARTNER_DOMAINS.has(email.slice(at + 1).toLowerCase());
}
