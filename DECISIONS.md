# Architectural Decisions

Append-only log of choices made and the reasoning. Read this before re-litigating any decision below.

## D1 — Next.js 14 App Router on Vercel

**Choice:** Next.js 14, App Router, TypeScript, Tailwind, deployed to Vercel.
**Reasoning:** Zero-config deploy, free tier sufficient for volume, built-in cron, serverless functions for API routes, file-based routing matches the simple structure. No SPA or static-only alternative considered since we need server-side functions for Marketplace API + Graph calls.

## D2 — Microsoft Graph for sending email

**Choice:** Microsoft Graph `sendMail` with app-only (client credentials) OAuth.
**Alternatives weighed:** SMTP with app password (simpler but tenants increasingly disable basic SMTP); Resend / Postmark (cleanest setup, but requires a separate sending domain or DNS overhead for `lbconsultinggroup.org`).
**Reasoning:** User wants emails to come from the real `lars.broden@lbconsultinggroup.org` mailbox, not a third-party relay. Graph gives best-in-class deliverability when paired with the tenant's own DKIM/SPF/DMARC, and emails appear in Sent Items as if Lars sent them.
**Trade-off accepted:** ~10 minutes more setup time (Azure app registration, admin consent, Exchange `ApplicationAccessPolicy` to scope the app to one mailbox).

## D3 — Email voice: team, not founder

**Choice:** Use "We're the Bulk Clone team", "we read every email", "The Bulk Clone team" signature.
**Original:** "I'm Lars — the developer behind the app", "I read every email", "Lars Brödén" signature.
**Reasoning:** Explicit user revision. Establishes that the app is backed by an organisation, not a single person — better for buyer perception when targeting enterprise admins.

## D4 — Sender / reply-to is lars.broden@lbconsultinggroup.org

**Choice:** Both `From` and `Reply-To` are `lars.broden@lbconsultinggroup.org`.
**Original:** The user's git commits use `lars.broden@enterprisemovement.com`, which would have been the natural default.
**Reasoning:** Explicit user redirection. `lbconsultinggroup.org` is the vendor identity and where customer-facing email should originate. M365 tenant is set up for it.

## D5 — Upstash Redis for state, accessed via `@upstash/redis`

**Choice:** Upstash Redis (via Vercel Marketplace integration) for dedupe keys + watermark.
**Alternatives weighed:** Vercel KV (now folded into Upstash); JSON-in-blob storage; SQLite-on-disk (not viable on serverless).
**Reasoning:** Upstash's REST client is serverless-native, has a generous free tier (10K commands/day), and is Redis-compatible so we can swap providers later. State requirements are tiny: a watermark string and a few hundred small keys per year.

## D6 — Trigger architecture: Option B (polling) chosen, Option A (Forge event-driven) deferred

**Choice as of 2026-05-13:** Stick with daily-cron polling for the trial-welcome pipeline. Don't modify the Bulk Clone Professional Forge app yet.
**Context:** Atlassian Marketplace doesn't push to vendors when a trial starts. The only true "install" trigger comes from the app itself (Forge `avi:forge:installed:app` event). Two architectures were laid out:
- **A:** Forge app calls a Vercel webhook on install → near-real-time welcome (~90s end-to-end)
- **B:** Vercel cron polls the Marketplace REST API on a schedule → batched welcome (24h on free tier, 5min on Pro)

User picked **B first** to avoid Forge app modifications on the first iteration.
**Implication:** The Vercel-side code for Option A (`/api/lifecycle/installed` endpoint + `bulk-clone-forge-snippets/` files) is committed but **dormant** — ready to activate by wiring the Forge app whenever the user is ready.
**Open path forward:** Upgrade to Vercel Pro for 5-min cron, or wire up the Forge trigger. Both compatible with current code.

## D7 — DRY_RUN=true is the default

**Choice:** All deploys start with `DRY_RUN=true`. The cron runs, fetches, classifies, dedupes, and logs what *would* have been sent — but doesn't actually call Graph `sendMail`.
**Reasoning:** First touch with real prospect data should be observable, not destructive. The summary JSON returned by the endpoint includes `rejectedByReason` so the user can verify filter behaviour against live data before flipping the switch.

## D8 — Explicit rejection-reason classifier (not boolean isNewTrial)

**Choice:** `classifyTrial(license, opts)` returns `{ok:true} | {ok:false, reason: RejectReason}` where `RejectReason` is a discriminated union of named reasons.
**Alternative:** A simple `isNewTrial: boolean` predicate.
**Reasoning:** During the dry-run phase, knowing *why* a license was filtered (e.g. `partner-domain` vs `outside-lookback-window` vs `missing-company`) is the difference between "this filter is right" and "this filter is wrong but I can't tell". The orchestrator aggregates rejections into `rejectedByReason: Record<string, number>` in the run summary.

## D9 — Filter criteria for "real new trial prospect"

**Choice:** A license must pass all of:
- `licenseType === "EVALUATION"` AND not OPEN_SOURCE / COMMUNITY / DEVELOPER / ACADEMIC / CLASSROOM / PERSONAL / STARTER
- `hosting === "Cloud"`
- `status` is `active` or blank
- Email is non-empty AND not `@atlassian.com` (or subdomain) AND not in the partner domain list
- Company is non-empty
- `maintenanceStartDate` is within `NEW_TRIAL_LOOKBACK_DAYS` (default 7)
- Not previously sent to this license-id OR this email-for-this-app

**Reasoning:** Original `isNewTrial` was too permissive — it would have emailed every admin install, every Atlassian internal test, every partner sandbox. Tightened after user pushed back asking for "only new prospect trials". Each filter has a specific failure mode it addresses, captured in [tests/marketplace.test.ts](tests/marketplace.test.ts).
**Known caveat:** Cloud Marketplace has no "self-serve form submission" flow for trials — every Cloud eval is admin-install-driven. So we approximate "real prospect" via the negative filters above, not via a positive signal. Awaiting a sample API response to potentially tighten further (e.g. via `evaluationOpportunitySize` if present).

## D10 — Two-layer dedupe + atomic claim

**Choice:** Per-license-id dedupe AND per-email-for-this-app dedupe, both in Redis. License-id dedupe uses an atomic `SET ... NX` with a 5-minute TTL to claim the lock before send, then promoted to permanent on success or released on failure.
**Reasoning:** Defence in depth. The atomic claim was added after the architecture review surfaced a race-condition window. The per-email layer prevents legitimate edge cases (e.g. same admin reinstalling, or multiple licenses arriving for the same email) from triggering duplicate welcomes.

## D11 — Watermark bounded by earliest failed license

**Choice:** When a transient send failure occurs, the watermark is NOT advanced past that license's `lastUpdated`. Specifically, the new watermark is `min(maxSuccessDate, earliestFailedDate - 1 day)`.
**Reasoning:** Original implementation advanced the watermark unconditionally before send attempts, meaning a transient Graph 429/503 would permanently lose that welcome. The fix guarantees the next run refetches anything that failed.
**Trade-off accepted:** On runs with failures, the next run does redundant work (refetches some already-successful licenses). The per-license dedupe handles this cleanly with no double-sends.

## D12 — Template HTML lives in `emails/welcome-preview.html`

**Choice:** Single source of truth for the email template is the file `emails/welcome-preview.html` with `{{placeholder}}` syntax. `lib/template.ts` reads it via `readFileSync` at module load.
**Alternative:** Inline the HTML as a TypeScript string constant.
**Reasoning:** Keeps the file viewable as a static HTML preview (placeholders show as literal text) for design iteration, while the same file is what gets sent to real recipients. Configured `outputFileTracingIncludes` in [next.config.mjs](next.config.mjs) so Vercel bundles it into the serverless function.

## D13 — Deployment intentionally deferred (no prod, no staging)

**Choice as of 2026-05-13:** The project remains pre-deployment. No Vercel project linked, no Azure AD app registered, no Upstash database provisioned, no real Marketplace API token used. Code lives on GitHub `main`; that's the only artefact.
**Reasoning:** Explicit user direction — "I do not want the solution to go to production just yet." Reasons not enumerated; could be timing, business prioritisation, or wanting more review of the architecture before committing real customer data to the system.
**Implication for future sessions:** do **not** suggest "next step is to follow SETUP.md" or frame the user-side setup checklist as a backlog to burn down. Frame deployment actions as "when you're ready" — never as the current trajectory. Refinement work on the codebase continues to be fine. Production-touching actions wait for explicit go-ahead.
