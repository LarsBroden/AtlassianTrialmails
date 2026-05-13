# Project Context

Read this first if you're picking the project up cold.

## What this is

Sales acceleration tooling for **Bulk Clone Professional for Jira**, a Cloud Marketplace app published by **LB Consulting Group** (Lars Brödén). Two distinct workflows live in this single repo:

1. **CSV review-outreach (manual):** drag-and-drop a Marketplace transactions CSV export, get a deduplicated BCC list of Cloud customers — used for one-off campaigns like asking existing users to leave a Marketplace review.
2. **Automated trial welcome (scheduled):** Vercel Cron polls the Atlassian Marketplace REST API for new evaluation licenses and sends each genuine new trial prospect a personalised welcome email via Microsoft Graph.

## Why it exists

| Metric | Bulk Clone Professional | Deep Clone for Jira (competitor) |
|---|---|---|
| Installs | ~674 | ~13,200 |
| Marketplace reviews | **0** | many |

The #1 gap diagnosed: **zero Marketplace reviews**. The CSV outreach flow lets Lars run a one-off review-request campaign to existing Cloud customers. The trial welcome flow opens a long-term funnel for converting new evaluators into paying customers (and eventually reviewers).

## Hard constraints

- **Cloud only.** Data Center customers are handled by a separate workflow not in scope here.
- **Single sender mailbox:** `lars.broden@lbconsultinggroup.org` via Microsoft Graph, app-only (client credentials). Reply-to: same.
- **Email voice:** team-led ("We're the Bulk Clone team behind the app"), **not** founder-led ("I'm Lars"). Signature: "The Bulk Clone team". Established after explicit revisions.
- **No review ask in the welcome email** — that belongs in a later-in-trial follow-up.
- **Free Vercel tier currently.** Daily cron is the highest-frequency option until upgrade to Pro.

## Key identifiers

- Marketplace vendor ID: **38407**
- Marketplace app ID: **1213028** (Bulk Clone Professional for Jira)
- App platform: **Forge** (not Connect)
- Sender domain: **lbconsultinggroup.org** (verified domain in an M365 tenant the user controls)
- GitHub repo: https://github.com/LarsSverkerBroden/Sales-Extract-from-Atlassian-Marketplace

## Partner / reseller domains flagged (excluded from outreach)

Maintained in [lib/partners.ts](lib/partners.ts):

adaptavist.com, eficode.com, valiantys.com, e7solutions.com, carahsoft.com, sourcesense.com, automation-consultants.com, praecipio.com, padahsolutions.com, tsoftlatam.com, trundl.com, connection.com

## Out of scope (deliberately)

- Authentication / multi-tenant access — single user, single project
- Persistent storage of license records — only dedupe keys live in Upstash
- Sending the review-request email itself — Outlook BCC is the handoff point
- Trial follow-up / re-engagement emails beyond day 0 welcome
- Data Center licenses
- Forge app source code (separate repo)
