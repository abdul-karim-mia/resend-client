// Audit logging + secure preference helpers.
import { nanoid } from 'nanoid'
import type { Bindings } from '../types'

/** Record an audit-log entry. Best-effort; never throws into the request path. */
export async function audit(
  env: Bindings,
  action: string,
  detail: string | null,
  req: Request,
  actor = 'admin',
): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO audit_logs (id, action, detail, actor, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      nanoid(), action, detail, actor,
      req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? null,
      req.headers.get('user-agent') ?? null,
    ).run()
  } catch (err) {
    console.warn('[audit] failed:', (err as Error).message)
  }
}

/** Read a single secure preference value (never exposed via /api/preferences). */
export async function getSecure(env: Bindings, key: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT value FROM user_preferences WHERE key = ?`)
    .bind(`secure.${key}`).first<{ value: string }>()
  if (!row) return null
  try { return JSON.parse(row.value) as string } catch { return row.value }
}

export async function setSecure(env: Bindings, key: string, value: string | boolean): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO user_preferences (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).bind(`secure.${key}`, JSON.stringify(value)).run()
}
