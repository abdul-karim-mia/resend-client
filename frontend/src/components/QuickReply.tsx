import { useState, useEffect } from 'react'
import { useAppStore } from '../store'
import { useSendEmail, useQuickReplySuggestions } from '../queries'

interface Email {
  id: string
  subject: string | null
  sender_email: string
  account_id: string
  thread_id: string
}

interface QuickReplyProps {
  email: Email
  accountId: string
}

export default function QuickReply({ email, accountId }: QuickReplyProps) {
  const openComposer = useAppStore((s) => s.openComposer)
  const addToast = useAppStore((s) => s.addToast)
  const sendEmail = useSendEmail()
  const getAISuggestions = useQuickReplySuggestions()

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null) // which chip is sending

  // Fetch AI suggestions when email changes
  useEffect(() => {
    if (!email?.id || !accountId) return
    setSuggestions([])
    setLoading(true)

    getAISuggestions.mutate(
      { emailId: email.id, accountId },
      {
        onSuccess: (data) => {
          setSuggestions(data.suggestions ?? [])
          setLoading(false)
        },
        onError: () => {
          // Fall back to generic suggestions
          setSuggestions(['Thanks!', 'Got it.', "I'll look into this."])
          setLoading(false)
        },
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email.id, accountId])

  const handleChipSend = async (text: string) => {
    setSending(text)
    try {
      await sendEmail.mutateAsync({
        accountId,
        to: [email.sender_email],
        subject: `Re: ${email.subject ?? '(no subject)'}`,
        html: `<p>${text}</p>`,
        replyToEmailId: email.id,
      })
      addToast('Quick reply sent', 'success')
    } catch {
      addToast('Failed to send quick reply', 'error')
    } finally {
      setSending(null)
    }
  }

  return (
    <div style={{
      padding: '10px 16px',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-elevated)',
      display: 'flex', alignItems: 'center', gap: 8,
      flexWrap: 'wrap',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2.5">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Quick reply</span>
      </div>

      {loading ? (
        // Skeleton chips while AI generates
        <>
          {[80, 60, 100].map((w, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ width: w, height: 28, borderRadius: 'var(--radius-full)' }}
            />
          ))}
        </>
      ) : (
        suggestions.map((s, i) => (
          <button
            key={i}
            id={`quick-reply-chip-${i}`}
            onClick={() => handleChipSend(s)}
            disabled={sending !== null}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-full)',
              background: sending === s ? 'var(--accent-muted)' : 'var(--bg-overlay)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 12,
              cursor: sending !== null ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              opacity: sending !== null && sending !== s ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!sending) {
                e.currentTarget.style.borderColor = 'var(--border-accent)'
                e.currentTarget.style.background = 'var(--accent-subtle)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = sending === s ? 'var(--accent-muted)' : 'var(--bg-overlay)'
            }}
          >
            {sending === s ? '…' : s}
          </button>
        ))
      )}

      <button
        id="quick-reply-full"
        className="btn btn-ghost"
        onClick={() => openComposer(email.id)}
        style={{ fontSize: 12, marginLeft: 'auto', padding: '5px 12px' }}
      >
        Full Reply ↩
      </button>
    </div>
  )
}
