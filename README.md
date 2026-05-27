# Marketplace Review Outreach

Small web app for LB Consulting Group's "Bulk Clone Professional for Jira" Marketplace listing. Drop a Marketplace transactions CSV, get a deduplicated BCC list of Cloud customers ready to paste into Outlook for review-request outreach.

## What it does

Two workflows in one repo:

### 1. Manual CSV review-outreach (`/` UI)
- Upload the transactions CSV exported from the Atlassian Marketplace partner portal.
- Server parses the CSV, filters to Cloud licenses, and deduplicates technical + billing contact emails.
- UI shows transaction count, unique emails, hosting breakdown, and how many emails come from known partner / reseller domains.
- Filter toggles: exclude partner domains, choose status (active / inactive / all).
- Outputs: a semicolon-separated BCC string (one-click copy) and a downloadable CSV with FirstName, LastName, Email, Company, HostingType, Status, InstallDate, DisplayName.

### 2. Automated trial-welcome pipeline (cron → Microsoft Graph)
- Vercel Cron polls the Marketplace REST API every 5 minutes (requires Pro tier — Hobby caps to daily).
- Two emails per trial:
  - **Day 1:** welcome email fires when a new EVALUATION license appears (filtered to genuine new Cloud prospects).
  - **Day 9:** check-in email fires when the trial is 9 days old and the day-1 welcome was sent.
- Sends from `lars.broden@lbconsultinggroup.org` via Microsoft Graph, CC'ing the same address for inbox visibility.
- Templates are fully static HTML in `emails/welcome-preview.html` and `emails/day9-followup.html`.

Cloud only — Data Center customers are handled in a separate workflow.

## Local dev

```
npm install
npm run dev
```

Open http://localhost:3000 and drop `fixtures/sample-transactions.csv` to verify the CSV workflow.

To rehearse the trial-welcome pipeline locally before deploying:

1. Create `.env.local` at the project root with at minimum:
   ```
   MARKETPLACE_VENDOR_ID=38407
   MARKETPLACE_USER_EMAIL=<your Atlassian account email>
   MARKETPLACE_API_TOKEN=<token from id.atlassian.com>
   MARKETPLACE_APP_KEY=com.lbcg.jira.plugin.pro.BulkClonePro
   DRY_RUN=true
   ```
2. `npm run dev`
3. `curl http://localhost:3000/api/cron/welcome-trials` to hit the pipeline against your real Marketplace data and inspect the JSON summary (no emails actually sent — DRY_RUN logs only).
4. Preview the rendered emails in a browser: `http://localhost:3000/api/debug/preview-template?template=day1` (and `?template=day9`).
5. See exactly what a recipient sees by sending yourself the email through your own Outlook desktop:
   ```
   powershell -ExecutionPolicy Bypass -File scripts/send-self-test-email.ps1
   ```
   Bypasses Microsoft Graph entirely — uses your already-signed-in Outlook profile. Pass `-Template day9` for the check-in template, or `-FromEmail` to pick a specific account if Outlook has multiple configured.

Local state uses an in-memory Redis fallback when Upstash env vars are unset, so dedupe resets on every `npm run dev` restart — perfect for repeatable rehearsals.

## Tests

```
npm test
```

Runs the full vitest suite — 65 tests across `transform`, `template`, `state`, and `marketplace` covering CSV parsing, dedupe, email rendering, atomic-claim state primitives, and the trial classifier with every reject-reason code.

## Deploy to Vercel

The CSV uploader has no external dependencies — `npx vercel deploy` works zero-config.

The **trial-welcome pipeline** requires upfront setup (Atlassian Marketplace API token, Azure AD app registration for Microsoft Graph, Exchange `ApplicationAccessPolicy`, Upstash Redis, DNS hygiene on `lbconsultinggroup.org`, and a CRON_SECRET). The full walkthrough is in [SETUP.md](SETUP.md).

Vercel Hobby caps the cron schedule at daily; the `*/5 * * * *` schedule in `vercel.json` only fires at full cadence on Vercel Pro.

For the CSV uploader specifically, Vercel's hobby tier caps request bodies at 4.5 MB. The client guards at 4 MB and shows a clear error if a file is too large. A 674-install vendor's full export is typically well under 2 MB.

## Project layout

```
app/
  layout.tsx, page.tsx, globals.css           CSV uploader UI
  api/process-csv/route.ts                    POST handler for the CSV uploader
  api/cron/welcome-trials/route.ts            Scheduled (and manually-triggerable) trial-welcome runner
  api/lifecycle/installed/route.ts            Dormant Forge-trigger webhook (Option A scaffold)
  api/debug/preview-template/route.ts         Renders day1/day9 templates in a browser
lib/
  parseCsv.ts                                 papaparse wrapper (CSV uploader)
  transform.ts                                CSV: Cloud filter, dedupe, partner flag
  partners.ts                                 Partner / reseller domain allowlist (used by both flows)
  types.ts                                    Contact, ProcessResult, Filters
  env.ts                                      Typed env accessors with required/optional validation
  marketplace.ts                              Marketplace REST API client + trial classifier
  graph.ts                                    Microsoft Graph client-credentials OAuth + sendMail (with CC support)
  state.ts                                    Upstash Redis + in-memory fallback; atomic claim primitives for day-1 + day-9
  template.ts                                 Reads day1/day9 HTML files; per-template subject + plain-text fallback
  welcome-trials.ts                           Two-pass orchestrator (day-1 + day-9)
components/
  DropZone, PreviewStats, FilterControls, OutputPanel   (CSV uploader)
emails/
  welcome-preview.html                        Day-1 template (static HTML, no placeholders)
  day9-followup.html                          Day-9 check-in template (static HTML, no placeholders)
scripts/
  preview-in-outlook.ps1                      Render email as .eml, open in Outlook (visual preview)
  send-self-test-email.ps1                    Send test email via your local Outlook desktop (bypasses Graph)
bulk-clone-forge-snippets/                    Optional Option-A files to copy into the Bulk Clone Forge app
fixtures/sample-transactions.csv              CSV uploader test fixture
tests/                                        4 vitest files, 65 tests total
vercel.json                                   Cron schedule (*/5 * * * *; capped to daily on Hobby)
SETUP.md                                      Deployment walkthrough
CONTEXT.md, DECISIONS.md, STATUS.md           Living project docs
```

## Excluded sender domains (never emailed)

The trial-welcome classifier excludes:
- `@atlassian.com` and any `*.atlassian.com` subdomain (Atlassian internal)
- `@bugcrowdninja.com` (Atlassian's bug-bounty alias domain — researchers, not prospects)
- Partner / reseller domains: adaptavist.com, eficode.com, valiantys.com, e7solutions.com, carahsoft.com, sourcesense.com, automation-consultants.com, praecipio.com, padahsolutions.com, tsoftlatam.com, trundl.com, connection.com

The CSV uploader uses the same partner list to tag and optionally filter entries. Edit `lib/partners.ts` to add more partner domains; the `@bugcrowdninja.com` exclusion lives in `lib/marketplace.ts` under `ATLASSIAN_AFFILIATED_DOMAINS`.

## Company-name patterns also rejected

In the trial-welcome flow, company names matching these patterns are skipped as obvious test / sandbox tenants:
- Contains `bugbounty`
- Contains `sandbox`
- Ends in `-test`
- Ends in `-internal`

Edit `NON_PROSPECT_COMPANY_PATTERNS` in `lib/marketplace.ts` to tune.
