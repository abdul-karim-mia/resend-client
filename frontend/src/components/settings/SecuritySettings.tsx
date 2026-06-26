import { useState } from 'react'
import {
  useSecurityStatus, useTotpInit, useTotpEnable, useTotpDisable,
  useSessions, useAuditLog,
} from '../../queries'
import { useAppStore } from '../../store'
import { SettingsSection } from './primitives'

export default function SecuritySettings() {
  const { data: status } = useSecurityStatus()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <TwoFactor enabled={!!status?.totpEnabled} />
      <LoginHistory />
      <AuditTrail />
    </div>
  )
}

function TwoFactor({ enabled }: { enabled: boolean }) {
  const init = useTotpInit()
  const enable = useTotpEnable()
  const disable = useTotpDisable()
  const addToast = useAppStore((s) => s.addToast)
  const [enroll, setEnroll] = useState<{ secret: string; uri: string } | null>(null)
  const [code, setCode] = useState('')

  const startEnroll = async () => {
    const data = await init.mutateAsync()
    setEnroll(data)
  }
  const confirmEnable = async () => {
    try { await enable.mutateAsync(code); setEnroll(null); setCode(''); addToast('Two-factor authentication enabled', 'success') }
    catch { addToast('Invalid code — try again', 'error') }
  }
  const doDisable = async () => {
    try { await disable.mutateAsync(code); setCode(''); addToast('Two-factor disabled', 'success') }
    catch { addToast('Invalid code', 'error') }
  }

  return (
    <SettingsSection title="Two-factor authentication" description="Require a time-based one-time code (TOTP) at login. Works with Google Authenticator, 1Password, Authy, etc.">
      {enabled ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>✅ Enabled</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Current 6-digit code" inputMode="numeric" style={input} />
            <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--error)' }} onClick={doDisable}>Disable 2FA</button>
          </div>
        </div>
      ) : enroll ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Add this secret to your authenticator app (manual entry), then enter the generated code to confirm.
          </p>
          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Secret key</div>
            <code style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', wordBreak: 'break-all' }}>{enroll.secret}</code>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, marginBottom: 4 }}>otpauth URI</div>
            <code style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>{enroll.uri}</code>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" style={input} />
            <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={confirmEnable} disabled={code.length !== 6}>Verify &amp; enable</button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setEnroll(null); setCode('') }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Two-factor authentication is currently off.</p>
          <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={startEnroll} disabled={init.isPending}>
            {init.isPending ? 'Generating…' : 'Enable 2FA'}
          </button>
        </div>
      )}
    </SettingsSection>
  )
}

function LoginHistory() {
  const { data: sessions = [] } = useSessions()
  return (
    <SettingsSection title="Login history" description="Recent sign-ins to your account.">
      {sessions.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No sessions recorded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sessions.map((s) => (
            <div key={s.id} style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{s.ip ?? 'unknown IP'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>
                  {s.user_agent ?? '—'}
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(s.created_at + 'Z').toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  )
}

function AuditTrail() {
  const { data: logs = [] } = useAuditLog()
  return (
    <SettingsSection title="Audit log" description="Security-relevant actions on your account.">
      {logs.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No audit entries yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {logs.map((l) => (
            <div key={l.id} style={row}>
              <div style={{ minWidth: 0 }}>
                <code style={{ fontSize: 12, color: 'var(--accent-light)', fontFamily: 'JetBrains Mono, monospace' }}>{l.action}</code>
                {l.detail && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{l.detail}</span>}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(l.created_at + 'Z').toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  )
}

const input: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', width: 160,
  background: 'var(--bg-base)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', outline: 'none',
}
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  padding: '10px 0', borderBottom: '1px solid var(--border)',
}
