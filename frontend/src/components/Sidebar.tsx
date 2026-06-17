import { useAppStore } from '../store'
import { useAccounts, useLogout } from '../queries'

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'sent', label: 'Sent', icon: '📤' },
  { id: 'drafts', label: 'Drafts', icon: '📝' },
  { id: 'archive', label: 'Archive', icon: '📦' },
  { id: 'trash', label: 'Trash', icon: '🗑️' },
]

export default function Sidebar() {
  const { data: accounts, isLoading: loadingAccounts } = useAccounts()
  const selectedAccountId = useAppStore((s) => s.selectedAccountId)
  const selectedFolder = useAppStore((s) => s.selectedFolder)
  const setAccount = useAppStore((s) => s.setAccount)
  const setFolder = useAppStore((s) => s.setFolder)
  const openComposer = useAppStore((s) => s.openComposer)
  const logout = useLogout()

  // Auto-select first account
  if (accounts && accounts.length > 0 && !selectedAccountId) {
    setAccount(accounts[0].id)
  }

  return (
    <nav className="sidebar" aria-label="Main navigation">
      {/* Logo */}
      <div style={{ padding: '4px 8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
        }}>
          <span style={{ fontSize: 14 }}>✉</span>
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>resend-client</span>
      </div>

      {/* Compose button */}
      <button
        id="compose-btn"
        className="btn btn-primary"
        onClick={() => openComposer()}
        style={{ width: '100%', justifyContent: 'center', marginBottom: 8, fontSize: 13 }}
      >
        ✏️ Compose
      </button>

      <div className="divider" />

      {/* Account switcher */}
      {loadingAccounts ? (
        <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 32, borderRadius: 8 }} />
          ))}
        </div>
      ) : accounts && accounts.length > 0 ? (
        <>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '0 10px 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Accounts
          </p>
          {accounts.map((account) => (
            <button
              key={account.id}
              id={`account-${account.id}`}
              className={`nav-item ${selectedAccountId === account.id ? 'active' : ''}`}
              onClick={() => setAccount(account.id)}
              title={account.domain}
            >
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: `hsl(${account.id.charCodeAt(4) * 13 % 360}deg 60% 45%)`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {account.name.slice(0, 1).toUpperCase()}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {account.name}
              </span>
            </button>
          ))}
        </>
      ) : (
        /* First-run wizard CTA */
        <div style={{
          padding: 12, borderRadius: 10,
          background: 'var(--accent-subtle)', border: '1px solid var(--border-accent)',
          margin: '4px 0',
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-light)', marginBottom: 4 }}>
            Welcome! 👋
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
            No accounts configured yet. Add your first Resend account to start receiving emails.
          </p>
          <a href="/admin" className="btn btn-primary" style={{ fontSize: 11, padding: '5px 10px', display: 'inline-flex' }}>
            Go to Admin →
          </a>
        </div>
      )}

      <div className="divider" />

      {/* Folder navigation */}
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '0 10px 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Folders
      </p>
      {FOLDERS.map((folder) => (
        <button
          key={folder.id}
          id={`folder-${folder.id}`}
          className={`nav-item ${selectedFolder === folder.id ? 'active' : ''}`}
          onClick={() => setFolder(folder.id as typeof selectedFolder)}
        >
          <span>{folder.icon}</span>
          {folder.label}
        </button>
      ))}

      {/* Bottom actions */}
      <div style={{ marginTop: 'auto' }}>
        <div className="divider" />
        <a href="/admin" className="nav-item" id="nav-admin">
          <span>⚙️</span> Admin
        </a>
        <button
          className="nav-item"
          id="nav-logout"
          onClick={() => logout.mutate()}
          style={{ color: 'var(--text-muted)' }}
        >
          <span>↩</span> Sign out
        </button>
      </div>
    </nav>
  )
}
