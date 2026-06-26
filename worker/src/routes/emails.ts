import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Bindings, Email } from '../types'

export const emailRoutes = new Hono<{ Bindings: Bindings }>()

const listSchema = z.object({
  accountId: z.string(),
  folder: z.enum(['inbox', 'sent', 'drafts', 'trash', 'archive', 'spam', 'starred', 'scheduled']).optional().default('inbox'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
})

// GET /api/emails — list emails
//
// Folders fall into two kinds:
//  - Physical folders (inbox/sent/drafts/archive/trash/spam/scheduled): matched
//    on emails.folder.
//  - Virtual folders (starred): a cross-folder view defined by a flag. Starred
//    shows is_starred = 1 from everywhere except trash.
// Pinned emails always sort to the top within any view.
emailRoutes.get('/', zValidator('query', listSchema), async (c) => {
  const { accountId, folder, page, limit } = c.req.valid('query')
  const offset = (page - 1) * limit

  const where =
    folder === 'starred'
      ? `e.account_id = ? AND e.is_starred = 1 AND e.folder != 'trash'`
      : `e.account_id = ? AND e.folder = ?`

  const binds = folder === 'starred'
    ? [accountId, limit, offset]
    : [accountId, folder, limit, offset]

  const { results } = await c.env.DB.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM attachments a WHERE a.email_id = e.id) as attachment_count,
      (SELECT COUNT(*) FROM email_labels el WHERE el.email_id = e.id) as label_count
    FROM emails e
    WHERE ${where}
    ORDER BY e.is_pinned DESC, e.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...binds).all<Email & { attachment_count: number }>()

  return c.json({ success: true, data: results })
})

// GET /api/emails/search — FTS5 full-text search
emailRoutes.get('/search', async (c) => {
  const q = c.req.query('q')
  const accountId = c.req.query('accountId')

  if (!q || !accountId) {
    return c.json({ success: false, error: 'q and accountId are required' }, 400)
  }

  const { results } = await c.env.DB.prepare(`
    SELECT e.* FROM emails e
    JOIN emails_fts ON emails_fts.rowid = e.rowid
    WHERE emails_fts MATCH ? AND e.account_id = ?
    ORDER BY rank
    LIMIT 50
  `).bind(`"${q.replace(/"/g, '""')}"`, accountId).all<Email>()

  return c.json({ success: true, data: results })
})

// GET /api/emails/unread-counts — get unread counts per folder
emailRoutes.get('/unread-counts/:accountId', async (c) => {
  const accountId = c.req.param('accountId')

  const { results } = await c.env.DB.prepare(`
    SELECT
      folder,
      COUNT(CASE WHEN read_status = 0 AND direction = 'inbound' THEN 1 END) as unread_count
    FROM emails
    WHERE account_id = ?
    GROUP BY folder
  `).bind(accountId).all<{ folder: string; unread_count: number }>()

  const counts: Record<string, number> = {
    inbox: 0,
    sent: 0,
    drafts: 0,
    trash: 0,
    archive: 0,
    spam: 0,
    starred: 0,
    scheduled: 0,
  }

  results.forEach(({ folder, unread_count }) => {
    if (folder in counts) {
      counts[folder] = unread_count
    }
  })

  // "starred" is a virtual folder — count unread starred mail across folders.
  const starred = await c.env.DB.prepare(`
    SELECT COUNT(*) as n FROM emails
    WHERE account_id = ? AND is_starred = 1 AND read_status = 0
      AND direction = 'inbound' AND folder != 'trash'
  `).bind(accountId).first<{ n: number }>()
  counts.starred = starred?.n ?? 0

  return c.json({ success: true, data: counts })
})

// GET /api/emails/:id — single email with attachments
emailRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')

  const email = await c.env.DB.prepare(`SELECT * FROM emails WHERE id = ?`)
    .bind(id).first<Email>()

  if (!email) return c.json({ success: false, error: 'Email not found' }, 404)

  const { results: attachments } = await c.env.DB.prepare(
    `SELECT id, filename, content_type, size_bytes FROM attachments WHERE email_id = ?`
  ).bind(id).all()

  // Labels attached to this email
  const { results: labels } = await c.env.DB.prepare(`
    SELECT l.id, l.name, l.color
    FROM email_labels el JOIN labels l ON l.id = el.label_id
    WHERE el.email_id = ?
    ORDER BY l.name ASC
  `).bind(id).all()

  // Mark as read
  await c.env.DB.prepare(`UPDATE emails SET read_status = 1 WHERE id = ?`).bind(id).run()

  return c.json({ success: true, data: { ...email, attachments, labels } })
})

// PUT /api/emails/:id/read — toggle read status
emailRoutes.put('/:id/read', async (c) => {
  const id = c.req.param('id')
  const { read } = await c.req.json<{ read: boolean }>()

  await c.env.DB.prepare(`UPDATE emails SET read_status = ? WHERE id = ?`)
    .bind(read ? 1 : 0, id).run()

  return c.json({ success: true, data: null })
})

// PUT /api/emails/:id/folder — move to folder
emailRoutes.put('/:id/folder', async (c) => {
  const id = c.req.param('id')
  const { folder } = await c.req.json<{ folder: string }>()

  const validFolders = ['inbox', 'sent', 'drafts', 'trash', 'archive', 'spam', 'starred', 'scheduled']
  if (!validFolders.includes(folder)) {
    return c.json({ success: false, error: 'Invalid folder' }, 400)
  }

  await c.env.DB.prepare(`UPDATE emails SET folder = ? WHERE id = ?`).bind(folder, id).run()

  return c.json({ success: true, data: null })
})

// PUT /api/emails/:id/star — toggle starred flag
emailRoutes.put('/:id/star', async (c) => {
  const id = c.req.param('id')
  const { starred } = await c.req.json<{ starred: boolean }>()
  await c.env.DB.prepare(`UPDATE emails SET is_starred = ? WHERE id = ?`)
    .bind(starred ? 1 : 0, id).run()
  return c.json({ success: true, data: null })
})

// PUT /api/emails/:id/pin — toggle pinned flag
emailRoutes.put('/:id/pin', async (c) => {
  const id = c.req.param('id')
  const { pinned } = await c.req.json<{ pinned: boolean }>()
  await c.env.DB.prepare(`UPDATE emails SET is_pinned = ? WHERE id = ?`)
    .bind(pinned ? 1 : 0, id).run()
  return c.json({ success: true, data: null })
})

// POST /api/emails/bulk — apply an action to multiple emails at once
emailRoutes.post('/bulk', async (c) => {
  const { ids, action, value } = await c.req.json<{
    ids: string[]
    action: 'read' | 'unread' | 'folder' | 'star' | 'unstar' | 'delete'
    value?: string
  }>()

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, error: 'ids required' }, 400)
  }
  // Cap to a sane batch size to protect the DB.
  const batch = ids.slice(0, 500)
  const placeholders = batch.map(() => '?').join(',')

  let sql: string
  let binds: unknown[]
  switch (action) {
    case 'read':   sql = `UPDATE emails SET read_status = 1 WHERE id IN (${placeholders})`; binds = batch; break
    case 'unread': sql = `UPDATE emails SET read_status = 0 WHERE id IN (${placeholders})`; binds = batch; break
    case 'star':   sql = `UPDATE emails SET is_starred = 1 WHERE id IN (${placeholders})`; binds = batch; break
    case 'unstar': sql = `UPDATE emails SET is_starred = 0 WHERE id IN (${placeholders})`; binds = batch; break
    case 'delete': sql = `DELETE FROM emails WHERE id IN (${placeholders})`; binds = batch; break
    case 'folder': {
      const valid = ['inbox', 'sent', 'drafts', 'trash', 'archive', 'spam', 'starred', 'scheduled']
      if (!value || !valid.includes(value)) return c.json({ success: false, error: 'Invalid folder' }, 400)
      sql = `UPDATE emails SET folder = ? WHERE id IN (${placeholders})`
      binds = [value, ...batch]
      break
    }
    default:
      return c.json({ success: false, error: 'Invalid action' }, 400)
  }

  await c.env.DB.prepare(sql).bind(...binds).run()
  return c.json({ success: true, data: { affected: batch.length } })
})

// DELETE /api/emails/:id — permanent delete (only from trash)
emailRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  const email = await c.env.DB.prepare(`SELECT folder FROM emails WHERE id = ?`)
    .bind(id).first<{ folder: string }>()

  if (!email) return c.json({ success: false, error: 'Email not found' }, 404)
  if (email.folder !== 'trash') {
    return c.json({ success: false, error: 'Can only permanently delete emails in trash' }, 400)
  }

  // Cascade: attachments deleted via FK ON DELETE CASCADE
  await c.env.DB.prepare(`DELETE FROM emails WHERE id = ?`).bind(id).run()

  return c.json({ success: true, data: null })
})
