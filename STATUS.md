# Status & Resume Notes

**Last updated:** 2026-05-27 (resumed same day, paused mid-deployment)

If you (or a future Claude session) are resuming work on this project, start here.

## TL;DR

**Local rehearsal complete. Vercel Hobby deployment IN PROGRESS — paused at git email blocker.**

### Current blocker (Vercel deployment):
Vercel blocks deployment when commit author email doesn't match a GitHub account on the team. Fixed git config to `lars.broden@enterprisemovement.com` (correct GitHub account email). Latest commit `76641e1` pushed with correct author email — awaiting Vercel webhook to pick it up and auto-deploy. Once that deploys successfully, move to Task #5 (dry-run verification).

### What's been completed in this session (2026-05-27 afternoon):
- ✅ Linked project to Vercel (project-005vw)
- ✅ Set all Vercel env vars: Marketplace creds, CC_EMAIL, DRY_RUN, NEW_TRIAL_LOOKBACK_DAYS, CRON_SECRET, FORGE_WEBHOOK_SECRET
- ✅ Connected Upstash Redis (auto-created vars with wrong prefix; manually added UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN with correct values)
- ✅ Fixed git config email to match GitHub account
- ⏸️ Waiting on Vercel to deploy commit `76641e1` with correct author email

### Next steps (when resuming):
1. Check Vercel Deployments tab — if `76641e1` deployed successfully, skip to step 3
2. If still blocked: refresh Vercel page, wait 30s, check again
3. Once deployed: verify dry-run via `curl https://project-005vw.vercel.app/api/cron/welcome-trials?secret=$CRON_SECRET`
4. Update STATUS.md to mark Vercel deployment done
5. Phase 3 deferred: Azure AD (§2), DNS (§3), flip DRY_RUN=false

## What's built and committed

| Workflow | Status | Notes |
|---|---|---|
| CSV review-outreach UI | ✅ End-to-end working locally | Dev server: `npm run dev`, drop `fixtures/sample-transactions.csv` |
| Trial classifier + filters | ✅ 24 unit tests | [lib/marketplace.ts](lib/marketplace.ts), [tests/marketplace.test.ts](tests/marketplace.test.ts) — now includes `bugcrowdninja.com` and company-name pattern filters from local rehearsal |
| Marketplace API client | ✅ **Verified against real API** | 408 EVAL licenses returned for vendor 38407 in the 2026-05-27 rehearsal |
| Microsoft Graph sendMail | ✅ Built, untested against real tenant | Untouched in local rehearsal — DRY_RUN short-circuits before Graph is called. Awaiting Azure app registration at deployment time. |
| Upstash state (dedupe + claims) | ✅ 11 unit tests | Works locally via the `InMemoryRedis` fallback when Upstash env vars are unset and `NODE_ENV !== production` |
| Welcome (day-1) template | ✅ Lars-supplied HTML, dark hero, founder-as-PM voice | [emails/welcome-preview.html](emails/welcome-preview.html). Verified visually in real Outlook on 2026-05-27. |
| Day-9 follow-up template | ✅ Lars-supplied HTML, check-in framing | [emails/day9-followup.html](emails/day9-followup.html) |
| Cron endpoint (two-pass) | ✅ `/api/cron/welcome-trials` | Returns split `day1`/`day9` summary JSON with `rejectedByReason` for each pass |
| CC-self on every send | ✅ Driven by `CC_EMAIL` env var | [lib/graph.ts](lib/graph.ts) — skips CC if it equals the recipient |
| 5-minute cron schedule | ✅ Set in `vercel.json` | Requires Vercel Pro to actually fire at this frequency; capped to daily on Hobby (sits in source code ready for Pro upgrade) |
| Forge lifecycle endpoint | ✅ Built but dormant | `/api/lifecycle/installed` — Option A scaffold, not wired (see [DECISIONS.md D6](DECISIONS.md)) |
| Forge integration snippets | ✅ Ready to copy into Forge app repo | `bulk-clone-forge-snippets/` — used only when graduating to Option A |
| Local Outlook preview tool | ✅ Renders email as a local `.eml` file | [scripts/preview-in-outlook.ps1](scripts/preview-in-outlook.ps1) |
| Self-test email script | ✅ Sends test from your own Outlook desktop | [scripts/send-self-test-email.ps1](scripts/send-self-test-email.ps1) — bypasses Graph; supports `-Template day1\|day9`, `-Mode Display\|Send`, `-FromEmail` for multi-account Outlook |
| GitHub repo | ✅ Published | https://github.com/LarsSverkerBroden/Sales-Extract-from-Atlassian-Marketplace |
| Tests | ✅ **65 passing** | `npm test` |
| Production build | ✅ Clean | `npm run build` |

## Local rehearsal findings (2026-05-27)

Real numbers from hitting `/api/cron/welcome-trials` against the live Marketplace API in DRY_RUN mode:

- **Fetched:** 408 EVALUATION licenses updated in the last 30 days
- **Day-1 rejections breakdown:**
  - `not-cloud: 300` (Data Center / Server installs — correct exclusion)
  - `not-evaluation: 73` (API filter is loose; client-side check catches them — known quirk, non-blocking)
  - `outside-lookback-window: 10` (started > 7 days ago)
  - `inactive: 8`
  - `atlassian-internal: 6` (all `@bugcrowdninja.com` — caught by the new filter)
  - `non-prospect-company: 6` (caught by the new pattern filter)
- **Day-1 would-send:** **5 candidates**, all looking like legitimate prospects after filter tightening (1 Taiwan semiconductor company, 1 MSP / Rambus instance, 3 borderline solo evaluators — acceptable false-positive rate)
- **Day-9 would-send:** **0** (expected; first-ever run, in-memory state, day-1 records don't exist yet for trials in the 9–30 day window)

Detail in [DECISIONS.md D18](DECISIONS.md).

## Local rehearsal setup

A `.env.local` file exists at the project root with the Marketplace API credentials. It's gitignored (`.env*.local` pattern). To re-run the rehearsal in a future session:

1. `npm run dev` (dev server picks up `.env.local` automatically)
2. Smoke tests:
   - `http://localhost:3000/` (CSV uploader)
   - `http://localhost:3000/api/debug/preview-template?template=day1` (and `?template=day9`)
3. Real run: `curl http://localhost:3000/api/cron/welcome-trials` → inspect JSON
4. Visual fidelity: `powershell -ExecutionPolicy Bypass -File scripts/send-self-test-email.ps1`

In-memory state means dedupe resets on each `npm run dev` restart — perfect for repeatable rehearsals.

## Deployment checklist (still pending)

User-side actions in [SETUP.md](SETUP.md), to be done when Lars decides to deploy to Vercel.

- [ ] Azure AD app registration ("Bulk Clone Trial Mailer") with `Mail.Send` application permission + admin consent
- [ ] Exchange Online `New-ApplicationAccessPolicy` scoping the app to `lars.broden@lbconsultinggroup.org` only
- [ ] DNS records on `lbconsultinggroup.org`: SPF, DKIM (enable in M365), DMARC
- [ ] Upstash Redis database provisioned via Vercel Marketplace
- [ ] `vercel link` to a new Vercel project
- [ ] **Upgrade to Vercel Pro** if 5-minute polling is desired (Hobby caps cron at daily; the `*/5 * * * *` schedule sits in `vercel.json` ready for activation)
- [ ] All env vars set in Vercel (Marketplace token already validated locally — same values):
  - `MARKETPLACE_VENDOR_ID=38407`
  - `MARKETPLACE_USER_EMAIL=lars.broden@lbconsultinggroup.org`
  - `MARKETPLACE_API_TOKEN=<the rehearsal token, or a new one>`
  - `MARKETPLACE_APP_KEY=com.lbcg.jira.plugin.pro.BulkClonePro`
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
  - `GRAPH_SENDER_USER_ID=lars.broden@lbconsultinggroup.org`
  - `GRAPH_REPLY_TO_EMAIL=lars.broden@lbconsultinggroup.org`
  - `CC_EMAIL=lars.broden@lbconsultinggroup.org` (every welcome / day-9 email is CC'd here)
  - `DRY_RUN=true` (initially)
  - `CRON_SECRET` (e.g. `openssl rand -hex 32`)
  - `NEW_TRIAL_LOOKBACK_DAYS=7`
- [ ] First deploy: `npx vercel deploy --prod`
- [ ] First manual dry-run: `curl "https://<project>.vercel.app/api/cron/welcome-trials?secret=$CRON_SECRET"` — should match what the local rehearsal showed (~5 day-1 would-send, day-9 ramping up over time)
- [ ] Flip `DRY_RUN=false` once confident
- [ ] Watch a real trial install (or a self-installed test instance) trigger a welcome

## Pending decisions / parking lot

- **Vercel Pro upgrade for tighter polling.** Hobby = daily cron only. Pro ($20/mo) allows the `*/5 * * * *` schedule already in `vercel.json` to actually fire. Decision deferred.
- **Forge trigger activation** ([DECISIONS.md D6](DECISIONS.md)). The Vercel-side scaffold exists. When Lars touches the Forge app, follow [bulk-clone-forge-snippets/README.md](bulk-clone-forge-snippets/README.md). End-to-end latency drops to ~90s.
- **The `not-evaluation: 73` API quirk.** The Marketplace API filter is `?licenseType=EVALUATION` but 73 records came back as non-evaluation. Client-side check rejects them correctly so behaviour is right — but worth investigating why the API filter isn't strict. Not blocking.
- **Outlook Classic rendering** ([DECISIONS.md D19](DECISIONS.md)). Templates render degraded but readable in Outlook Classic / M365 desktop (Word engine). Lars accepted the trade-off rather than do a bulletproof-email rewrite. Revisit only if recipient feedback indicates a problem.

## Architecture review smells (not blocking, deferred)

- Sequential sends — switch to `Promise.allSettled` with concurrency cap when volume justifies
- No failure alerting — add "email Lars if `failed > 0` at end of run" when going live
- No outbound link tracking — add UTM params (`?utm_source=trial-welcome&utm_medium=email&utm_content=cta-book-call`) to template URLs
- Permanent per-email dedupe without TTL — consider 365-day TTL if re-engagement campaigns are ever in scope
- CSV tool + automation in one project — cosmetic; split if another developer joins

## Resume hints for future sessions

- **Local rehearsal is done; the natural next step IS the Vercel deployment**, but only if Lars asks. Don't push toward it unprompted.
- All architectural reasoning is in [DECISIONS.md](DECISIONS.md). Don't re-derive choices that are documented there; if you disagree, append a new decision rather than rewriting old ones. D18 captures the local-rehearsal filter findings.
- Lars prefers concise responses with concrete recommendations and tradeoffs. Numbered options work well. Pushback is high-signal — listen.
- Email voice is **founder-as-PM** ([DECISIONS.md D14](DECISIONS.md), supersedes D3). "Lars Brodén, Product Manager" appears in both templates. Don't revert to either pure team voice or pure founder voice without explicit ask.
- Sender domain is `lars.broden@lbconsultinggroup.org` ([DECISIONS.md D4](DECISIONS.md)). The Outlook desktop default account is `lars.broden@enterprisemovement.com` — important to know if running the self-test script (use the `-FromEmail` param or it'll send from the wrong account).
- The repo uses GitHub Desktop for git workflow on the user's end. Commits via Claude land on `main` and push fine via `git push`.
- Recent commit log on `main` (most recent first):
  - `<this commit>` — filter tightening from local rehearsal + self-test script + docs sync
  - `262d919` — Two-email cadence (day-1 + day-9), CC self, 5-min cron, founder-as-PM voice
  - `877f5ad` — Reframe docs: deployment deferred (then later lifted)
  - `742e27c` — Add CONTEXT, DECISIONS, STATUS for session resume
