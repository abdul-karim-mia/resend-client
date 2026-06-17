import { useAppStore } from '../store'
import { useEmail, useMoveFolder, useMarkRead } from '../queries'
import SafeEmailViewer from './SafeEmailViewer'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export default function ReadingPane() {
  const emailId = useAppStore((s) => s.selectedEmailId)
  const openComposer = useAppStore((s) => s.openComposer)
  const addToast = useAppStore((s) => s.addToast)
  const moveFolder = useMoveFolder()
  const markRead = useMarkRead()

  const { data: email, isLoading } = useEmail(emailId)

  if (!emailId) {
    return (
      <div className="reading-pane" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', opacity: 0.35 }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>✉️</div>
          <p style={{ fontSize: 15, fontWeight: 500 }}>Select an email to read</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            or press <kbd style={{ padding: '1px 5px', background: 'var(--bg-elevated)', borderRadius: 4, border: '1px solid var(--border)', fontSize: 11 }}>C</kbd> to compose
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="reading-pane">
        <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
          <div className="skeleton" style={{ width: '60%', height: 22, marginBottom: 12 }} />
          <div className="skeleton" style={{ width: '40%', height: 14, marginBottom: 6 }} />
          <div className="skeleton" style={{ width: '30%', height: 12 }} />
        </div>
        <div style={{ padding: 24 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: `${85 - i * 5}%`, height: 14, marginBottom: 10 }} />
          ))}
        </div>
      </div>
    )
  }

  if (!email) return null

  const handleArchive = async () => {
    await moveFolder.mutateAsync({ emailId: email.id, folder: 'archive' })
    addToast('Archived', 'success', {
      label: 'Undo',
      onClick: () => moveFolder.mutate({ emailId: email.id, folder: 'inbox' }),
    })
  }

  const handleTrash = async () => {
    await moveFolder.mutateAsync({ emailId: email.id, folder: 'trash' })
    addToast('Moved to trash', 'success', {
      label: 'Undo',
      onClick: () => moveFolder.mutate({ emailId: email.id, folder: 'inbox' }),
    })
  }

  const handleDownloadAttachment = async (attId: string, filename: string) => {
    const res = await fetch(`/api/attachments/${attId}/download`, { credentials: 'include' })
    const data = await res.json() as { success: boolean; data: { url: string } }
    if (data.success) {
      const a = document.createElement('a')
      a.href = data.data.url
      a.download = filename
      a.click()
    }
  }

  const recipients = (() => {
    try { return (JSON.parse(email.recipient_to) as string[]).join(', ') } catch { return email.recipient_to }
  })()

  return (
    <div className="reading-pane">
      {/* Action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexWrap: 'wrap',
      }}>
        <button id="action-reply" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => openComposer(email.id)}>
          ↩ Reply
        </button>
        <button id="action-forward" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => openComposer()}>
          ↪ Forward
        </button>
        <button id="action-archive" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={handleArchive}>
          📦 Archive
        </button>
        <button id="action-trash" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={handleTrash}>
          🗑 Trash
        </button>
        <button
          id="action-read-toggle"
          className="btn btn-ghost"
          style={{ fontSize: 13, marginLeft: 'auto' }}
          onClick={() => markRead.mutate({ emailId: email.id, read: email.read_status === 0 })}
        >
          {email.read_status === 1 ? '○ Mark unread' : '● Mark read'}
        </button>
      </div>

      {/* Email header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 20, marginBottom: 14 }}>{email.subject ?? '(no subject)'}</h1>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Avatar */}
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: `hsl(${(email.sender_email?.charCodeAt(0) ?? 0) * 17 % 360}deg 50% 40%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {(email.sender_name || email.sender_email).slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 14 }}>
                {email.sender_name || email.sender_email}
              </strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                {formatDate(email.created_at)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {email.sender_email !== (email.sender_name || email.sender_email) && (
                <span>{email.sender_email} → </span>
              )}
              {recipients}
            </div>
          </div>
        </div>
      </div>

      {/* Email body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px' }}>
        {email.body_html ? (
          <SafeEmailViewer html={email.body_html} />
        ) : (
          <pre style={{
            padding: 24, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}>
            {email.body_text ?? '(no content)'}
          </pre>
        )}
      </div>

      {/* Attachments */}
      {email.attachments && email.attachments.length > 0 && (
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, flexWrap: 'wrap',
        }}>
          {email.attachments.map((att) => (
            <button
              key={att.id}
              id={`attachment-${att.id}`}
              onClick={() => handleDownloadAttachment(att.id, att.filename)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer', color: 'var(--text-primary)',
                fontSize: 12, fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.background = 'var(--accent-subtle)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
            >
              📎 {att.filename}
              {att.size_bytes ? <span style={{ color: 'var(--text-muted)' }}>{formatBytes(att.size_bytes)}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
