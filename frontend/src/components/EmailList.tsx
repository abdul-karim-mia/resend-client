import { useAppStore } from '../store'
import { useEmails } from '../queries'
import type { Email } from '../queries'

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function EmailSkeleton() {
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="skeleton" style={{ width: '40%', height: 13 }} />
        <div className="skeleton" style={{ width: 40, height: 11 }} />
      </div>
      <div className="skeleton" style={{ width: '80%', height: 12, marginBottom: 4 }} />
      <div className="skeleton" style={{ width: '60%', height: 11 }} />
    </div>
  )
}

export default function EmailList() {
  const accountId = useAppStore((s) => s.selectedAccountId)
  const folder = useAppStore((s) => s.selectedFolder)
  const selectedEmailId = useAppStore((s) => s.selectedEmailId)
  const setEmail = useAppStore((s) => s.setEmail)

  const { data: emails, isLoading, isError } = useEmails(accountId, folder)

  return (
    <div className="email-list" id="email-list">
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize', margin: 0 }}>
          {folder}
        </h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {emails ? `${emails.length} emails` : ''}
        </span>
      </div>

      {/* Email items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <EmailSkeleton key={i} />
            ))}
          </>
        )}

        {isError && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            Failed to load emails
          </div>
        )}

        {!isLoading && emails && emails.length === 0 && (
          <div style={{
            padding: 40,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 40, opacity: 0.4 }}>
              {folder === 'inbox' ? '📥' : folder === 'sent' ? '📤' : folder === 'trash' ? '🗑️' : '📦'}
            </span>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
              {folder === 'inbox' ? 'Your inbox is empty' : `No ${folder} emails`}
            </p>
            {folder === 'inbox' && (
              <p style={{ fontSize: 12, color: 'var(--text-disabled)' }}>
                New emails will appear here when received via Resend
              </p>
            )}
          </div>
        )}

        {emails?.map((email, idx) => (
          <EmailItem
            key={email.id}
            email={email}
            isActive={email.id === selectedEmailId}
            onClick={() => setEmail(email.id)}
            animationDelay={idx * 0.03}
          />
        ))}
      </div>
    </div>
  )
}

interface EmailItemProps {
  email: Email
  isActive: boolean
  onClick: () => void
  animationDelay: number
}

function EmailItem({ email, isActive, onClick, animationDelay }: EmailItemProps) {
  const isUnread = email.read_status === 0 && email.direction === 'inbound'
  const recipients = (() => {
    try {
      const arr = JSON.parse(email.recipient_to) as string[]
      return arr.join(', ')
    } catch {
      return email.recipient_to
    }
  })()

  const displayName = email.direction === 'inbound'
    ? (email.sender_name || email.sender_email)
    : `To: ${recipients}`

  return (
    <div
      id={`email-item-${email.id}`}
      className={`email-item ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
      onClick={onClick}
      style={{ animationDelay: `${animationDelay}s`, animation: 'fadeIn 0.25s var(--ease-out) both' }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-selected={isActive}
      aria-label={`Email from ${displayName}: ${email.subject ?? '(no subject)'}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span className="email-sender" style={{ maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <span className="email-time">{formatTime(email.created_at)}</span>
      </div>
      <div className="email-subject">{email.subject ?? '(no subject)'}</div>
      <div className="email-snippet">{email.body_text?.slice(0, 80) ?? ''}</div>
      {isUnread && <span className="unread-dot" aria-hidden="true" />}
    </div>
  )
}
