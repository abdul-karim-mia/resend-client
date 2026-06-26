import { useState, useRef, useEffect } from 'react'
import { useLabels, useCreateLabel, useAssignLabel, type EmailLabelRef } from '../queries'

const PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']

/**
 * Inline label manager for an email. Shows current label chips with remove (×),
 * plus a "+ Label" popover to toggle existing labels or create a new one.
 */
export default function LabelPicker({
  accountId, emailId, current,
}: {
  accountId: string
  emailId: string
  current: EmailLabelRef[]
}) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const { data: labels = [] } = useLabels(accountId)
  const createLabel = useCreateLabel(accountId)
  const assign = useAssignLabel()

  const currentIds = new Set(current.map((l) => l.id))

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (labelId: string) => {
    assign.mutate({ labelId, emailId, assign: !currentIds.has(labelId) })
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const color = PALETTE[labels.length % PALETTE.length]
    const created = await createLabel.mutateAsync({ name, color })
    setNewName('')
    if (created?.id) assign.mutate({ labelId: created.id, emailId, assign: true })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {current.map((l) => (
        <span
          key={l.id}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            fontSize: 11, fontWeight: 500, color: '#fff',
            background: l.color,
          }}
        >
          {l.name}
          <button
            onClick={() => toggle(l.id)}
            aria-label={`Remove label ${l.name}`}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, opacity: 0.85 }}
          >×</button>
        </span>
      ))}

      <div style={{ position: 'relative' }} ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="btn btn-ghost"
          style={{ fontSize: 11, padding: '3px 8px', gap: 4 }}
          aria-haspopup="true"
          aria-expanded={open}
        >
          🏷️ Label
        </button>

        {open && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
              minWidth: 220, background: 'var(--bg-overlay)',
              border: '1px solid var(--border-hover)', borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)', padding: 8,
            }}
          >
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {labels.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px' }}>
                  No labels yet — create one below.
                </p>
              )}
              {labels.map((l) => {
                const checked = currentIds.has(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                      background: checked ? 'var(--accent-subtle)' : 'none', border: 'none',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 12, color: 'var(--text-primary)', textAlign: 'left', width: '100%',
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                    {checked && <span style={{ color: 'var(--accent-light)' }}>✓</span>}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="New label…"
                style={{
                  flex: 1, padding: '5px 8px', fontSize: 12, fontFamily: 'inherit',
                  background: 'var(--bg-base)', color: 'var(--text-primary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none',
                }}
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="btn btn-primary"
                style={{ fontSize: 11, padding: '5px 10px', opacity: newName.trim() ? 1 : 0.5 }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
