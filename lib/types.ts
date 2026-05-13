export type ContactStatus = "active" | "inactive";
export type ContactSource = "technical" | "billing";
export type StatusFilter = "active" | "inactive" | "all";

export interface Contact {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  company: string;
  hostingType: string;
  status: ContactStatus;
  installDate: string;
  isPartner: boolean;
  source: ContactSource;
}

export interface ProcessStats {
  totalTransactions: number;
  uniqueEmails: number;
  byHosting: Record<string, number>;
  flaggedPartnerCount: number;
}

export interface ProcessResult {
  stats: ProcessStats;
  contacts: Contact[];
}

export interface ProcessError {
  error: string;
}
