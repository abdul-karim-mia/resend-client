import { useState } from 'react'
import { useEmailEvents, type Email, type Attachment, type EmailLabelRef, type EmailEvent } from '../queries'

type FullEmail = Email & { attachments?: Attachment[]; labels?: EmailLabelRef[] }

const EVENT_META: Record<string, { icon: string; color: string; label: string }> = {
  'email.received':         { icon: '📥', color: 'var(--info)', label: 'Received' },
  'email.sent':             { icon: '📤', color: 'var(--accent-light)', label: 'Sent' },
  'email.delivered':        { icon: '✅', color: 'var(--success)', label: 'Delivered' },
  'email.delivery_delayed': { icon: '⏳', color: 'var(--warning)', label: 'Delayed' },
  'email.opened':           { icon: '👁', color: 'var(--accent)', label: 'Opened' },
  'email.clicked':          { icon: '🖱️', color: 'var(--accent)', label: 'Clicked' },
  'email.bounced':          { icon: '⚠️', color: 'var(--error)', label: 'Bounced' },
  'email.complained':       { icon: '🚫', color: 'var(--error)', label: 'Complaint' },
  'scheduled.sent':         { icon: '🕓', color: 'var(--accent-light)', label: 'Scheduled send' },
}

function relativeTime(iso: string): string {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'))
  return d.toLocaleString()
}

function prettyJson(raw: string | null): string {
  if (!raw) return ''
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

type DevTab = 'timeline' | 'headers' | 'source' | 'debugger'

export default function DeveloperPanel({ email }: { email: FullEmail }) {
  const [tab, setTab] = useState<DevTab>('timeline')
  const { data: events = [], isLoading } = useEmailEvents(email.id)

  const copy = (text: string) => navigator.clipboard?.writeText(text)

  return (
    <div style={{
      borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)',
      display: 'flex', flexDirection: 'column', maxHeight: 380,
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
        {(['timeline', 'headers', 'source', 'debugger'] as DevTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '5px 10px', fontSize: 12, fontWeight: tab === t ? 600 : 500,
              background: tab === t ? 'var(--accent-subtle)' : 'none', border: 'none',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
              color: tab === t ? 'var(--accent-light)' : 'var(--text-muted)', textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ overflowY: 'auto', padding: 14 }}>
        {tab === 'timeline' && (
          <TimelineView events={events} isLoading={isLoading} />
        )}

        {tab === 'headers' && (
          <KeyValues
            rows={[
              ['Message-ID', email.message_id],
              ['Thread-ID', email.thread_id],
              ['In-Reply-To', email.in_reply_to],
              ['Reply-To', email.reply_to ?? null],
              ['Resend ID', (email as { resend_email_id?: string }).resend_email_id ?? null],
              ['Direction', email.direction],
              ['Delivery status', email.delivery_status],
            ]}
            rawHeaders={email.raw_headers ?? null}
            onCopy={copy}
          />
        )}

        {tab === 'source' && (
          <SourceView email={email} onCopy={copy} />
        )}

        {tab === 'debugger' && (
          <DebuggerView email={email} />
        )}
      </div>
    </div>
  )
}

function TimelineView({ events, isLoading }: { events: EmailEvent[]; isLoading: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (isLoading) return <p style={hint}>Loading events…</p>
  if (!events || events.length === 0) {
    return <p style={hint}>No delivery events yet. Events appear here as Resend reports sent/delivered/opened/bounced.</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {events.map((e, i) => {
        const meta = EVENT_META[e.type] ?? { icon: '•', color: 'var(--text-muted)', label: e.type }
        const isLast = i === events.length - 1
        const open = openId === e.id
        return (
          <div key={e.id} style={{ display: 'flex', gap: 10 }}>
            {/* Rail */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-surface)',
                border: `2px solid ${meta.color}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 11, flexShrink: 0,
              }}>{meta.icon}</span>
              {!isLast && <span style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 14 }} />}
            </div>
            {/* Content */}
            <div style={{ paddingBottom: 14, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{relativeTime(e.created_at)}</span>
              </div>
              {e.payload && (
                <>
                  <button
                    onClick={() => setOpenId(open ? null : e.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '2px 0' }}
                  >
                    {open ? '▾ Hide payload' : '▸ View payload'}
                  </button>
                  {open && <pre style={codeBlock}>{prettyJson(e.payload)}</pre>}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KeyValues({ rows, rawHeaders, onCopy }: {
  rows: Array<[string, string | null]>
  rawHeaders: string | null
  onCopy: (t: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'baseline' }}>
          <span style={{ minWidth: 120, color: 'var(--text-muted)', fontWeight: 500 }}>{k}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', wordBreak: 'break-all', flex: 1 }}>
            {v ?? <em style={{ opacity: 0.5 }}>—</em>}
          </span>
          {v && (
            <button onClick={() => onCopy(v)} title="Copy" style={copyBtn}>⧉</button>
          )}
        </div>
      ))}
      {rawHeaders && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Raw headers</span>
            <button onClick={() => onCopy(prettyJson(rawHeaders))} style={copyBtn}>⧉ Copy</button>
          </div>
          <pre style={codeBlock}>{prettyJson(rawHeaders)}</pre>
        </div>
      )}
    </div>
  )
}

function SourceView({ email, onCopy }: { email: FullEmail; onCopy: (t: string) => void }) {
  const [view, setView] = useState<'html' | 'text'>('html')
  const html = email.body_html ?? ''
  const text = email.body_text ?? ''
  const sizeKb = ((new Blob([html || text]).size) / 1024).toFixed(1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setView('html')} style={pill(view === 'html')}>HTML</button>
          <button onClick={() => setView('text')} style={pill(view === 'text')}>Plain text</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sizeKb} KB</span>
          <button onClick={() => onCopy(view === 'html' ? html : text)} style={copyBtn}>⧉ Copy</button>
        </div>
      </div>
      <pre style={{ ...codeBlock, maxHeight: 240 }}>{view === 'html' ? (html || '(no HTML body)') : (text || '(no plain-text body)')}</pre>
    </div>
  )
}

function DebuggerView({ email }: { email: FullEmail }) {
  const [width, setWidth] = useState(375)
  const html = email.body_html ?? `<pre>${(email.body_text ?? '').replace(/</g, '&lt;')}</pre>`
  const size = new Blob([html]).size
  const sizeKb = (size / 1024).toFixed(1)

  // Lightweight heuristic spam-signal scan (advisory only).
  const signals: string[] = []
  const lower = (email.body_html ?? email.body_text ?? '').toLowerCase()
  if (/free|winner|congratulations|click here|act now|limited time/.test(lower)) signals.push('Spam-trigger phrases present')
  if ((email.subject ?? '').toUpperCase() === email.subject && (email.subject ?? '').length > 8) signals.push('Subject is all-caps')
  if (((email.body_html ?? '').match(/<img/gi) ?? []).length > 10) signals.push('Many images')
  if (size > 100 * 1024) signals.push('Large body (>100KB)')
  if (!email.body_text && email.body_html) signals.push('No plain-text alternative')

  const devices = [
    { label: 'Mobile', w: 375 },
    { label: 'Tablet', w: 600 },
    { label: 'Desktop', w: 800 },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {devices.map((d) => (
          <button key={d.label} onClick={() => setWidth(d.w)} style={pill(width === d.w)}>
            {d.label} · {d.w}px
          </button>
        ))}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>Size: {sizeKb} KB</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: 12, border: '1px solid var(--border)' }}>
        <iframe
          title="Responsive preview"
          srcDoc={html}
          sandbox=""
          style={{
            width, maxWidth: '100%', height: 220, border: '1px solid var(--border)',
            borderRadius: 6, background: '#fff', transition: 'width var(--duration-base) var(--ease-out)',
          }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: signals.length ? 'var(--warning)' : 'var(--success)' }}>
          {signals.length ? `⚠ ${signals.length} deliverability signal(s)` : '✓ No obvious deliverability issues'}
        </span>
        {signals.length > 0 && (
          <ul style={{ margin: '6px 0 0 18px', fontSize: 12, color: 'var(--text-secondary)' }}>
            {signals.map((s) => <li key={s}>{s}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── styles ──
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }
const codeBlock: React.CSSProperties = {
  background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  padding: 10, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto', marginTop: 6,
}
const copyBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '2px 6px', flexShrink: 0,
}
const pill = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
  background: active ? 'var(--accent-subtle)' : 'var(--bg-surface)',
  color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
  border: `1px solid ${active ? 'var(--border-accent)' : 'var(--border)'}`,
  borderRadius: 'var(--radius-full)',
})
