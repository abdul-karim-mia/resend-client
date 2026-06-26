import { Hono } from 'hono'
import type { Bindings, EmailEvent } from '../types'

export const devRoutes = new Hono<{ Bindings: Bindings }>()

// ── Event timeline for a single email ─────────────────────────────────────────
// GET /api/dev/emails/:id/events
devRoutes.get('/emails/:id/events', async (c) => {
  const id = c.req.param('id')
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM email_events WHERE email_id = ? ORDER BY created_at ASC
  `).bind(id).all<EmailEvent>()
  return c.json({ success: true, data: results })
})

// ── Webhook inspector — recent raw events for an account ──────────────────────
// GET /api/dev/webhooks?accountId=&limit=
devRoutes.get('/webhooks', async (c) => {
  const accountId = c.req.query('accountId')
  const limit = Math.min(200, Number(c.req.query('limit') ?? '100'))
  if (!accountId) return c.json({ success: false, error: 'accountId required' }, 400)

  const { results } = await c.env.DB.prepare(`
    SELECT id, account_id, email_id, resend_email_id, type, payload, created_at
    FROM email_events
    WHERE account_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(accountId, limit).all<EmailEvent>()

  return c.json({ success: true, data: results })
})

// POST /api/dev/webhooks/:id/replay — re-process a stored inbound/event payload
// through the same internal logic (without signature, since it's admin-initiated).
devRoutes.post('/webhooks/:id/replay', async (c) => {
  const id = c.req.param('id')
  const evt = await c.env.DB.prepare(`SELECT * FROM email_events WHERE id = ?`)
    .bind(id).first<EmailEvent>()
  if (!evt || !evt.payload) return c.json({ success: false, error: 'Event not found' }, 404)

  // Determine which webhook endpoint this event corresponds to and re-POST it
  // to ourselves so the exact same handler logic runs. We skip signature
  // verification by omitting the signature header — handlers tolerate accounts
  // without a webhook_secret, but to be safe we call the handler path directly.
  const isInbound = evt.type === 'email.received'
  const path = isInbound
    ? `/webhook/${evt.account_id}/inbound`
    : `/webhook/${evt.account_id}/events`

  const url = new URL(c.req.url)
  const target = `${url.protocol}//${url.host}${path}`

  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: evt.payload,
    })
    const ok = res.ok
    return c.json({ success: true, data: { replayed: true, status: res.status, ok } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── Domain diagnostics (SPF / DKIM / DMARC) via DNS-over-HTTPS ─────────────────
// GET /api/dev/domain/:accountId
devRoutes.get('/domain/:accountId', async (c) => {
  const accountId = c.req.param('accountId')
  const account = await c.env.DB.prepare(`SELECT domain FROM accounts WHERE id = ?`)
    .bind(accountId).first<{ domain: string }>()
  if (!account) return c.json({ success: false, error: 'Account not found' }, 404)

  const domain = account.domain

  const [spfTxt, dmarcTxt, dkimTxt] = await Promise.all([
    dohTxt(domain),
    dohTxt(`_dmarc.${domain}`),
    // Resend's default DKIM selector
    dohTxt(`resend._domainkey.${domain}`),
  ])

  const spfRecord = spfTxt.find((r) => r.toLowerCase().includes('v=spf1')) ?? null
  const dmarcRecord = dmarcTxt.find((r) => r.toLowerCase().includes('v=dmarc1')) ?? null
  const dkimRecord = dkimTxt.find((r) => r.toLowerCase().includes('p=') || r.toLowerCase().includes('dkim')) ?? (dkimTxt[0] ?? null)

  const checks = {
    spf: {
      ok: !!spfRecord,
      record: spfRecord,
      detail: spfRecord
        ? (spfRecord.includes('resend') || spfRecord.includes('amazonses') ? 'SPF present and includes a sending provider' : 'SPF present')
        : 'No SPF record found',
    },
    dkim: {
      ok: !!dkimRecord,
      record: dkimRecord,
      detail: dkimRecord ? 'DKIM selector resend._domainkey resolves' : 'DKIM selector resend._domainkey not found',
    },
    dmarc: {
      ok: !!dmarcRecord,
      record: dmarcRecord,
      detail: dmarcRecord ? 'DMARC policy published' : 'No DMARC record found',
    },
  }

  const score = [checks.spf.ok, checks.dkim.ok, checks.dmarc.ok].filter(Boolean).length
  const health = score === 3 ? 'healthy' : score === 0 ? 'critical' : 'warning'

  return c.json({ success: true, data: { domain, checks, score, health } })
})

/** Query TXT records for a name using Cloudflare DNS-over-HTTPS (1.1.1.1). */
async function dohTxt(name: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
      { headers: { accept: 'application/dns-json' } }
    )
    if (!res.ok) return []
    const json = await res.json() as { Answer?: Array<{ data: string }> }
    return (json.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, '').replace(/" "/g, ''))
  } catch {
    return []
  }
}
