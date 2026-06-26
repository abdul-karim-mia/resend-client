import { useState } from 'react'
import { useAppStore } from '../store'
import { useEmails, useSearchEmails, useMoveFolder, useDeleteEmail } from '../queries'
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

const EMAILS_PER_PAGE = 50

export default function EmailList() {
  const [searchInput, setSearchInput] = useState('')
  const accountId = useAppStore((s) => s.selectedAccountId)
  const folder = useAppStore((s) => s.selectedFolder)
  const page = useAppStore((s) => s.emailListPage)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const selectedEmailId = useAppStore((s) => s.selectedEmailId)
  const setEmail = useAppStore((s) => s.setEmail)
  const setPage = useAppStore((s) => s.setEmailListPage)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)

  const isSearching = searchQuery.length > 0
  const { data: regularEmails, isLoading: regularLoading, isError: regularError } = useEmails(accountId, folder, page, EMAILS_PER_PAGE)
  const { data: searchResults, isLoading: searchLoading, isError: searchError } = useSearchEmails(accountId, searchQuery)

  const emails = isSearching ? searchResults : regularEmails
  const isLoading = isSearching ? searchLoading : regularLoading
  const isError = isSearching ? searchError : regularError

  const hasNextPage = emails && emails.length === EMAILS_PER_PAGE
  const canPrevPage = page > 1

  const handleSearch = (value: string) => {
    setSearchInput(value)
    if (value.length > 0) {
      setSearchQuery(value)
    } else {
      setSearchQuery('')
    }
  }

  return (
    <div className="email-list" id="email-list">
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {/* Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="text"
            placeholder="Search emails..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: 13,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-accent)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          />
          {searchInput && (
            <button
              onClick={() => handleSearch('')}
              style={{
                padding: '4px 8px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 16,
                flexShrink: 0,
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Info bar */}
        <div style={{
          padding: '4px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}>
          <h2 style={{
            fontSize: 13,
            fontWeight: 700,
            textTransform: 'capitalize',
            margin: 0,
            letterSpacing: '-0.01em',
            color: 'var(--text-primary)',
          }}>
            {isSearching ? `Search results for "${searchQuery}"` : folder}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {page > 1 && !isSearching && (
              <span style={{ fontSize: 11 }}>
                Page {page}
              </span>
            )}
            {emails && emails.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                padding: '2px 7px', borderRadius: 'var(--radius-full)',
                background: 'var(--accent-subtle)', color: 'var(--accent-light)',
                border: '1px solid var(--border-accent)',
              }}>
                {isSearching ? `${emails.length} found` : `${emails.length} / page`}
              </span>
            )}
          </div>
        </div>
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
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ opacity: 0.25 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                {folder === 'trash' ? (
                  <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></>
                ) : folder === 'sent' ? (
                  <><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></>
                ) : folder === 'drafts' ? (
                  <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>
                ) : (
                  <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>
                )}
              </svg>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
              {folder === 'inbox' ? 'Inbox is empty' : `No ${folder} emails`}
            </p>
            {folder === 'inbox' && (
              <p style={{ fontSize: 11, color: 'var(--text-disabled)', lineHeight: 1.5 }}>
                New emails will appear here
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

      {/* Pagination footer (only when not searching) */}
      {!isSearching && (canPrevPage || hasNextPage) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}>
          <button
            disabled={!canPrevPage}
            onClick={() => setPage(page - 1)}
            className="btn btn-ghost"
            style={{ fontSize: 12, opacity: canPrevPage ? 1 : 0.5, cursor: canPrevPage ? 'pointer' : 'default' }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Page {page}
          </span>
          <button
            disabled={!hasNextPage}
            onClick={() => setPage(page + 1)}
            className="btn btn-ghost"
            style={{ fontSize: 12, opacity: hasNextPage ? 1 : 0.5, cursor: hasNextPage ? 'pointer' : 'default' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function getDeliveryIcon(status: string): string {
  switch (status) {
    case 'pending': return '🔄'
    case 'sent': return '📤'
    case 'delivered': return '✅'
    case 'opened': return '👁'
    case 'bounced': return '⚠️'
    case 'failed': return '❌'
    default: return '❓'
  }
}

interface EmailItemProps {
  email: Email
  isActive: boolean
  onClick: () => void
  animationDelay: number
}

function EmailItem({ email, isActive, onClick, animationDelay }: EmailItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isUnread = email.read_status === 0 && email.direction === 'inbound'
  const hasAttachments = email.attachment_count && email.attachment_count > 0
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

  const deliveryIcon = email.direction === 'outbound' ? getDeliveryIcon(email.delivery_status) : null
  const moveFolder = useMoveFolder()
  const deleteEmail = useDeleteEmail()
  const addToast = useAppStore((s) => s.addToast)

  const handleArchive = () => {
    moveFolder.mutate({ emailId: email.id, folder: 'archive' })
    addToast('Archived', 'success')
  }

  const handleSpam = () => {
    moveFolder.mutate({ emailId: email.id, folder: 'spam' })
    addToast('Marked as spam', 'success')
  }

  const handleDelete = () => {
    deleteEmail.mutate(email.id)
    addToast('Deleted', 'success')
  }

  return (
    <div
      id={`email-item-${email.id}`}
      className={`email-item ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        animationDelay: `${animationDelay}s`,
        animation: 'fadeIn 0.25s var(--ease-out) both',
        position: 'relative',
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-selected={isActive}
      aria-label={`Email from ${displayName}: ${email.subject ?? '(no subject)'}${hasAttachments ? ' with attachments' : ''}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3, gap: 8 }}>
        <span className="email-sender" style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
          {hasAttachments && <span title="Has attachments">📎</span>}
          {deliveryIcon && <span title={email.delivery_status}>{deliveryIcon}</span>}
          <span className="email-time">{formatTime(email.created_at)}</span>
        </div>
      </div>
      <div className="email-subject">{email.subject ?? '(no subject)'}</div>
      <div className="email-snippet">{email.body_text?.slice(0, 80) ?? ''}</div>

      {/* Quick actions (show on hover) */}
      {isHovered && (
        <div style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          gap: 4,
          opacity: 0.9,
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleArchive()
            }}
            title="Archive (E)"
            style={{
              padding: '4px 8px',
              fontSize: 12,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-subtle)'
              e.currentTarget.style.borderColor = 'var(--border-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            📦
          </button>
          {email.folder !== 'spam' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSpam()
              }}
              title="Mark as spam"
              style={{
                padding: '4px 8px',
                fontSize: 12,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-subtle)'
                e.currentTarget.style.borderColor = 'var(--border-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              ⚠️
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
            title="Delete (#)"
            style={{
              padding: '4px 8px',
              fontSize: 12,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee'
              e.currentTarget.style.borderColor = '#f00'
              e.currentTarget.style.color = '#d00'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            🗑️
          </button>
        </div>
      )}

      {isUnread && <span className="unread-dot" aria-hidden="true" />}
    </div>
  )
}
