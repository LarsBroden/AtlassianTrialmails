# Marketplace Review Outreach

Small web app for LB Consulting Group's "Bulk Clone Professional for Jira" Marketplace listing. Drop a Marketplace transactions CSV, get a deduplicated BCC list of Cloud customers ready to paste into Outlook for review-request outreach.

## What it does

1. Upload the transactions CSV exported from the Atlassian Marketplace partner portal.
2. Server parses the CSV, filters to Cloud licenses, and deduplicates technical + billing contact emails.
3. UI shows transaction count, unique emails, hosting breakdown, and how many emails come from known partner / reseller domains.
4. Filter toggles: exclude partner domains, choose status (active / inactive / all).
5. Outputs: a semicolon-separated BCC string (one-click copy) and a downloadable CSV with FirstName, LastName, Email, Company, HostingType, Status, InstallDate, DisplayName.

Cloud only — Data Center customers are handled in a separate workflow.

## Local dev

```
npm install
npm run dev
```

Open http://localhost:3000 and drop `fixtures/sample-transactions.csv` to verify.

## Tests

```
npm test
```

Runs `tests/transform.test.ts` against the fixture — covers Cloud filter, dedupe, partner flagging, status derivation, and embedded-comma handling.

## Deploy to Vercel

```
npx vercel deploy
```

No environment variables, no database. The serverless function processes the CSV in-memory and returns JSON — nothing is persisted.

Vercel's hobby tier caps request bodies at 4.5 MB. The client guards at 4 MB and shows a clear error if a file is too large. A 674-install vendor's full export is typically well under 2 MB.

## Project layout

```
app/
  layout.tsx, page.tsx, globals.css
  api/process-csv/route.ts    POST handler, accepts raw CSV text body
lib/
  parseCsv.ts                 papaparse wrapper
  transform.ts                Cloud filter, dedupe, partner flag, status derivation
  partners.ts                 PARTNER_DOMAINS allowlist
  types.ts                    Contact, ProcessResult, Filters
components/
  DropZone, PreviewStats, FilterControls, OutputPanel
fixtures/sample-transactions.csv
tests/transform.test.ts
```

## Partner / reseller domains flagged

adaptavist.com, eficode.com, valiantys.com, e7solutions.com, carahsoft.com, sourcesense.com, automation-consultants.com, praecipio.com, padahsolutions.com, tsoftlatam.com, trundl.com, connection.com

Edit `lib/partners.ts` to add more.
