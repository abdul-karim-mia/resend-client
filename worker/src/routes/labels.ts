import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import type { Bindings, Label } from '../types'

export const labelRoutes = new Hono<{ Bindings: Bindings }>()

const createSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
})

// GET /api/labels?accountId= — list labels for an account, with usage counts
labelRoutes.get('/', async (c) => {
  const accountId = c.req.query('accountId')
  if (!accountId) return c.json({ success: false, error: 'accountId required' }, 400)

  const { results } = await c.env.DB.prepare(`
    SELECT l.*, (SELECT COUNT(*) FROM email_labels el WHERE el.label_id = l.id) as email_count
    FROM labels l
    WHERE l.account_id = ?
    ORDER BY l.name ASC
  `).bind(accountId).all<Label & { email_count: number }>()

  return c.json({ success: true, data: results })
})

// POST /api/labels — create a label
labelRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const { accountId, name, color } = c.req.valid('json')
  const id = nanoid()
  try {
    await c.env.DB.prepare(
      `INSERT INTO labels (id, account_id, name, color) VALUES (?, ?, ?, ?)`
    ).bind(id, accountId, name.trim(), color).run()
  } catch {
    return c.json({ success: false, error: 'A label with that name already exists' }, 409)
  }
  return c.json({ success: true, data: { id, account_id: accountId, name: name.trim(), color } })
})

// PUT /api/labels/:id — rename / recolor
labelRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const { name, color } = await c.req.json<{ name?: string; color?: string }>()
  await c.env.DB.prepare(
    `UPDATE labels SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?`
  ).bind(name?.trim() ?? null, color ?? null, id).run()
  return c.json({ success: true, data: null })
})

// DELETE /api/labels/:id — delete label (junction rows cascade)
labelRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare(`DELETE FROM labels WHERE id = ?`).bind(id).run()
  return c.json({ success: true, data: null })
})

// POST /api/labels/:id/assign — attach label to an email
labelRoutes.post('/:id/assign', async (c) => {
  const labelId = c.req.param('id')
  const { emailId } = await c.req.json<{ emailId: string }>()
  if (!emailId) return c.json({ success: false, error: 'emailId required' }, 400)
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO email_labels (email_id, label_id) VALUES (?, ?)`
  ).bind(emailId, labelId).run()
  return c.json({ success: true, data: null })
})

// POST /api/labels/:id/unassign — detach label from an email
labelRoutes.post('/:id/unassign', async (c) => {
  const labelId = c.req.param('id')
  const { emailId } = await c.req.json<{ emailId: string }>()
  if (!emailId) return c.json({ success: false, error: 'emailId required' }, 400)
  await c.env.DB.prepare(
    `DELETE FROM email_labels WHERE email_id = ? AND label_id = ?`
  ).bind(emailId, labelId).run()
  return c.json({ success: true, data: null })
})

// GET /api/labels/:id/emails — emails carrying a given label (paginated)
labelRoutes.get('/:id/emails', async (c) => {
  const labelId = c.req.param('id')
  const page = Math.max(1, Number(c.req.query('page') ?? '1'))
  const limit = Math.min(100, Number(c.req.query('limit') ?? '50'))
  const offset = (page - 1) * limit

  const { results } = await c.env.DB.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM attachments a WHERE a.email_id = e.id) as attachment_count,
      (SELECT COUNT(*) FROM email_labels el2 WHERE el2.email_id = e.id) as label_count
    FROM emails e
    JOIN email_labels el ON el.email_id = e.id
    WHERE el.label_id = ?
    ORDER BY e.is_pinned DESC, e.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(labelId, limit, offset).all()

  return c.json({ success: true, data: results })
})
