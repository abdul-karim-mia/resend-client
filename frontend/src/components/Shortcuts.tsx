import { useEffect, useRef } from 'react'
import { useAppStore } from '../store'

/**
 * Global keyboard shortcuts hook
 * Shortcuts:
 * - C        → Open composer
 * - R        → Reply to selected email
 * - E        → Archive
 * - #        → Trash
 * - U        → Mark unread
 * - J/K      → Next/prev email
 * - /        → Focus search (future)
 * - Cmd+K    → Command palette
 * - ?        → Shortcuts overlay
 * - Esc      → Close modals
 */
export function useKeyboardShortcuts() {
  const openComposer = useAppStore((s) => s.openComposer)
  const closeComposer = useAppStore((s) => s.closeComposer)
  const composerOpen = useAppStore((s) => s.composerOpen)
  const selectedEmailId = useAppStore((s) => s.selectedEmailId)
  const setEmail = useAppStore((s) => s.setEmail)
  const setFolder = useAppStore((s) => s.setFolder)
  const toggleCommandPalette = useAppStore((s) => s.toggleCommandPalette)
  const toggleShortcuts = useAppStore((s) => s.toggleShortcuts)
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen)
  // Tracks a pending "g" prefix for Gmail-style sequences (g then i / g then s).
  const gPendingRef = useRef(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire in inputs/textareas/TipTap
      const target = e.target as HTMLElement
      const isEditing = target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
        || target.closest('.ProseMirror')

      if (isEditing) {
        if (e.key === 'Escape') closeComposer()
        return
      }

      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'k') { e.preventDefault(); toggleCommandPalette(); return }
      }

      // Gmail-style "g then X" sequences (e.g. g i → inbox, g s → sent).
      const now = Date.now()
      const gActive = now - gPendingRef.current < 1200
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault()
        gPendingRef.current = now
        return
      }
      if (gActive) {
        gPendingRef.current = 0
        const map: Record<string, () => void> = {
          i: () => setFolder('inbox'), s: () => setFolder('sent'),
          d: () => setFolder('drafts'), t: () => setFolder('trash'),
          a: () => setFolder('archive'),
        }
        const fn = map[e.key.toLowerCase()]
        if (fn) { e.preventDefault(); fn(); return }
      }

      switch (e.key) {
        case 'c': case 'C':
          e.preventDefault()
          openComposer()
          break
        case 'r': case 'R':
          e.preventDefault()
          if (selectedEmailId) openComposer(selectedEmailId)
          break
        case 'a': case 'A':
          e.preventDefault()
          if (selectedEmailId) triggerButton('action-reply-all')
          break
        case 'f': case 'F':
          e.preventDefault()
          triggerButton('action-forward')
          break
        case 's': case 'S':
          e.preventDefault()
          triggerButton('action-star')
          break
        case 'e': case 'E':
          e.preventDefault()
          triggerButton('action-archive')
          break
        case '#':
          e.preventDefault()
          triggerButton('action-trash')
          break
        case 'u': case 'U':
          e.preventDefault()
          triggerButton('action-read-toggle')
          break
        case '?':
          e.preventDefault()
          toggleShortcuts()
          break
        case 'j': case 'J':
          e.preventDefault()
          navigateEmailList(1)
          break
        case 'k': case 'K':
          e.preventDefault()
          navigateEmailList(-1)
          break
        case 'Escape':
          if (composerOpen) closeComposer()
          if (commandPaletteOpen) toggleCommandPalette()
          break
      }
    }

    const triggerButton = (id: string) => {
      const button = document.getElementById(id)
      if (button && button instanceof HTMLButtonElement) {
        button.click()
      }
    }

    const navigateEmailList = (direction: 1 | -1) => {
      const emailItems = Array.from(document.querySelectorAll('[id^="email-item-"]')) as HTMLElement[]
      if (emailItems.length === 0) return

      let nextIndex = 0
      if (selectedEmailId) {
        const currentIndex = emailItems.findIndex((el) => {
          const id = el.id.replace('email-item-', '')
          return id === selectedEmailId
        })
        if (currentIndex >= 0) {
          nextIndex = Math.max(0, Math.min(currentIndex + direction, emailItems.length - 1))
        }
      }

      const nextElement = emailItems[nextIndex]
      if (nextElement) {
        const emailId = nextElement.id.replace('email-item-', '')
        setEmail(emailId)
        nextElement.scrollIntoView({ block: 'nearest' })
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [composerOpen, commandPaletteOpen, selectedEmailId, openComposer, closeComposer, setEmail, setFolder, toggleCommandPalette, toggleShortcuts])
}

export function ShortcutsOverlay() {
  const open = useAppStore((s) => s.shortcutsOverlayOpen)
  const toggle = useAppStore((s) => s.toggleShortcuts)

  if (!open) return null

  const shortcuts = [
    { key: 'C', desc: 'Compose new email' },
    { key: 'R', desc: 'Reply to selected email' },
    { key: 'A', desc: 'Reply all' },
    { key: 'F', desc: 'Forward' },
    { key: 'E', desc: 'Archive email' },
    { key: 'S', desc: 'Star email' },
    { key: '#', desc: 'Delete / Move to trash' },
    { key: 'U', desc: 'Toggle read/unread' },
    { key: 'J', desc: 'Next email' },
    { key: 'K', desc: 'Previous email' },
    { key: 'G then I', desc: 'Go to Inbox' },
    { key: 'G then S', desc: 'Go to Sent' },
    { key: '/', desc: 'Focus search' },
    { key: '⌘ K', desc: 'Command palette' },
    { key: '?', desc: 'Show shortcuts' },
    { key: 'Esc', desc: 'Close modals' },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 500,
      }}
      onClick={toggle}
    >
      <div
        className="glass-card"
        style={{ padding: 28, minWidth: 360, maxWidth: 440, animation: 'fadeIn 0.2s var(--ease-out)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 600 }}>⌨️ Keyboard Shortcuts</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shortcuts.map(({ key, desc }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc}</span>
              <kbd style={{
                padding: '2px 8px', background: 'var(--bg-overlay)',
                border: '1px solid var(--border-hover)',
                borderRadius: 5, fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--text-primary)',
              }}>{key}</kbd>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={toggle} style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}>
          Close
        </button>
      </div>
    </div>
  )
}
