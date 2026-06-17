import React, { useState, useEffect } from 'react'
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount
} from '../queries'
import type { Account } from '../queries'
import { useAppStore } from '../store'
import { AI_MODELS, AI_MODEL_CATEGORIES, BADGE_COLORS } from './aiModels'



export default function AdminPanel() {
  const { data: accounts, isLoading: loadingAccounts } = useAccounts()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()
  const addToast = useAppStore((s) => s.addToast)

  const [selectedAcc, setSelectedAcc] = useState<Account | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [fromName, setFromName] = useState('')
  const [resendApiKey, setResendApiKey] = useState('')
  const [aiSystemPrompt, setAiSystemPrompt] = useState('')
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false)
  const [aiModel, setAiModel] = useState('@cf/meta/llama-3.1-8b-instruct')

  const [showApiKey, setShowApiKey] = useState(false)

  // Reset form when selection changes
  useEffect(() => {
    if (selectedAcc) {
      setIsCreating(false)
      setName(selectedAcc.name)
      setDomain(selectedAcc.domain)
      setFromName(selectedAcc.from_name)
      setResendApiKey('') // Don't prefill password fields
      setAiSystemPrompt(selectedAcc.ai_system_prompt)
      setAutoReplyEnabled(selectedAcc.auto_reply_enabled === 1)
      setAiModel(selectedAcc.ai_model || '@cf/meta/llama-3.1-8b-instruct')
    } else {
      resetForm()
    }
  }, [selectedAcc])

  const resetForm = () => {
    setName('')
    setDomain('')
    setFromName('Inbox')
    setResendApiKey('')
    setAiSystemPrompt('You are a helpful customer support agent. Be concise, polite, and professional.')
    setAutoReplyEnabled(false)
    setAiModel('@cf/meta/llama-3.1-8b-instruct')
  }

  const handleCreateClick = () => {
    setSelectedAcc(null)
    setIsCreating(true)
    resetForm()
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    addToast(`${label} copied to clipboard!`, 'success')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isCreating) {
      if (!resendApiKey) {
        addToast('Resend API key is required.', 'error')
        return
      }
      try {
        await createAccount.mutateAsync({
          name,
          domain,
          fromName,
          resendApiKey,
          aiSystemPrompt,
          autoReplyEnabled,
          aiModel
        })
        addToast('Account created successfully!', 'success')
        setIsCreating(false)
        resetForm()
      } catch (err: any) {
        addToast(err.message || 'Failed to create account', 'error')
      }
    } else if (selectedAcc) {
      try {
        await updateAccount.mutateAsync({
          id: selectedAcc.id,
          name,
          fromName,
          resendApiKey: resendApiKey || undefined, // only send if filled in
          aiSystemPrompt,
          autoReplyEnabled,
          aiModel
        })
        addToast('Account updated successfully!', 'success')
        setResendApiKey('') // reset field
      } catch (err: any) {
        addToast(err.message || 'Failed to update account', 'error')
      }
    }
  }

  const handleDelete = async () => {
    if (!selectedAcc) return
    if (confirm(`Are you sure you want to delete account "${selectedAcc.name}"? This will permanently delete all stored emails and attachments associated with it.`)) {
      try {
        await deleteAccount.mutateAsync(selectedAcc.id)
        addToast('Account deleted successfully.', 'success')
        setSelectedAcc(null)
        resetForm()
      } catch (err: any) {
        addToast(err.message || 'Failed to delete account', 'error')
      }
    }
  }

  // Get active webhook details for display when editing
  const workerUrl = window.location.origin
  const webhookUrl = selectedAcc ? `${workerUrl}/webhook/${selectedAcc.id}/inbound` : ''

  return (
    <main className="reading-pane active" style={{ flex: 1, flexDirection: 'row', display: 'flex', minWidth: 0 }}>
      {/* Left panel: Account list */}
      <div style={{
        width: 260,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        flexShrink: 0
      }}>
        <div style={{
          padding: '16px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)'
        }}>
          <h2 style={{ fontSize: 16 }}>Resend Accounts</h2>
          <button
            className="btn btn-primary"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={handleCreateClick}
          >
            ➕ Add
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loadingAccounts ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
            ))
          ) : accounts && accounts.length > 0 ? (
            accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => setSelectedAcc(acc)}
                className={`nav-item ${selectedAcc?.id === acc.id ? 'active' : ''}`}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  height: 'auto'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: selectedAcc?.id === acc.id ? 'var(--accent-light)' : 'var(--text-primary)' }}>
                  {acc.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {acc.domain}
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No accounts configured. Click "+ Add" to add your first account.
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Edit/Add form */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {isCreating || selectedAcc ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 650 }}>
            <div>
              <h2 style={{ fontSize: 20, marginBottom: 4 }}>
                {isCreating ? 'Configure New Resend Account' : `Manage: ${name}`}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {isCreating 
                  ? 'Connect an email domain hosted on Resend to start managing it in this client.' 
                  : `Account created on ${new Date(selectedAcc!.created_at).toLocaleDateString()}`}
              </p>
            </div>

            <div className="divider" style={{ margin: 0 }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="sr-only" htmlFor="acc-name">Account Name</label>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Account Name
                </span>
                <input
                  id="acc-name"
                  type="text"
                  className="input"
                  placeholder="e.g. Support Inbox"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="acc-domain">Verified Domain</label>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Verified Domain
                </span>
                <input
                  id="acc-domain"
                  type="text"
                  className="input"
                  placeholder="e.g. support.yourdomain.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  required
                  disabled={!isCreating} // Domain is primary lookup, lock it after creation
                  style={!isCreating ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label className="sr-only" htmlFor="acc-from-name">From Name</label>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  From Name
                </span>
                <input
                  id="acc-from-name"
                  type="text"
                  className="input"
                  placeholder="e.g. Support Team"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="acc-api-key">Resend API Key</label>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Resend API Key {!isCreating && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(Leave blank to keep current)</span>}
                </span>
                <div style={{ position: 'relative' }}>
                  <input
                    id="acc-api-key"
                    type={showApiKey ? 'text' : 'password'}
                    className="input"
                    placeholder={isCreating ? 're_...' : '••••••••••••••••••••••••'}
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    required={isCreating}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12
                    }}
                  >
                    {showApiKey ? '🙈 Hide' : '👁️ Show'}
                  </button>
                </div>
              </div>
            </div>

            <div className="divider" style={{ margin: 0 }} />

            {/* AI Configurations */}
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>🤖 Workers AI Copilot Settings</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* AI Model Picker — categorized cards */}
                <div>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    AI Model
                  </span>
                  {AI_MODEL_CATEGORIES.map((cat) => {
                    const models = AI_MODELS.filter((m) => m.category === cat)
                    return (
                      <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                          {cat}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                          {models.map((model) => {
                            const isSelected = aiModel === model.id
                            return (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => setAiModel(model.id)}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                                  background: isSelected ? 'color-mix(in srgb, var(--accent) 10%, var(--bg-elevated))' : 'var(--bg-elevated)',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 3,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--accent-light)' : 'var(--text-primary)' }}>
                                    {model.name}
                                  </span>
                                  {model.badge && (
                                    <span style={{
                                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                                      background: BADGE_COLORS[model.badge] ?? 'var(--text-muted)',
                                      color: '#fff', letterSpacing: '0.04em', whiteSpace: 'nowrap', flexShrink: 0,
                                    }}>
                                      {model.badge}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                  {model.description}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {/* Show selected model ID for reference */}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                    Selected: {aiModel}
                  </div>
                </div>

                <div>
                  <label className="sr-only" htmlFor="acc-ai-prompt">AI System Prompt</label>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    AI System Prompt / Personality
                  </span>
                  <textarea
                    id="acc-ai-prompt"
                    className="input"
                    rows={3}
                    placeholder="Describe how the AI should write drafts and auto-replies..."
                    value={aiSystemPrompt}
                    onChange={(e) => setAiSystemPrompt(e.target.value)}
                    style={{ resize: 'vertical', minHeight: 60 }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <input
                    id="acc-auto-reply"
                    type="checkbox"
                    checked={autoReplyEnabled}
                    onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                  <label htmlFor="acc-auto-reply" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>
                    Enable AI Auto-Reply (Autopilot mode for incoming emails)
                  </label>
                </div>
              </div>
            </div>

            {!isCreating && selectedAcc && (
              <>
                <div className="divider" style={{ margin: 0 }} />

                {/* Webhook Configuration Guide */}
                <div>
                  <h3 style={{ fontSize: 15, marginBottom: 12 }}>⚡ Inbound Webhook Configuration</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
                    Copy these credentials into your **Resend Dashboard &gt; Webhooks** page to allow this client to receive incoming emails and track delivery events.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        Endpoint URL
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="text" className="input" value={webhookUrl} readOnly style={{ opacity: 0.8 }} />
                        <button type="button" className="btn btn-ghost" onClick={() => handleCopy(webhookUrl, 'Webhook URL')}>
                          Copy
                        </button>
                      </div>
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        Webhook Secret (Svix secret keys)
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="text" className="input" value={selectedAcc.webhook_secret} readOnly style={{ opacity: 0.8 }} />
                        <button type="button" className="btn btn-ghost" onClick={() => handleCopy(selectedAcc.webhook_secret, 'Webhook Secret')}>
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="divider" style={{ margin: 0 }} />

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createAccount.isPending || updateAccount.isPending}
              >
                {createAccount.isPending || updateAccount.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
              
              {!isCreating && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={deleteAccount.isPending}
                  style={{ marginLeft: 'auto' }}
                >
                  {deleteAccount.isPending ? 'Deleting...' : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete Account</>
                  )}
                </button>
              )}
            </div>
          </form>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-muted)', gap: 12
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
              <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
            <h3 style={{ fontWeight: 500 }}>Resend Client Admin Dashboard</h3>
            <p style={{ fontSize: 13, maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
              Select an account from the list to modify its settings, view webhooks, or click "+ Add" to configure a new inbox.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
