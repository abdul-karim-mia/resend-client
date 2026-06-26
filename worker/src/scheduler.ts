// Scheduled-send dispatcher.
//
// Runs from the Worker's cron trigger (see wrangler.jsonc "triggers.crons").
// Finds scheduled emails whose time has arrived and sends them via Resend,
// then moves them to the Sent folder. Designed to be safe to run frequently:
// only due, still-pending scheduled emails are processed, and each is updated
// immediately so a second run won't double-send.

import { Resend } from 'resend'
import { decryptApiKey } from './lib/crypto'
import type { Bindings, Account, Email } from './types'

export async function dispatchDueEmails(env: Bindings): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  const nowIso = new Date().toISOString()
  const { results: due } = await env.DB.prepare(`
    SELECT * FROM emails
    WHERE folder = 'scheduled'
      AND delivery_status = 'pending'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= ?
    ORDER BY scheduled_at ASC
    LIMIT 25
  `).bind(nowIso).all<Email>()

  for (const email of due) {
    try {
      const account = await env.DB.prepare(`SELECT * FROM accounts WHERE id = ?`)
        .bind(email.account_id).first<Account>()
      if (!account) {
        await markFailed(env, email.id, 'account missing')
        failed++
        continue
      }

      const apiKey = await decryptApiKey(account.resend_api_key_enc, env.MASTER_ENCRYPTION_KEY)
      const resend = new Resend(apiKey)

      const to = safeParseArray(email.recipient_to)
      const cc = email.recipient_cc ? safeParseArray(email.recipient_cc) : undefined
      const bcc = email.recipient_bcc ? safeParseArray(email.recipient_bcc) : undefined
      const fromHeader = `${email.sender_name ?? account.from_name} <${email.sender_email}>`

      const { data, error } = await resend.emails.send({
        from: fromHeader,
        to,
        ...(cc?.length ? { cc } : {}),
        ...(bcc?.length ? { bcc } : {}),
        subject: email.subject ?? '(no subject)',
        html: email.body_html ?? '',
        ...(email.body_text ? { text: email.body_text } : {}),
      } as Parameters<typeof resend.emails.send>[0])

      if (error) {
        await markFailed(env, email.id, error.message)
        failed++
        continue
      }

      // Move to Sent, clear the schedule, record the Resend id.
      await env.DB.prepare(`
        UPDATE emails
        SET folder = 'sent', delivery_status = 'sent',
            scheduled_at = NULL, resend_email_id = ?
        WHERE id = ?
      `).bind(data?.id ?? null, email.id).run()

      // Record a timeline event.
      await env.DB.prepare(`
        INSERT INTO email_events (id, account_id, email_id, resend_email_id, type, payload)
        VALUES (?, ?, ?, ?, 'scheduled.sent', ?)
      `).bind(
        crypto.randomUUID(), email.account_id, email.id, data?.id ?? null,
        JSON.stringify({ at: nowIso }),
      ).run()

      sent++
    } catch (err) {
      await markFailed(env, email.id, (err as Error).message)
      failed++
    }
  }

  if (sent || failed) {
    console.log(`[scheduler] dispatched: sent=${sent} failed=${failed}`)
  }
  return { sent, failed }
}

async function markFailed(env: Bindings, emailId: string, reason: string): Promise<void> {
  await env.DB.prepare(`UPDATE emails SET delivery_status = 'failed' WHERE id = ?`).bind(emailId).run()
  console.error(`[scheduler] send failed for ${emailId}: ${reason}`)
}

function safeParseArray(json: string): string[] {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.map(String) : [String(v)]
  } catch {
    return [json]
  }
}
