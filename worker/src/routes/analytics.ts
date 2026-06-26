import { Hono } from 'hono'
import type { Bindings } from '../types'

export const analyticsRoutes = new Hono<{ Bindings: Bindings }>()

// GET /api/analytics?accountId=&days=30 — dashboard aggregates
analyticsRoutes.get('/', async (c) => {
  const accountId = c.req.query('accountId')
  const days = Math.min(365, Math.max(1, Number(c.req.query('days') ?? '30')))
  if (!accountId) return c.json({ success: false, error: 'accountId required' }, 400)

  const since = new Date(Date.now() - days * 86400_000).toISOString()

  // Totals + delivery breakdown (single pass over the window).
  const totals = await c.env.DB.prepare(`
    SELECT
      COUNT(CASE WHEN direction = 'outbound' AND folder != 'drafts' AND folder != 'scheduled' THEN 1 END) AS sent,
      COUNT(CASE WHEN direction = 'inbound' THEN 1 END) AS received,
      COUNT(CASE WHEN direction = 'outbound' AND delivery_status = 'delivered' THEN 1 END) AS delivered,
      COUNT(CASE WHEN direction = 'outbound' AND delivery_status = 'opened' THEN 1 END) AS opened,
      COUNT(CASE WHEN direction = 'outbound' AND delivery_status = 'bounced' THEN 1 END) AS bounced,
      COUNT(CASE WHEN direction = 'outbound' AND delivery_status = 'failed' THEN 1 END) AS failed
    FROM emails
    WHERE account_id = ? AND created_at >= ?
  `).bind(accountId, since).first<{
    sent: number; received: number; delivered: number; opened: number; bounced: number; failed: number
  }>()

  const t = totals ?? { sent: 0, received: 0, delivered: 0, opened: 0, bounced: 0, failed: 0 }
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)
  // "delivered" status is terminal; opened implies delivered too — count both as delivered.
  const deliveredTotal = t.delivered + t.opened
  const rates = {
    deliveryRate: pct(deliveredTotal, t.sent),
    openRate: pct(t.opened, t.sent),
    bounceRate: pct(t.bounced, t.sent),
    failRate: pct(t.failed, t.sent),
  }

  // Daily series (inbound vs outbound) for the window.
  const { results: daily } = await c.env.DB.prepare(`
    SELECT
      date(created_at) AS day,
      COUNT(CASE WHEN direction = 'inbound' THEN 1 END) AS received,
      COUNT(CASE WHEN direction = 'outbound' AND folder NOT IN ('drafts','scheduled') THEN 1 END) AS sent
    FROM emails
    WHERE account_id = ? AND created_at >= ?
    GROUP BY day
    ORDER BY day ASC
  `).bind(accountId, since).all<{ day: string; received: number; sent: number }>()

  // Top senders (inbound).
  const { results: topSenders } = await c.env.DB.prepare(`
    SELECT sender_email AS email, COALESCE(sender_name, sender_email) AS name, COUNT(*) AS count
    FROM emails
    WHERE account_id = ? AND direction = 'inbound' AND created_at >= ?
    GROUP BY sender_email
    ORDER BY count DESC
    LIMIT 8
  `).bind(accountId, since).all<{ email: string; name: string; count: number }>()

  // Top recipients (outbound) — recipient_to is a JSON array, so aggregate in JS.
  const { results: outRows } = await c.env.DB.prepare(`
    SELECT recipient_to FROM emails
    WHERE account_id = ? AND direction = 'outbound' AND created_at >= ?
    LIMIT 2000
  `).bind(accountId, since).all<{ recipient_to: string }>()

  const recipientCounts = new Map<string, number>()
  for (const row of outRows) {
    let list: string[] = []
    try { const v = JSON.parse(row.recipient_to); list = Array.isArray(v) ? v.map(String) : [String(v)] } catch { /* skip */ }
    for (const addr of list) {
      const key = addr.trim().toLowerCase()
      if (key) recipientCounts.set(key, (recipientCounts.get(key) ?? 0) + 1)
    }
  }
  const topRecipients = [...recipientCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([email, count]) => ({ email, count }))

  return c.json({
    success: true,
    data: {
      days,
      totals: { sent: t.sent, received: t.received, bounced: t.bounced, failed: t.failed },
      rates,
      daily,
      topSenders,
      topRecipients,
    },
  })
})
