import { useState } from 'react'
import {
  useAccounts, useSignatures, useCreateSignature, useUpdateSignature, useDeleteSignature,
} from '../../queries'
import { useAppStore } from '../../store'
import { SettingsSection, Select } from './primitives'

/**
 * Email settings — manages multiple signatures per account. The account is
 * chosen from a dropdown (defaults to the currently-selected account).
 */
export default function EmailSettings() {
  const { data: accounts = [] } = useAccounts()
  const storeAccountId = useAppStore((s) => s.selectedAccountId)
  const addToast = useAppStore((s) => s.addToast)
  const [accountId, setAccountId] = useState<string>(storeAccountId ?? accounts[0]?.id ?? '')

  const effectiveAccountId = accountId || accounts[0]?.id || ''
  const { data: signatures = [] } = useSignatures(effectiveAccountId || null)
  const createSig = useCreateSignature(effectiveAccountId)
  const updateSig = useUpdateSignature(effectiveAccountId)
  const deleteSig = useDeleteSignature(effectiveAccountId)

  const [name, setName] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')

  const handleCreate = async () => {
    if (!name.trim() || !effectiveAccountId) return
    await createSig.mutateAsync({ name: name.trim(), bodyHtml, isDefault: signatures.length === 0 })
    setName(''); setBodyHtml('')
    addToast('Signature created', 'success')
  }

  if (accounts.length === 0) {
    return (
      <SettingsSection title="Signatures" description="Add an account first to manage signatures.">
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No accounts configured.</p>
      </SettingsSection>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SettingsSection title="Signatures" description="Create reusable signatures and insert them while composing.">
        {accounts.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Select
              ariaLabel="Account"
              value={effectiveAccountId}
              onChange={setAccountId}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>
        )}

        {/* Existing signatures */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {signatures.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
              No signatures yet. Create your first below.
            </p>
          )}
          {signatures.map((sig) => (
            <div key={sig.id} style={{
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {sig.name}
                  {sig.is_default === 1 && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-full)',
                      background: 'var(--accent-subtle)', color: 'var(--accent-light)',
                    }}>Default</span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {sig.is_default !== 1 && (
                    <button className="btn btn-ghost" style={{ fontSize: 11 }}
                      onClick={() => updateSig.mutate({ id: sig.id, isDefault: true })}>
                      Make default
                    </button>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--error)' }}
                    onClick={() => { deleteSig.mutate(sig.id); addToast('Signature deleted', 'success') }}>
                    Delete
                  </button>
                </div>
              </div>
              <div
                style={{
                  fontSize: 12, color: 'var(--text-secondary)', padding: 10,
                  background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', maxHeight: 120, overflow: 'auto',
                }}
                // Signature preview — content is authored by the admin user only.
                dangerouslySetInnerHTML={{ __html: sig.body_html || '<em style="opacity:.6">(empty)</em>' }}
              />
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="New signature" description="HTML is supported. Use the editor in the composer for rich formatting, or paste HTML here.">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Signature name (e.g. Personal, Support)"
          style={inputStyle}
        />
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          placeholder="<p>Best regards,<br/>Your Name</p>"
          rows={5}
          style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: 13, opacity: name.trim() ? 1 : 0.5 }}
            disabled={!name.trim()}
            onClick={handleCreate}
          >
            Create signature
          </button>
        </div>
      </SettingsSection>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
  background: 'var(--bg-base)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  outline: 'none', marginTop: 8,
}
