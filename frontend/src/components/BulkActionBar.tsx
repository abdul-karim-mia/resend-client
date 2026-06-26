import { useAppStore } from '../store'
import { useBulkAction } from '../queries'

/**
 * Floating action bar shown when one or more emails are selected.
 * Applies a single action to all selected ids via the /emails/bulk endpoint.
 */
export default function BulkActionBar() {
  const selectedIds = useAppStore((s) => s.selectedIds)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const addToast = useAppStore((s) => s.addToast)
  const bulk = useBulkAction()

  if (selectedIds.length === 0) return null

  const run = async (
    action: 'read' | 'unread' | 'folder' | 'star' | 'unstar' | 'delete',
    value?: string,
    label?: string,
  ) => {
    const ids = [...selectedIds]
    await bulk.mutateAsync({ ids, action, value })
    addToast(`${label ?? 'Updated'} ${ids.length} email${ids.length > 1 ? 's' : ''}`, 'success')
    clearSelection()
  }

  const btn: React.CSSProperties = {
    fontSize: 12, gap: 6, padding: '6px 10px', whiteSpace: 'nowrap',
  }

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 60, display: 'flex', alignItems: 'center', gap: 4,
        padding: '8px 10px', borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-overlay)', border: '1px solid var(--border-hover)',
        boxShadow: 'var(--shadow-lg)', backdropFilter: 'var(--glass-blur)',
        maxWidth: 'calc(100% - 24px)', overflowX: 'auto',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, padding: '0 6px', color: 'var(--accent-light)' }}>
        {selectedIds.length} selected
      </span>
      <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
      <button className="btn btn-ghost" style={btn} onClick={() => run('read', undefined, 'Marked read')}>✓ Read</button>
      <button className="btn btn-ghost" style={btn} onClick={() => run('unread', undefined, 'Marked unread')}>● Unread</button>
      <button className="btn btn-ghost" style={btn} onClick={() => run('star', undefined, 'Starred')}>⭐ Star</button>
      <button className="btn btn-ghost" style={btn} onClick={() => run('folder', 'archive', 'Archived')}>📦 Archive</button>
      <button className="btn btn-ghost" style={btn} onClick={() => run('folder', 'spam', 'Marked spam')}>⚠️ Spam</button>
      <button className="btn btn-ghost" style={btn} onClick={() => run('folder', 'trash', 'Trashed')}>🗑️ Trash</button>
      <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
      <button className="btn btn-ghost" style={btn} onClick={clearSelection} aria-label="Clear selection">✕</button>
    </div>
  )
}
