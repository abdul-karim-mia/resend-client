# Configuration Reference

All configuration is done via **Wrangler Secrets** (sensitive) or **`wrangler.jsonc` vars** (non-sensitive).

## Secrets (set via `wrangler secret put`)

| Secret | Required | Description |
|---|---|---|
| `MASTER_ENCRYPTION_KEY` | ✅ | 64-char hex string. Used to AES-256-GCM encrypt Resend API keys stored in D1. Generate with: `node -e "require('crypto').randomBytes(32).toString('hex')"` |
| `JWT_SECRET` | ✅ | 64+ char random string. Signs login session JWTs. Generate with: `node -e "require('crypto').randomBytes(48).toString('hex')"` |
| `ADMIN_USERNAME` | ✅ | Your login username |
| `ADMIN_PASSWORD_HASH` | ✅ | SHA-256 hash of your password. Generate with: `node -e "require('crypto').createHash('sha256').update('yourpassword').digest('hex')"` |

## Environment Variables (`wrangler.jsonc` `[vars]`)

| Variable | Default | Description |
|---|---|---|
| `ENVIRONMENT` | `production` | Used for logging. Set to `development` for local dev |

## Changing Secrets

To rotate any secret:

```bash
cd worker
npx wrangler secret put SECRET_NAME
```

Type the new value when prompted. Changes take effect on the next Worker request (no redeploy needed).

## Cloudflare Bindings (`wrangler.jsonc`)

| Binding | Type | Description |
|---|---|---|
| `DB` | D1 Database | SQLite database for emails, accounts, attachments, templates |
| `R2` | R2 Bucket | Object storage for email attachment files |
| `AI` | Workers AI | Llama 3.1 8B for draft replies, summaries, tone |
| `ASSETS` | Static Assets | Serves the React SPA frontend |

## Local Development Variables (`worker/.dev.vars`)

Copy `worker/.dev.vars.example` to `worker/.dev.vars` and fill in real values.  
This file is gitignored and never committed.
