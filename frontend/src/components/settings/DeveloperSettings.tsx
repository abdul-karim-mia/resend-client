import { useState } from 'react'
import {
  useAccounts, useDomainDiagnostics, useWebhookEvents, useReplayWebhook,
} from '../../queries'
import { useAppStore } from '../../store'
import { SettingsSection, Select } from './primitives'

const HEALTH_COLOR: Record<string, string> = {
  healthy: 'var(--success)', warning: 'var(--warning)', critical: 'var(--error)',
}

export default function DeveloperSettings() {
  const { data: accounts = [] } = useAccounts()
  const storeAccountId = useAppStore((s) => s.selectedAccountId)
  const [accountId, setAccountId] = useState(storeAccountId ?? accounts[0]?.id ?? '')
  const effectiveId = accountId || accounts[0]?.id || ''

  const { data: diag, isLoading: diagLoading } = useDomainDiagnostics(effectiveId || null)
  const { data: events = [] } = useWebhookEvents(effectiveId || null)
  const replay = useReplayWebhook()
  const addToast = useAppStore((s) => s.addToast)

  if (accounts.length === 0) {
    return (
      <SettingsSection title="Developer" description="Add an account to access developer tools.">
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No accounts configured.</p>
      </SettingsSection>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {accounts.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Select
            ariaLabel="Account"
            value={effectiveId}
            onChange={setAccountId}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        </div>
      )}

      {/* Domain diagnostics */}
      <SettingsSection title="Domain diagnostics" description="Live DNS checks for sending authentication.">
        {diagLoading && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Checking DNS…</p>}
        {diag && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{diag.domain}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                color: HEALTH_COLOR[diag.health], padding: '2px 8px', borderRadius: 'var(--radius-full)',
                background: 'var(--bg-overlay)',
              }}>
                {diag.health} · {diag.score}/3
              </span>
            </div>
            {(['spf', 'dkim', 'dmarc'] as const).map((k) => {
              const ch = diag.checks[k]
              return (
                <div key={k} style={{
                  display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 14 }}>{ch.ok ? '✅' : '❌'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{ch.detail}</div>
                    {ch.record && (
                      <pre style={{
                        marginTop: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--text-secondary)', background: 'var(--bg-base)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        padding: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      }}>{ch.record}</pre>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </SettingsSection>

      {/* Webhook inspector */}
      <SettingsSection title="Webhook inspector" description="Recent inbound + delivery events received from Resend. Replay re-runs an event through the handler.">
        {events.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No events yet.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map((e) => <WebhookRow key={e.id} event={e} onReplay={async () => {
            await replay.mutateAsync(e.id)
            addToast('Webhook replayed', 'success')
          }} />)}
        </div>
      </SettingsSection>
    </div>
  )
}

function WebhookRow({ event, onReplay }: {
  event: { id: string; type: string; payload: string | null; created_at: string; resend_email_id: string | null }
  onReplay: () => void
}) {
  const [open, setOpen] = useState(false)
  const pretty = (() => {
    if (!event.payload) return ''
    try { return JSON.stringify(JSON.parse(event.payload), null, 2) } catch { return event.payload }
  })()
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          background: 'var(--accent-subtle)', color: 'var(--accent-light)',
        }}>{event.type}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {new Date(event.created_at + 'Z').toLocaleString()}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'View'}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={onReplay}>↻ Replay</button>
        </div>
      </div>
      {open && (
        <pre style={{
          marginTop: 8, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)',
          background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto',
        }}>{pretty}</pre>
      )}
    </div>
  )
}
