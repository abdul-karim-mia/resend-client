import { Hono } from 'hono'
import type { Bindings, AuditLog, Session } from '../types'
import { generateSecret, verifyTotp, otpauthUri } from '../lib/totp'
import { audit, getSecure, setSecure } from '../lib/audit'

export const securityRoutes = new Hono<{ Bindings: Bindings }>()

// GET /api/security/status — 2FA state
securityRoutes.get('/status', async (c) => {
  const enabled = (await getSecure(c.env, 'totp_enabled')) as unknown
  return c.json({ success: true, data: { totpEnabled: enabled === true } })
})

// POST /api/security/totp/init — start enrollment (generates a pending secret)
securityRoutes.post('/totp/init', async (c) => {
  const secret = generateSecret()
  await setSecure(c.env, 'totp_pending', secret)
  const uri = otpauthUri(secret, c.env.ADMIN_USERNAME || 'admin')
  return c.json({ success: true, data: { secret, uri } })
})

// POST /api/security/totp/enable — verify a code against the pending secret
securityRoutes.post('/totp/enable', async (c) => {
  const { code } = await c.req.json<{ code: string }>()
  const pending = await getSecure(c.env, 'totp_pending')
  if (!pending) return c.json({ success: false, error: 'No enrollment in progress' }, 400)
  if (!(await verifyTotp(pending, code ?? ''))) {
    return c.json({ success: false, error: 'Invalid code' }, 400)
  }
  await setSecure(c.env, 'totp_secret', pending)
  await setSecure(c.env, 'totp_enabled', true)
  await setSecure(c.env, 'totp_pending', '')
  await audit(c.env, 'security.2fa_enabled', 'TOTP enabled', c.req.raw)
  return c.json({ success: true, data: { totpEnabled: true } })
})

// POST /api/security/totp/disable — verify a current code, then disable
securityRoutes.post('/totp/disable', async (c) => {
  const { code } = await c.req.json<{ code: string }>()
  const secret = await getSecure(c.env, 'totp_secret')
  if (!secret) return c.json({ success: true, data: { totpEnabled: false } })
  if (!(await verifyTotp(secret, code ?? ''))) {
    return c.json({ success: false, error: 'Invalid code' }, 400)
  }
  await setSecure(c.env, 'totp_enabled', false)
  await setSecure(c.env, 'totp_secret', '')
  await audit(c.env, 'security.2fa_disabled', 'TOTP disabled', c.req.raw)
  return c.json({ success: true, data: { totpEnabled: false } })
})

// GET /api/security/sessions — recent login sessions (history)
securityRoutes.get('/sessions', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50`
  ).all<Session>()
  return c.json({ success: true, data: results })
})

// GET /api/security/audit — audit log
securityRoutes.get('/audit', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`
  ).all<AuditLog>()
  return c.json({ success: true, data: results })
})
