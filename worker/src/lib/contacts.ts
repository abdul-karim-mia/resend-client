// Contact auto-population helper.
// Upserts a contact for an account, bumping its interaction count and
// last-contacted timestamp. Safe to call from inbound + outbound paths.

import { nanoid } from 'nanoid'

export async function upsertContact(
  db: D1Database,
  accountId: string,
  email: string,
  name?: string | null,
): Promise<void> {
  const addr = email.trim().toLowerCase()
  if (!addr || !addr.includes('@')) return

  try {
    await db.prepare(`
      INSERT INTO contacts (id, account_id, name, email, last_contacted, contact_count)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
      ON CONFLICT(account_id, email) DO UPDATE SET
        last_contacted = CURRENT_TIMESTAMP,
        contact_count = contact_count + 1,
        name = COALESCE(NULLIF(contacts.name, ''), excluded.name)
    `).bind(nanoid(), accountId, name?.trim() || null, addr).run()
  } catch (err) {
    console.warn('[contacts] upsert failed:', (err as Error).message)
  }
}
