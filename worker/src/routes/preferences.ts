import { Hono } from 'hono'
import type { Bindings } from '../types'

export const preferenceRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * User preferences — a simple key/value store for the single-admin app.
 * Holds general settings (theme, timezone, date format), default sender
 * behavior, notification toggles, etc. Stored as a flat JSON object so the
 * client can read/merge it in one round-trip.
 */

// Defaults applied when a key has never been set. The client merges these,
// so adding a new preference here is automatically reflected everywhere.
const DEFAULTS: Record<string, unknown> = {
  theme: 'system',            // 'light' | 'dark' | 'system'
  timezone: 'auto',           // IANA tz or 'auto'
  dateFormat: 'relative',     // 'relative' | 'absolute'
  language: 'en',
  density: 'comfortable',     // 'comfortable' | 'compact'
  // Email behavior
  defaultReplyBehavior: 'reply', // 'reply' | 'replyAll'
  sendUndoSeconds: 5,            // undo-send window (0 disables)
  defaultFont: 'Inter',
  // Notifications
  notifyDesktop: false,
  notifySound: false,
  notifyBadge: true,
}

// GET /api/preferences — full merged preferences object
preferenceRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT key, value FROM user_preferences`
  ).all<{ key: string; value: string }>()

  const stored: Record<string, unknown> = {}
  for (const row of results) {
    try {
      stored[row.key] = JSON.parse(row.value)
    } catch {
      stored[row.key] = row.value
    }
  }

  return c.json({ success: true, data: { ...DEFAULTS, ...stored } })
})

// PUT /api/preferences — merge partial updates (one row per key)
preferenceRoutes.put('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>()
  if (!body || typeof body !== 'object') {
    return c.json({ success: false, error: 'Invalid body' }, 400)
  }

  const entries = Object.entries(body)
  if (entries.length === 0) {
    return c.json({ success: true, data: null })
  }

  const stmts = entries.map(([key, value]) =>
    c.env.DB.prepare(
      `INSERT INTO user_preferences (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    ).bind(key, JSON.stringify(value))
  )

  await c.env.DB.batch(stmts)

  // Return the full merged object so the client stays in sync
  const { results } = await c.env.DB.prepare(
    `SELECT key, value FROM user_preferences`
  ).all<{ key: string; value: string }>()
  const stored: Record<string, unknown> = {}
  for (const row of results) {
    try { stored[row.key] = JSON.parse(row.value) } catch { stored[row.key] = row.value }
  }

  return c.json({ success: true, data: { ...DEFAULTS, ...stored } })
})
