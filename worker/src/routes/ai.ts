import { Hono } from 'hono'
import type { Bindings, Account } from '../types'
import { decryptApiKey } from '../lib/crypto'

export const aiRoutes = new Hono<{ Bindings: Bindings }>()

// POST /api/ai/draft-reply/:emailId — Copilot: generate a reply draft
aiRoutes.post('/draft-reply/:emailId', async (c) => {
  const emailId = c.req.param('emailId')

  const row = await c.env.DB.prepare(`
    SELECT e.body_text, e.subject, e.sender_name, e.sender_email,
           a.ai_system_prompt, a.ai_model
    FROM emails e
    JOIN accounts a ON e.account_id = a.id
    WHERE e.id = ?
  `).bind(emailId).first<{
    body_text: string | null
    subject: string | null
    sender_name: string | null
    sender_email: string
    ai_system_prompt: string
    ai_model: string
  }>()

  if (!row) return c.json({ success: false, error: 'Email not found' }, 404)

  const prompt = `Please write a professional reply to this email.

From: ${row.sender_name ? `${row.sender_name} <${row.sender_email}>` : row.sender_email}
Subject: ${row.subject ?? '(no subject)'}

${(row.body_text ?? '').slice(0, 3000)}`

  const result = await (c.env.AI as Ai).run(row.ai_model, {
    messages: [
      { role: 'system', content: row.ai_system_prompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: 600,
    temperature: 0.7,
  } as Parameters<Ai['run']>[1])

  const draft = (result as { response?: string }).response ?? ''

  return c.json({ success: true, data: { draft } })
})

// POST /api/ai/summarize/:threadId — summarize thread in 1 sentence
aiRoutes.post('/summarize/:threadId', async (c) => {
  const threadId = c.req.param('threadId')

  const { results } = await c.env.DB.prepare(`
    SELECT e.body_text, a.ai_model FROM emails e
    JOIN accounts a ON e.account_id = a.id
    WHERE e.thread_id = ? AND e.body_text IS NOT NULL
    ORDER BY e.created_at ASC LIMIT 5
  `).bind(threadId).all<{ body_text: string; ai_model: string }>()

  if (results.length === 0) return c.json({ success: false, error: 'Thread not found' }, 404)

  const combined = results.map((r) => r.body_text).join('\n---\n').slice(0, 4000)
  const model = results[0]?.ai_model ?? '@cf/meta/llama-3.1-8b-instruct'

  const result = await (c.env.AI as Ai).run(model, {
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant. Summarize email threads in exactly one concise sentence (max 80 characters). No punctuation at the end.',
      },
      { role: 'user', content: `Summarize this email thread:\n\n${combined}` },
    ],
    max_tokens: 100,
    temperature: 0.3,
  } as Parameters<Ai['run']>[1])

  const summary = ((result as { response?: string }).response ?? '').slice(0, 120)

  return c.json({ success: true, data: { summary } })
})

// POST /api/ai/adjust-tone — rewrite text with a different tone
aiRoutes.post('/adjust-tone', async (c) => {
  const { text, tone, accountId } = await c.req.json<{
    text: string
    tone: 'formal' | 'casual' | 'concise'
    accountId?: string
  }>()

  if (!text || !tone) {
    return c.json({ success: false, error: 'text and tone are required' }, 400)
  }

  let model = '@cf/meta/llama-3.1-8b-instruct'
  if (accountId) {
    const acc = await c.env.DB.prepare(`SELECT ai_model FROM accounts WHERE id = ?`).bind(accountId).first<{ ai_model: string }>()
    if (acc) model = acc.ai_model
  } else {
    const acc = await c.env.DB.prepare(`SELECT ai_model FROM accounts LIMIT 1`).first<{ ai_model: string }>()
    if (acc) model = acc.ai_model
  }

  const toneInstructions = {
    formal: 'Rewrite this email in a formal, professional tone. Use proper salutations and avoid contractions.',
    casual: 'Rewrite this email in a friendly, casual tone. Keep it warm and approachable.',
    concise: 'Rewrite this email to be as concise as possible. Remove all filler words. Keep only the essential information.',
  }

  const result = await (c.env.AI as Ai).run(model, {
    messages: [
      { role: 'system', content: toneInstructions[tone] },
      { role: 'user', content: text.slice(0, 3000) },
    ],
    max_tokens: 600,
    temperature: 0.6,
  } as Parameters<Ai['run']>[1])

  const rewritten = (result as { response?: string }).response ?? ''

  return c.json({ success: true, data: { result: rewritten } })
})
