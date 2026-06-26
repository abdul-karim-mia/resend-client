import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import type { Bindings, Signature } from '../types'

export const signatureRoutes = new Hono<{ Bindings: Bindings }>()

const createSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1).max(60),
  bodyHtml: z.string().max(20000).optional().default(''),
  isDefault: z.boolean().optional().default(false),
})

// GET /api/signatures?accountId= — list signatures for an account
signatureRoutes.get('/', async (c) => {
  const accountId = c.req.query('accountId')
  if (!accountId) return c.json({ success: false, error: 'accountId required' }, 400)

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM signatures WHERE account_id = ? ORDER BY is_default DESC, name ASC`
  ).bind(accountId).all<Signature>()

  return c.json({ success: true, data: results })
})

// POST /api/signatures — create
signatureRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const { accountId, name, bodyHtml, isDefault } = c.req.valid('json')
  const id = nanoid()

  // Enforce a single default per account.
  if (isDefault) {
    await c.env.DB.prepare(`UPDATE signatures SET is_default = 0 WHERE account_id = ?`).bind(accountId).run()
  }

  await c.env.DB.prepare(
    `INSERT INTO signatures (id, account_id, name, body_html, is_default) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, accountId, name.trim(), bodyHtml, isDefault ? 1 : 0).run()

  return c.json({ success: true, data: { id } })
})

// PUT /api/signatures/:id — update
signatureRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const { name, bodyHtml, isDefault } = await c.req.json<{
    name?: string; bodyHtml?: string; isDefault?: boolean
  }>()

  const sig = await c.env.DB.prepare(`SELECT account_id FROM signatures WHERE id = ?`)
    .bind(id).first<{ account_id: string }>()
  if (!sig) return c.json({ success: false, error: 'Not found' }, 404)

  if (isDefault) {
    await c.env.DB.prepare(`UPDATE signatures SET is_default = 0 WHERE account_id = ?`).bind(sig.account_id).run()
  }

  await c.env.DB.prepare(`
    UPDATE signatures
    SET name = COALESCE(?, name),
        body_html = COALESCE(?, body_html),
        is_default = COALESCE(?, is_default),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    name?.trim() ?? null,
    bodyHtml ?? null,
    isDefault === undefined ? null : (isDefault ? 1 : 0),
    id,
  ).run()

  return c.json({ success: true, data: null })
})

// DELETE /api/signatures/:id
signatureRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare(`DELETE FROM signatures WHERE id = ?`).bind(id).run()
  return c.json({ success: true, data: null })
})
