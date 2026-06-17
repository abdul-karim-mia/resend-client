import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { encryptApiKey, decryptApiKey } from '../lib/crypto'
import type { Bindings, Account } from '../types'

export const adminRoutes = new Hono<{ Bindings: Bindings }>()

// GET /api/admin/accounts
adminRoutes.get('/accounts', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, name, domain, from_name, webhook_secret, ai_system_prompt, ai_model,
           auto_reply_enabled, created_at,
           (SELECT COUNT(*) FROM emails e WHERE e.account_id = accounts.id) as email_count
    FROM accounts ORDER BY created_at DESC
  `).all<Omit<Account, 'resend_api_key_enc'> & {
    email_count: number
  }>()

  return c.json({ success: true, data: results })
})

// POST /api/admin/accounts — create new account
adminRoutes.post('/accounts', async (c) => {
  const body = await c.req.json<{
    name: string
    domain: string
    fromName: string
    resendApiKey: string
    aiSystemPrompt?: string
    autoReplyEnabled?: boolean
    aiModel?: string
  }>()

  const id = `acc_${nanoid(12)}`
  const webhookSecret = generateWebhookSecret()

  // Encrypt API key before storing (from file-uploads skill + cc-skill-backend-patterns)
  const encryptedKey = await encryptApiKey(body.resendApiKey, c.env.MASTER_ENCRYPTION_KEY)

  await c.env.DB.prepare(`
    INSERT INTO accounts (
      id, name, domain, from_name,
      resend_api_key_enc, webhook_secret,
      ai_system_prompt, auto_reply_enabled, ai_model
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, body.name, body.domain, body.fromName,
    encryptedKey, webhookSecret,
    body.aiSystemPrompt ?? 'You are a helpful customer support agent. Be concise, polite, and professional.',
    body.autoReplyEnabled ? 1 : 0,
    body.aiModel ?? '@cf/meta/llama-3.1-8b-instruct'
  ).run()

  // Return webhook URL and secret for user to configure in Resend
  const workerUrl = new URL(c.req.url).origin
  const webhookUrl = `${workerUrl}/webhook/${id}/inbound`

  return c.json({
    success: true,
    data: {
      id,
      webhookUrl,
      webhookSecret,
    },
  }, 201)
})

// GET /api/admin/accounts/:id
adminRoutes.get('/accounts/:id', async (c) => {
  const id = c.req.param('id')

  const account = await c.env.DB.prepare(`SELECT * FROM accounts WHERE id = ?`)
    .bind(id).first<Account>()

  if (!account) return c.json({ success: false, error: 'Account not found' }, 404)

  const workerUrl = new URL(c.req.url).origin

  return c.json({
    success: true,
    data: {
      ...account,
      resend_api_key_enc: '[encrypted]', // Never expose encrypted key material
      webhookUrl: `${workerUrl}/webhook/${id}/inbound`,
      eventsWebhookUrl: `${workerUrl}/webhook/${id}/events`,
    },
  })
})

// PUT /api/admin/accounts/:id
adminRoutes.put('/accounts/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    fromName?: string
    resendApiKey?: string
    aiSystemPrompt?: string
    autoReplyEnabled?: boolean
    aiModel?: string
  }>()

  // If updating API key, encrypt the new one
  let encryptedKey: string | null = null
  if (body.resendApiKey) {
    encryptedKey = await encryptApiKey(body.resendApiKey, c.env.MASTER_ENCRYPTION_KEY)
  }

  await c.env.DB.prepare(`
    UPDATE accounts SET
      name = COALESCE(?, name),
      from_name = COALESCE(?, from_name),
      resend_api_key_enc = COALESCE(?, resend_api_key_enc),
      ai_system_prompt = COALESCE(?, ai_system_prompt),
      auto_reply_enabled = COALESCE(?, auto_reply_enabled),
      ai_model = COALESCE(?, ai_model),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    body.name ?? null,
    body.fromName ?? null,
    encryptedKey,
    body.aiSystemPrompt ?? null,
    body.autoReplyEnabled !== undefined ? (body.autoReplyEnabled ? 1 : 0) : null,
    body.aiModel ?? null,
    id
  ).run()

  return c.json({ success: true, data: null })
})

// DELETE /api/admin/accounts/:id
adminRoutes.delete('/accounts/:id', async (c) => {
  const id = c.req.param('id')
  // CASCADE deletes emails, attachments, templates via FK
  await c.env.DB.prepare(`DELETE FROM accounts WHERE id = ?`).bind(id).run()
  return c.json({ success: true, data: null })
})

// GET /api/admin/health
adminRoutes.get('/health', async (c) => {
  const [accounts, emails, attachments, templates] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM accounts`).first<{ count: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM emails`).first<{ count: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM attachments`).first<{ count: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM templates`).first<{ count: number }>(),
  ])

  return c.json({
    success: true,
    data: {
      counts: {
        accounts: accounts?.count ?? 0,
        emails: emails?.count ?? 0,
        attachments: attachments?.count ?? 0,
        templates: templates?.count ?? 0,
      },
      environment: c.env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
    },
  })
})

function generateWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}
