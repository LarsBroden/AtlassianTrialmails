# Forge integration snippets for Bulk Clone Professional

These files belong in the **Bulk Clone Professional for Jira** Forge app's own repository — not this one. They wire the app's `installed` lifecycle event to the welcome-trial webhook hosted in this Vercel project so that new trial users receive a personalized welcome within ~60–90 seconds of clicking "Try it free."

## Architecture

```
Atlassian fires avi:forge:installed:app
    │
    ▼
Forge trigger: handleInstall (this snippet)
    │  (skips non-production environments)
    │  enqueues a delayed task
    ▼
Forge queue (60s delay) → Forge consumer: welcomeConsumer
    │
    ▼
HTTPS POST → https://<vercel-app>/api/lifecycle/installed
                (Authorization: Bearer FORGE_WEBHOOK_SECRET)
    │
    ▼
Vercel endpoint → runWelcomeTrials() → Microsoft Graph sendMail
```

The 60s delay closes the race between Atlassian firing the install event and the Marketplace REST API reflecting the new license record.

## Files

| File | Where it goes in the Forge app |
|---|---|
| `manifest-additions.yaml` | Merge into `manifest.yml` (don't replace — these are additions) |
| `src/welcome-trigger.ts` | New file at `src/welcome-trigger.ts` (or wherever your handlers live) |

## Installation steps inside the Forge app repo

1. **Add the dependency** if not already present:
   ```
   npm install @forge/events
   ```

2. **Merge `manifest-additions.yaml`** into the existing `manifest.yml`. If the app already has a `modules` section, merge under it; don't duplicate the top-level key.

3. **Copy `src/welcome-trigger.ts`** into the app's source directory. Adjust the handler path in the manifest if you place it elsewhere.

4. **Update the `permissions.external-fetch.backend`** in the manifest to include your actual Vercel domain (replace the placeholder).

5. **Set Forge environment variables** for each environment you deploy to:
   ```
   forge variables set --encrypt WELCOME_WEBHOOK_URL    https://<your-vercel-app>.vercel.app/api/lifecycle/installed
   forge variables set --encrypt WELCOME_WEBHOOK_SECRET <same value as FORGE_WEBHOOK_SECRET on Vercel>
   ```

6. **Deploy and verify:**
   ```
   forge deploy
   forge install        # or forge install --upgrade
   ```

   In production, watch Vercel logs for `[lifecycle] install event received` when a real trial user installs the app.

## Testing without spamming real users

`handleInstall` skips environments where `context.environmentType !== "production"`, so deploying to `development` / `staging` won't trigger welcome emails. You can also keep `DRY_RUN=true` on the Vercel side as a second safety net — the lifecycle endpoint respects the same dry-run flag as the daily cron.

## Rollback

If anything misbehaves, remove the `trigger` / `consumer` modules from the manifest and redeploy. The Vercel endpoint becomes dead but harmless. The daily cron continues to work as the original safety net.
