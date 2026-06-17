# resend-client

> A self-hosted, open-source, multi-tenant email client for [Resend](https://resend.com) — built entirely on Cloudflare's edge platform.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/abdul-karim-mia/resend-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

- 📥 **Multi-tenant inbox** — manage 4–10 Resend accounts/domains in one place
- 🧵 **Email threading** — In-Reply-To / References header resolution
- 🤖 **Workers AI** — draft replies, summarize threads, adjust tone (formal/casual/concise)
- ✏️ **Rich composer** — TipTap editor, CC/BCC, reply/forward, drag-and-drop attachments
- 🔒 **Secure by default** — JWT auth, AES-256 encrypted API keys, DOMPurify + sandboxed iframe rendering, HMAC webhook verification
- 🔎 **Full-text search** — FTS5 SQLite search across all email fields
- 📋 **Email templates** — with `{{variable}}` interpolation
- ⌨️ **Keyboard shortcuts** — Gmail-style (C, R, E, #, ?, ⌘K)
- 🌍 **Edge-native** — ~50ms global cold start, no servers to manage

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Cloudflare Workers |
| **API** | Hono.js |
| **Database** | Cloudflare D1 (SQLite) |
| **Storage** | Cloudflare R2 (attachments) |
| **AI** | Cloudflare Workers AI (Llama 3.1 8B) |
| **Email** | Resend API + Inbound webhooks |
| **Frontend** | React 19 + Vite |
| **State** | TanStack Query + Zustand |
| **Editor** | TipTap |
| **Package manager** | pnpm |

---

## Deploy to Cloudflare (One-Click)

Click the button above — Cloudflare will:
1. Fork this repo to your GitHub account
2. Show a setup form to **select or create** your D1 database and R2 bucket
3. Prompt you for the required secrets (see below)
4. Build and deploy automatically

> **⚡ Zero SQL needed** — the database schema is created automatically on the first request.

### Required Secrets for Deploy

Before clicking deploy, run the setup script to generate all required values:

```bash
node scripts/setup-secrets.mjs
```

This generates and writes your `.dev.vars` for local dev, and prints the values you need to paste into the Cloudflare deploy form:

| Secret | Description |
|---|---|
| `MASTER_ENCRYPTION_KEY` | AES-256 key for encrypting Resend API keys |
| `JWT_SECRET` | Signs admin session tokens |
| `ADMIN_USERNAME` | Your admin panel login username |
| `ADMIN_PASSWORD_HASH` | SHA-256 hash of your admin password |

---

## Manual Deploy

### 1. Clone & Install

```bash
git clone https://github.com/abdul-karim-mia/resend-client.git
cd resend-client
pnpm install
```

### 2. Create Cloudflare Resources

```bash
# Create D1 database
npx wrangler d1 create resend-client-db
# → Copy the database_id into wrangler.jsonc

# Create R2 bucket
npx wrangler r2 bucket create resend-client-attachments
```

> **No schema step needed** — the database tables are created automatically on first request.

### 3. Generate & Push Secrets

```bash
# Interactive setup — writes .dev.vars + prints wrangler secret bulk JSON
node scripts/setup-secrets.mjs

# Push all secrets at once
echo '{...paste JSON output from setup script...}' | npx wrangler secret bulk --config wrangler.jsonc
```

### 4. Build & Deploy

```bash
pnpm build    # Builds the React frontend into frontend/dist/
pnpm deploy   # Deploys Worker + assets to Cloudflare
```

Your app is now live at `https://resend-client-worker.<your-subdomain>.workers.dev`

### 5. Configure Resend Webhooks

1. Open the deployed app → **Admin** panel → **+ Add Account**
2. Copy the generated **Webhook URL** and **Webhook Secret**
3. In Resend dashboard → **Webhooks** → Add endpoint with those values
4. Subscribe to: `email.received`, `email.sent`, `email.delivered`, `email.bounced`

See [docs/setup.md](docs/setup.md) for detailed DNS/MX configuration.

---

## Local Development

```bash
# Generate secrets and write .dev.vars automatically
node scripts/setup-secrets.mjs

# Start both dev servers (worker on :8787, frontend on :5173)
pnpm dev
```

Frontend runs at `http://localhost:5173`, proxied to the Worker at `http://localhost:8787`.

> **No schema step needed** — on first request, the Worker auto-initializes all D1 tables.

---

## Deploying with GitHub Actions

The included `.github/workflows/deploy.yml` automatically builds and deploys on every push to `main`.

Add these **6 secrets** to your GitHub repository (Settings → Secrets → Actions):

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | [Cloudflare → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard right sidebar |
| `MASTER_ENCRYPTION_KEY` | Output of `node scripts/setup-secrets.mjs` |
| `JWT_SECRET` | Output of `node scripts/setup-secrets.mjs` |
| `ADMIN_USERNAME` | Your chosen admin username |
| `ADMIN_PASSWORD_HASH` | Output of `node scripts/setup-secrets.mjs` |

---

## Custom Domain

1. In Cloudflare dashboard → **Workers & Pages** → your worker → **Settings** → **Domains & Routes**
2. Add your custom domain
3. Update your Resend webhook URLs to use the custom domain

---

## Changing Your Password

```bash
# Re-run setup (backs up existing .dev.vars)
node scripts/setup-secrets.mjs

# Push updated hash to production
echo '{"ADMIN_PASSWORD_HASH":"<new-hash>"}' | npx wrangler secret bulk --config wrangler.jsonc
```

---

## Architecture

```
Browser ──► Cloudflare Worker (Hono.js)
                ├── /api/auth/*         JWT authentication
                ├── /api/emails/*       Email CRUD + FTS5 search
                ├── /api/send/*         Outbound via Resend SDK
                ├── /api/ai/*           Workers AI (Llama 3.1)
                ├── /api/attachments/*  R2 upload/download
                ├── /api/templates/*    Email templates
                ├── /api/admin/*        Account management
                ├── /webhook/:id/*      Inbound email + delivery events
                └── /*                 React SPA (static assets)

                ├── D1 (SQLite)         emails, accounts, attachments, templates
                ├── R2                  Email attachment files
                └── Workers AI          Draft replies, summaries, tone
```

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE)
