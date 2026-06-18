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
  const model = results[0]?.ai_model ?? '@cf/meta/llama-3.2-3b-instruct'

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

// POST /api/ai/quick-reply-suggestions — generate 3 short reply chips from conversation
aiRoutes.post('/quick-reply-suggestions', async (c) => {
  const { emailId, accountId } = await c.req.json<{ emailId: string; accountId: string }>()
  if (!emailId || !accountId) {
    return c.json({ success: false, error: 'emailId and accountId required' }, 400)
  }

  // Fetch the thread (up to 8 emails for full context)
  const { results: thread } = await c.env.DB.prepare(`
    SELECT e.body_text, e.sender_name, e.sender_email, e.direction, e.subject
    FROM emails e
    WHERE e.thread_id = (
      SELECT thread_id FROM emails WHERE id = ? LIMIT 1
    )
    ORDER BY e.created_at ASC
    LIMIT 8
  `).bind(emailId).all<{
    body_text: string | null
    sender_name: string | null
    sender_email: string
    direction: string
    subject: string | null
  }>()

  const account = await c.env.DB.prepare(`SELECT ai_model, ai_system_prompt FROM accounts WHERE id = ?`)
    .bind(accountId).first<{ ai_model: string; ai_system_prompt: string }>()
  if (!account) return c.json({ success: false, error: 'Account not found' }, 404)

  const conversationContext = thread.map((m) =>
    `[${m.direction === 'inbound' ? 'Received' : 'Sent'}] ${m.sender_name || m.sender_email}:\n${(m.body_text ?? '').slice(0, 800)}`
  ).join('\n\n---\n\n')

  const prompt = `Based on this email conversation, generate exactly 3 short, natural one-click reply options.

Conversation:
${conversationContext.slice(0, 4000)}

Return ONLY a JSON array of 3 strings, each under 60 characters. No explanation.
Example: ["Thanks for the update!", "I'll review and get back.", "Got it, on it now."]`

  const result = await (c.env.AI as Ai).run(account.ai_model, {
    messages: [
      {
        role: 'system',
        content: 'You are an email assistant. Return ONLY valid JSON arrays. No markdown, no explanation.',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 200,
    temperature: 0.7,
  } as Parameters<Ai['run']>[1])

  const raw = (result as { response?: string }).response ?? '[]'
  let suggestions: string[] = []
  try {
    // Extract JSON array even if wrapped in markdown code blocks
    const match = raw.match(/\[.*\]/s)
    suggestions = match ? JSON.parse(match[0]) : []
    if (!Array.isArray(suggestions)) suggestions = []
    suggestions = suggestions.slice(0, 3).map((s: unknown) => String(s).slice(0, 80))
  } catch {
    suggestions = ['Thanks!', 'Got it.', "I'll look into this."]
  }

  // Ensure we always return 3
  while (suggestions.length < 3) {
    suggestions.push(['Thanks!', 'Got it.', "I'll look into this."][suggestions.length] ?? 'OK')
  }

  return c.json({ success: true, data: { suggestions } })
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

  let model = '@cf/meta/llama-3.2-3b-instruct'
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
