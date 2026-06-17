# resend-client

> A self-hosted, open-source, multi-tenant email client for [Resend](https://resend.com) — built entirely on Cloudflare's edge platform.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/your-username/resend-client)
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

## Quick Start

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com) (free tier works)
- [Resend account](https://resend.com) with at least one verified domain
- Node.js 20+ and pnpm 9+

### 1. Clone & Install

```bash
git clone https://github.com/your-username/resend-client.git
cd resend-client
pnpm install
```

### 2. Create Cloudflare Resources

```bash
cd worker

# Create D1 database
npx wrangler d1 create resend-client-db

# Copy the database_id from the output and update wrangler.jsonc
# Replace "PLACEHOLDER_REPLACE_WITH_REAL_ID" with your actual ID

# Create R2 bucket
npx wrangler r2 bucket create resend-client-attachments

# Apply database schema
npx wrangler d1 execute resend-client-db --remote --file=./schema.sql
```

### 3. Generate & Set Secrets

```bash
# Generate your secrets
node ../scripts/setup-secrets.mjs

# Set each secret in Cloudflare Workers
npx wrangler secret put MASTER_ENCRYPTION_KEY
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD_HASH
```

### 4. Build & Deploy

```bash
cd ..
pnpm build    # Builds the React frontend
pnpm deploy   # Deploys everything to Cloudflare Workers
```

Your app is now live at `https://resend-client-worker.<your-subdomain>.workers.dev`

### 5. Configure Resend Webhooks

For each domain you want to receive email on:

1. Go to **Admin** panel in your deployed app
2. Click **+ Add Account**
3. Copy the generated **Webhook URL** and **Webhook Secret**
4. In Resend dashboard → **Webhooks** → Add endpoint:
   - URL: `https://your-worker.workers.dev/webhook/<accountId>/inbound`
   - Events: `email.received` (inbound), `email.sent`, `email.delivered`, `email.bounced`

See [docs/setup.md](docs/setup.md) for detailed DNS/MX configuration.

---

## Local Development

```bash
# Copy secrets template
cp worker/.dev.vars.example worker/.dev.vars
# Fill in real values in .dev.vars

# Apply schema locally
pnpm db:apply

# Start both dev servers
pnpm dev
```

Frontend runs at `http://localhost:5173`, proxied to the Worker at `http://localhost:8787`.

---

## Deploying with GitHub Actions

The included `.github/workflows/deploy.yml` automatically deploys on every push to `main`.

Add these secrets to your GitHub repository settings:
- `CLOUDFLARE_API_TOKEN` — from [Cloudflare dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
- `CLOUDFLARE_ACCOUNT_ID` — from Cloudflare dashboard right sidebar

---

## Custom Domain

1. In Cloudflare dashboard → **Workers & Pages** → your worker → **Settings** → **Domains & Routes**
2. Add your custom domain
3. Update your Resend webhook URLs to use the custom domain

---

## Changing Your Password

To update the admin password after initial setup:

```bash
# Generate new hash
node -e "const {createHash}=require('crypto'); console.log(createHash('sha256').update('YOUR_NEW_PASSWORD').digest('hex'));"

# Update the secret
cd worker
npx wrangler secret put ADMIN_PASSWORD_HASH
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
