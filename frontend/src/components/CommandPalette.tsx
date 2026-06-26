import { useState, useEffect, useRef, useMemo } from 'react'
import { useAppStore } from '../store'
import { usePreferences, useUpdatePreferences, useAccounts } from '../queries'

interface Command {
  id: string
  label: string
  hint?: string
  icon: string
  run: () => void
  keywords?: string
}

/**
 * Command palette (⌘K / Ctrl+K). Fuzzy-filtered actions for navigation,
 * composing, folder switching, theme, and account switching. Fully
 * keyboard-driven (↑/↓/Enter/Esc).
 */
export default function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen)
  const toggle = useAppStore((s) => s.toggleCommandPalette)
  const setFolder = useAppStore((s) => s.setFolder)
  const setAccount = useAppStore((s) => s.setAccount)
  const openComposer = useAppStore((s) => s.openComposer)
  const toggleShortcuts = useAppStore((s) => s.toggleShortcuts)
  const { data: prefs } = usePreferences()
  const updatePrefs = useUpdatePreferences()
  const { data: accounts = [] } = useAccounts()

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Command[]>(() => {
    const nav = (path: string) => () => { window.location.href = path }
    const list: Command[] = [
      { id: 'compose', label: 'Compose new email', icon: '✏️', run: () => { toggle(); openComposer() }, keywords: 'write new mail' },
      { id: 'inbox', label: 'Go to Inbox', icon: '📥', run: () => { toggle(); setFolder('inbox') } },
      { id: 'sent', label: 'Go to Sent', icon: '📤', run: () => { toggle(); setFolder('sent') } },
      { id: 'drafts', label: 'Go to Drafts', icon: '📝', run: () => { toggle(); setFolder('drafts') } },
      { id: 'starred', label: 'Go to Starred', icon: '⭐', run: () => { toggle(); setFolder('starred') } },
      { id: 'spam', label: 'Go to Spam', icon: '⚠️', run: () => { toggle(); setFolder('spam') } },
      { id: 'scheduled', label: 'Go to Scheduled', icon: '⏰', run: () => { toggle(); setFolder('scheduled') } },
      { id: 'archive', label: 'Go to Archive', icon: '📦', run: () => { toggle(); setFolder('archive') } },
      { id: 'trash', label: 'Go to Trash', icon: '🗑️', run: () => { toggle(); setFolder('trash') } },
      { id: 'contacts', label: 'Open Contacts', icon: '👥', run: nav('/contacts') },
      { id: 'analytics', label: 'Open Analytics', icon: '📊', run: nav('/analytics') },
      { id: 'settings', label: 'Open Settings', icon: '⚙️', run: nav('/settings') },
      { id: 'shortcuts', label: 'Show keyboard shortcuts', icon: '⌨️', run: () => { toggle(); toggleShortcuts() } },
      {
        id: 'theme', label: `Switch theme (current: ${prefs?.theme ?? 'system'})`, icon: '🎨',
        keywords: 'dark light system appearance',
        run: () => {
          const order = ['light', 'dark', 'system'] as const
          const cur = (prefs?.theme as typeof order[number]) ?? 'system'
          const next = order[(order.indexOf(cur) + 1) % order.length]
          updatePrefs.mutate({ theme: next })
          toggle()
        },
      },
    ]
    // Account switching
    for (const a of accounts) {
      list.push({
        id: `acct-${a.id}`, label: `Switch to account: ${a.name}`, icon: '🔀',
        keywords: `account ${a.domain}`, run: () => { toggle(); setAccount(a.id) },
      })
    }
    return list
  }, [accounts, prefs?.theme, toggle, openComposer, setFolder, setAccount, toggleShortcuts, updatePrefs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => (c.label + ' ' + (c.keywords ?? '')).toLowerCase().includes(q))
  }, [query, commands])

  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.run() }
    else if (e.key === 'Escape') { e.preventDefault(); toggle() }
  }

  return (
    <div
      onClick={toggle}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 600, paddingTop: '12vh',
      }}
    >
      <div
        className="glass-card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(560px, 92vw)', maxHeight: '64vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a command or search…"
          style={{
            padding: '16px 18px', fontSize: 15, border: 'none', borderBottom: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <div style={{ overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No matching commands</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={cmd.run}
              onMouseEnter={() => setActive(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, color: 'var(--text-primary)',
                background: i === active ? 'var(--accent-subtle)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{cmd.icon}</span>
              <span style={{ flex: 1 }}>{cmd.label}</span>
              {i === active && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>↵</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 14 }}>
          <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
        </div>
      </div>
    </div>
  )
}
