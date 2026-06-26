import { Hono } from 'hono'
import type { Bindings } from '../types'

export const contactRoutes = new Hono<{ Bindings: Bindings }>()

type ContactRow = {
  id: string
  account_id: string
  name: string | null
  email: string
  last_contacted: string | null
  notes: string | null
  is_favorite: number
  contact_count: number
}

// GET /api/contacts?accountId=&q=&favorites= — list / search contacts
contactRoutes.get('/', async (c) => {
  const accountId = c.req.query('accountId')
  const q = c.req.query('q')?.trim()
  const favoritesOnly = c.req.query('favorites') === '1'
  const limit = Math.min(100, Number(c.req.query('limit') ?? '50'))
  if (!accountId) return c.json({ success: false, error: 'accountId required' }, 400)

  const clauses = ['account_id = ?']
  const binds: unknown[] = [accountId]
  if (q) {
    clauses.push('(email LIKE ? OR name LIKE ?)')
    binds.push(`%${q}%`, `%${q}%`)
  }
  if (favoritesOnly) clauses.push('is_favorite = 1')

  binds.push(limit)
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM contacts
    WHERE ${clauses.join(' AND ')}
    ORDER BY is_favorite DESC, contact_count DESC, last_contacted DESC
    LIMIT ?
  `).bind(...binds).all<ContactRow>()

  return c.json({ success: true, data: results })
})

// PUT /api/contacts/:id — update notes / name / favorite
contactRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const { name, notes, isFavorite } = await c.req.json<{ name?: string; notes?: string; isFavorite?: boolean }>()
  await c.env.DB.prepare(`
    UPDATE contacts SET
      name = COALESCE(?, name),
      notes = COALESCE(?, notes),
      is_favorite = COALESCE(?, is_favorite)
    WHERE id = ?
  `).bind(
    name ?? null,
    notes ?? null,
    isFavorite === undefined ? null : (isFavorite ? 1 : 0),
    id,
  ).run()
  return c.json({ success: true, data: null })
})

// DELETE /api/contacts/:id
contactRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare(`DELETE FROM contacts WHERE id = ?`).bind(id).run()
  return c.json({ success: true, data: null })
})
