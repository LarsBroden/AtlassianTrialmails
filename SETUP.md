# Setup — Trial Welcome Automation

One-time setup to wire up the cron job that watches the Atlassian Marketplace for new trial activations and emails each new evaluator from `lars.broden@lbconsultinggroup.org`.

Estimated time: 25–30 minutes.

---

## 1. Atlassian Marketplace API token (2 min)

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**, label it `bulk-clone-trial-mailer`, copy the token (only shown once)
3. You'll set these env vars:
   - `MARKETPLACE_VENDOR_ID=38407`
   - `MARKETPLACE_USER_EMAIL=<the Atlassian account email that owns the vendor>`
   - `MARKETPLACE_API_TOKEN=<paste>`
   - `MARKETPLACE_APP_KEY=com.lbcg.bulkclone` *(optional — filters API to just this app)*

Test locally:
```
curl -u "$MARKETPLACE_USER_EMAIL:$MARKETPLACE_API_TOKEN" \
  "https://marketplace.atlassian.com/rest/2/vendors/38407/reporting/licenses?licenseType=EVALUATION"
```
Should return a JSON object with a `licenses` array.

---

## 2. Azure AD app registration for Microsoft Graph (10 min — needs Entra admin on the tenant that owns `lbconsultinggroup.org`)

### 2a. Register the app
- https://entra.microsoft.com → **App registrations** → **New registration**
- Name: `Bulk Clone Trial Mailer`
- Supported account types: *Accounts in this organizational directory only*
- Redirect URI: leave blank
- Click **Register**

Copy from the overview page:
- **Application (client) ID** → `AZURE_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_TENANT_ID`

### 2b. Grant Mail.Send (application permission)
- **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**
- Search for `Mail.Send` → tick it → **Add permissions**
- Click **Grant admin consent for <tenant>** (requires admin role)
- Verify status shows green checkmark next to `Mail.Send`

### 2c. Create client secret
- **Certificates & secrets** → **Client secrets** → **New client secret**
- Description: `prod`, expiry: 24 months
- **Copy the Value (not the Secret ID)** immediately — it's only shown once
- → `AZURE_CLIENT_SECRET`

### 2d. Restrict the app to one mailbox (critical security step)
Without this, the app can send mail as **any user in the tenant**. Scope it to just `lars.broden@lbconsultinggroup.org`:

Open PowerShell (with Exchange Online module):
```powershell
Install-Module ExchangeOnlineManagement -Force   # first time only
Connect-ExchangeOnline

# 1. Create a mail-enabled security group with just the sender mailbox
New-DistributionGroup -Name "BulkCloneMailerSenders" -Type "Security" `
  -Members @("lars.broden@lbconsultinggroup.org")

# 2. Restrict the app's Mail.Send to only that group
New-ApplicationAccessPolicy `
  -AppId <AZURE_CLIENT_ID> `
  -PolicyScopeGroupId BulkCloneMailerSenders@lbconsultinggroup.org `
  -AccessRight RestrictAccess `
  -Description "Bulk Clone trial mailer: only send from lars.broden"

# 3. Verify
Test-ApplicationAccessPolicy `
  -Identity lars.broden@lbconsultinggroup.org `
  -AppId <AZURE_CLIENT_ID>
# Expect: AccessCheckResult = Granted
```

If you skip this, the app technically *could* impersonate any tenant mailbox. Don't skip it.

### 2e. Env vars
- `AZURE_TENANT_ID=<tenant id>`
- `AZURE_CLIENT_ID=<client id>`
- `AZURE_CLIENT_SECRET=<secret value>`
- `GRAPH_SENDER_USER_ID=lars.broden@lbconsultinggroup.org`
- `GRAPH_REPLY_TO_EMAIL=lars.broden@lbconsultinggroup.org`

---

## 3. DNS for deliverability (5 min — `lbconsultinggroup.org`)

Already added as a verified domain in your M365 tenant, but recipient inboxes will still spam-filter you without these records. From the M365 admin center → **Settings** → **Domains** → `lbconsultinggroup.org`:

- **SPF:** TXT at root → `v=spf1 include:spf.protection.outlook.com -all`
- **DKIM:** Exchange admin → **Mail flow** → **DKIM** → enable for `lbconsultinggroup.org` (auto-creates two CNAME records)
- **DMARC:** TXT at `_dmarc.lbconsultinggroup.org` → `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@lbconsultinggroup.org; pct=100`

Verify with `dig TXT lbconsultinggroup.org` and https://mxtoolbox.com/dmarc.aspx.

---

## 4. Upstash Redis via Vercel Marketplace (3 min)

Used for deduping ("we already emailed this trial") and tracking the high-water mark of `lastUpdated`.

1. From the Vercel project page → **Storage** tab → **Create Database** → **Upstash** → **Redis**
2. Free tier ("Free" — 10K commands/day) is plenty
3. Click **Connect to Project** — this auto-injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into your env

---

## 5. Vercel project setup (5 min)

```
cd "C:\Data\Atlassian Marketplace email extracts\Sales Extract from Atlassian Marketplace"
npx vercel link             # link to a new or existing project
npx vercel env add MARKETPLACE_VENDOR_ID         # value: 38407
npx vercel env add MARKETPLACE_USER_EMAIL
npx vercel env add MARKETPLACE_API_TOKEN
npx vercel env add MARKETPLACE_APP_KEY            # value: com.lbcg.bulkclone
npx vercel env add AZURE_TENANT_ID
npx vercel env add AZURE_CLIENT_ID
npx vercel env add AZURE_CLIENT_SECRET
npx vercel env add GRAPH_SENDER_USER_ID
npx vercel env add GRAPH_REPLY_TO_EMAIL
npx vercel env add DRY_RUN                        # value: true (flip to false later)
npx vercel env add CRON_SECRET                    # value: long random string, e.g. `openssl rand -hex 32`
npx vercel env add CALENDAR_URL                   # your Calendly link
npx vercel env add DOCS_URL                       # docs link
npx vercel env add QUICKSTART_URL                 # quickstart video link
npx vercel env add NEW_TRIAL_LOOKBACK_DAYS        # value: 7 (only act on trials started in last N days)
```

Then deploy:
```
npx vercel deploy --prod
```

The cron runs daily at **09:00 UTC** (configured in `vercel.json`). Change the cron expression there if you want a different cadence (Pro plan supports down to per-minute).

---

## 6. Verify (dry-run)

With `DRY_RUN=true` set:

```
# Manual trigger via secret
curl "https://<your-project>.vercel.app/api/cron/welcome-trials?secret=$CRON_SECRET"
```

Response is a JSON summary like:
```json
{
  "dryRun": true,
  "fetched": 12,
  "rejected": 9,
  "rejectedByReason": {
    "outside-lookback-window": 5,
    "partner-domain": 2,
    "atlassian-internal": 1,
    "missing-company": 1
  },
  "alreadySent": 0,
  "attempted": 3,
  "sent": 3,
  "failed": 0,
  "results": [
    { "licenseId": "SEN-L12345", "email": "sara@acme.com", "company": "Acme Corp", "status": "dry-run" },
    { "licenseId": "SEN-L67890", "email": "qa@team.atlassian.com", "company": "Atlassian", "status": "rejected", "reason": "atlassian-internal" }
  ]
}
```

The `rejectedByReason` breakdown is the key thing to inspect during dry-run. Possible reasons:

| Reason | Meaning |
|---|---|
| `not-evaluation` | Not an EVALUATION license type |
| `not-cloud` | Hosting is Data Center / Server |
| `inactive` | License status is not "active" |
| `non-prospect-type` | OPEN_SOURCE / COMMUNITY / DEVELOPER / ACADEMIC / CLASSROOM / PERSONAL / STARTER |
| `atlassian-internal` | Email is `@atlassian.com` or `*.atlassian.com` |
| `partner-domain` | Email matches a known partner / reseller domain (adaptavist, eficode, etc — full list in `lib/partners.ts`) |
| `missing-company` | Company field is blank (often signals a test / personal account) |
| `missing-email` | No technical or billing contact email on the license |
| `missing-start-date` | `maintenanceStartDate` is blank or unparseable |
| `outside-lookback-window` | License started more than `NEW_TRIAL_LOOKBACK_DAYS` ago (default 7) |
| `already-sent` | We previously emailed this exact license ID |
| `already-emailed` | This email already received a welcome for this app (different license) |

In Vercel logs you'll see `[dry-run] would send welcome to sara@acme.com (license SEN-L12345, ...)` for each one. **No email is sent and the watermark is not advanced**, so you can run it as many times as you like.

Preview the rendered email:
```
https://<your-project>.vercel.app/api/debug/preview-template?firstName=Sara&company=Acme%20Corp&trialEndDate=2026-06-12
```

When happy, flip `DRY_RUN=false` in Vercel env vars and redeploy. The next cron run (or next manual trigger) will actually send.

---

## Local dev

Create `.env.local` with the same env vars (or just `DRY_RUN=true` and the Marketplace creds — local Redis falls back to in-memory).

```
npm run dev
# Then in another shell:
curl "http://localhost:3000/api/cron/welcome-trials"   # no secret needed if CRON_SECRET is unset
curl "http://localhost:3000/api/debug/preview-template" -o preview.html && start preview.html
```

`npm test` runs the unit tests for the template and Marketplace parsing.

---

## Operational notes

- **Watermark:** the orchestrator tracks the highest `lastUpdated` it's seen. On the next run it asks the Marketplace API for licenses updated since that date, then dedupes per-license via Redis. On first run with no watermark, it looks back 7 days.
- **Re-sending:** if you ever need to re-send to a specific license, delete the key `trial:sent:<addonLicenseId>` from Upstash.
- **Reset:** to start over, delete the `trial:watermark` and all `trial:sent:*` keys from Upstash.
- **What counts as a "new trial":** `licenseType=EVALUATION`, `hosting=Cloud`, and `status` either blank or `active`. Tweak in `lib/marketplace.ts` → `isNewTrial`.
- **Where to change the email copy:** edit `emails/welcome-preview.html` (which is the production template). Visual changes flow through automatically.
