# Setup Guide

## Prerequisites

- Cloudflare account (free tier is fine)
- Resend account with at least one verified domain
- Node.js 20+ and pnpm 9+

---

## Step 1 — Clone & Install

```bash
git clone https://github.com/abdul-karim-mia/resend-client.git
cd resend-client
pnpm install
```

---

## Step 2 — Cloudflare D1 Database

```bash
cd worker
npx wrangler d1 create resend-client-db
```

Copy the `database_id` from the output and paste it into `worker/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "resend-client-db",
    "database_id": "YOUR_ID_HERE"   // <-- replace this
  }
]
```

Apply the schema:

```bash
npx wrangler d1 execute resend-client-db --remote --file=./schema.sql
```

---

## Step 3 — Cloudflare R2 Bucket

```bash
npx wrangler r2 bucket create resend-client-attachments
```

---

## Step 4 — Generate Secrets

```bash
cd ..
node scripts/setup-secrets.mjs
```

This generates:
- `MASTER_ENCRYPTION_KEY` — encrypts your Resend API keys in D1
- `JWT_SECRET` — signs login session tokens
- `ADMIN_USERNAME` — your login username
- `ADMIN_PASSWORD_HASH` — SHA-256 hash of your password

Set each in Cloudflare Workers:

```bash
cd worker
npx wrangler secret put MASTER_ENCRYPTION_KEY
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD_HASH
```

---

## Step 5 — Deploy

```bash
cd ..
pnpm build    # builds React frontend into worker/frontend/dist
pnpm deploy   # deploys Worker + static assets
```

---

## Step 6 — Add a Resend Account (per domain)

1. Open your deployed app and sign in
2. Navigate to **Admin → + Add Account**
3. Fill in:
   - **Name** — e.g. "Support Inbox"
   - **Domain** — e.g. `support.yourdomain.com`
   - **From Name** — e.g. "Support Team"
   - **Resend API Key** — from [Resend dashboard → API Keys](https://resend.com/api-keys)
4. Click **Create** — you'll get:
   - **Inbound Webhook URL** — copy this
   - **Webhook Secret** — copy this

---

## Step 7 — Configure Resend Inbound Email (per account)

### DNS Setup (MX Record)

In your DNS provider, add an MX record for the subdomain you want to receive email on:

| Type | Host | Value | Priority |
|---|---|---|---|
| MX | `support` (or `@`) | `inbound.resend.com` | 10 |

> This points your domain's email to Resend's inbound processing.

Allow ~24–48 hours for DNS propagation.

### Resend Webhook

In the [Resend dashboard](https://resend.com):

1. Go to **Webhooks** → **+ Add Endpoint**
2. URL: the **Inbound Webhook URL** from Step 6
3. Secret: the **Webhook Secret** from Step 6
4. Events to subscribe:
   - `email.received` (inbound emails)
   - `email.sent`
   - `email.delivered`
   - `email.bounced`
   - `email.opened`

Repeat Steps 6–7 for each domain/account.

---

## Step 8 — Custom Domain (Optional)

1. In Cloudflare dashboard → **Workers & Pages** → `resend-client-worker`
2. **Settings** → **Domains & Routes** → **Add Custom Domain**
3. Enter `mail.yourdomain.com` (or any subdomain)
4. Cloudflare handles SSL automatically

Update your webhook URLs in Resend to use the custom domain.

---

## Local Development

```bash
cp worker/.dev.vars.example worker/.dev.vars
# Edit .dev.vars with real values

pnpm db:apply          # apply schema to local D1
pnpm dev               # start worker + frontend
```

Frontend: `http://localhost:5173`  
Worker API: `http://localhost:8787`
