# Status & Resume Notes

**Last updated:** 2026-05-13

If you (or a future Claude session) are resuming work on this project, start here.

## TL;DR

The code is built and tested. **Deployment is intentionally deferred** — Lars has explicitly held the project at the pre-deployment stage. No Vercel project linked, no Azure AD app registered, no Upstash database provisioned, no real Marketplace API token in use. The repo on `main` is the artefact; nothing touches production. When Lars chooses to move forward, [SETUP.md](SETUP.md) walks the path. **Do not push toward deployment unless explicitly asked.**

## What's built and committed

| Workflow | Status | Notes |
|---|---|---|
| CSV review-outreach UI | ✅ End-to-end working locally | Dev server: `npm run dev`, drop `fixtures/sample-transactions.csv` |
| Trial classifier + filters | ✅ 18 unit tests, all reasons covered | [lib/marketplace.ts](lib/marketplace.ts), [tests/marketplace.test.ts](tests/marketplace.test.ts) |
| Marketplace API client | ✅ Built, untested against real API | Awaiting real `MARKETPLACE_API_TOKEN` for live verification |
| Microsoft Graph sendMail | ✅ Built, untested against real tenant | Awaiting Azure app registration |
| Upstash state (dedupe + watermark) | ✅ 7 unit tests via in-memory mock | Works locally without Upstash; falls back to in-memory |
| Welcome email template | ✅ Designed, previewed in Outlook via `.eml` | [emails/welcome-preview.html](emails/welcome-preview.html) |
| Daily cron endpoint | ✅ `/api/cron/welcome-trials` | Returns rich JSON summary with `rejectedByReason` |
| Forge lifecycle endpoint | ✅ Built but dormant | `/api/lifecycle/installed` — Option A scaffold, not wired (see [DECISIONS.md D6](DECISIONS.md)) |
| Forge integration snippets | ✅ Ready to copy into Forge app repo | `bulk-clone-forge-snippets/` — used only when graduating to Option A |
| Local Outlook preview tool | ✅ | [scripts/preview-in-outlook.ps1](scripts/preview-in-outlook.ps1) |
| GitHub repo | ✅ Published | https://github.com/LarsSverkerBroden/Sales-Extract-from-Atlassian-Marketplace |
| Tests | ✅ 48 passing | `npm test` |
| Production build | ✅ Clean | `npm run build` |

## Deployment checklist (deliberately not done)

These are the user-side actions in [SETUP.md](SETUP.md), to be done **only when Lars decides to deploy**. Not a backlog — a held checklist. Until then, the project intentionally remains in pre-deployment state.

- [ ] Atlassian Marketplace API token created
- [ ] Azure AD app registration ("Bulk Clone Trial Mailer") with `Mail.Send` application permission + admin consent
- [ ] Exchange Online `New-ApplicationAccessPolicy` scoping the app to `lars.broden@lbconsultinggroup.org` only
- [ ] DNS records on `lbconsultinggroup.org`: SPF, DKIM (enable in M365), DMARC
- [ ] Upstash Redis database provisioned via Vercel Marketplace
- [ ] `vercel link` to a new Vercel project
- [ ] All env vars set in Vercel:
  - `MARKETPLACE_VENDOR_ID`, `MARKETPLACE_USER_EMAIL`, `MARKETPLACE_API_TOKEN`, `MARKETPLACE_APP_KEY`
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
  - `GRAPH_SENDER_USER_ID`, `GRAPH_REPLY_TO_EMAIL`
  - `DRY_RUN=true` (initially)
  - `CRON_SECRET` (e.g. `openssl rand -hex 32`)
  - `CALENDAR_URL`, `DOCS_URL`, `QUICKSTART_URL`
  - `NEW_TRIAL_LOOKBACK_DAYS=7`
- [ ] First deploy: `npx vercel deploy --prod`
- [ ] First manual dry-run: `curl "https://<project>.vercel.app/api/cron/welcome-trials?secret=$CRON_SECRET"`
- [ ] Inspect the returned `rejectedByReason` breakdown; verify filters look right on real data
- [ ] Flip `DRY_RUN=false` once confident, redeploy
- [ ] Watch first real welcome land in a test trial install

## Pending decisions / parking lot

- **Calendar / docs / quickstart URLs.** Currently the template defaults in [lib/env.ts](lib/env.ts) point at placeholder Calendly URL + the Marketplace listing. User to provide final URLs (or set the env vars accordingly) before going live.
- **Vercel Pro upgrade for tighter polling.** Free tier = daily cron only. Pro ($20/mo) allows per-minute cron, which collapses the worst-case trial-to-welcome latency from ~24h to ~5min. Decision deferred; user signalled OK to start with daily.
- **Forge trigger activation (Option A in [DECISIONS.md D6](DECISIONS.md)).** The Vercel-side scaffold exists. When the user is ready to touch the Forge app, follow [bulk-clone-forge-snippets/README.md](bulk-clone-forge-snippets/README.md). End-to-end latency drops to ~90s.
- **Real Marketplace API response sample.** Filters are based on a reasonable read of the API docs but not verified against an actual response. Asking the user to share a redacted real response would allow tightening filters (e.g. via `evaluationOpportunitySize` if that field is present).

## Architecture review smells (not blocking, deferred)

From the review at [DECISIONS.md D6](DECISIONS.md)-era. These were acknowledged and accepted as later-iteration work:

- Sequential sends — switch to `Promise.allSettled` with concurrency cap when volume justifies (~10 emails/day to thousands)
- No failure alerting — add "email Lars if `failed > 0` at end of run" when going live
- No outbound link tracking — add UTM params (`?utm_source=trial-welcome&utm_medium=email&utm_content=cta-book-call`) to template URLs
- Permanent per-email dedupe without TTL — consider 365-day TTL if re-engagement campaigns are ever in scope
- CSV tool + automation in one project — cosmetic; split if another developer joins

## Resume hints for future sessions

- **Deployment is on hold by explicit user direction.** Do not frame "next steps" as setup/deployment actions. Code refinement, doc updates, design iteration are all fine; touching Vercel / Azure / Upstash / real Marketplace API is not, unless Lars explicitly asks.
- All architectural reasoning is in [DECISIONS.md](DECISIONS.md). Don't re-derive choices that are documented there; if you disagree, append a new decision rather than rewriting old ones.
- The user prefers concise responses with concrete recommendations and tradeoffs, not menus of options. They make decisions quickly (numbered answers) and push back hard when something isn't right (good signal — listen).
- Email voice and sender domain are settled (team voice, `lars.broden@lbconsultinggroup.org`) and shouldn't be revisited unless explicitly asked.
- The repo uses GitHub Desktop for git workflow on the user's end. Commits via Claude land on `main` and push fine via `git push`.
- Two recent commits on `main`:
  - `bf938c5` — Add Forge-triggered welcome path (Option A scaffold, dormant)
  - `2b99944` — Fix watermark drop-on-failure + add atomic per-license send claim
  - `2b844bd` — Initial Marketplace toolkit
