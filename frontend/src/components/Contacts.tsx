import { useState } from 'react'
import { useAppStore } from '../store'
import { useContacts, useUpdateContact, useDeleteContact, type Contact } from '../queries'

export default function Contacts() {
  const accountId = useAppStore((s) => s.selectedAccountId)
  const openComposer = useAppStore((s) => s.openComposer)
  const [q, setQ] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const { data: contacts = [], isLoading } = useContacts(accountId, { q, favorites: favoritesOnly })

  return (
    <main className="reading-pane active" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', width: '100%', padding: '28px 24px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Contacts</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Auto-collected from your conversations.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contacts…"
            style={{
              flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', outline: 'none',
            }}
          />
          <button
            onClick={() => setFavoritesOnly((f) => !f)}
            style={{
              padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              background: favoritesOnly ? 'var(--accent-subtle)' : 'var(--bg-surface)',
              color: favoritesOnly ? 'var(--accent-light)' : 'var(--text-secondary)',
              border: `1px solid ${favoritesOnly ? 'var(--border-accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
            }}
          >
            ⭐ Favorites
          </button>
        </div>

        {!accountId && <p style={empty}>Select an account to view contacts.</p>}
        {accountId && isLoading && <p style={empty}>Loading contacts…</p>}
        {accountId && !isLoading && contacts.length === 0 && (
          <p style={empty}>No contacts {q ? 'match your search' : 'yet'}.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contacts.map((ct) => (
            <ContactCard key={ct.id} contact={ct} onCompose={() => openComposer()} />
          ))}
        </div>
      </div>
    </main>
  )
}

function ContactCard({ contact, onCompose }: { contact: Contact; onCompose: () => void }) {
  const update = useUpdateContact()
  const del = useDeleteContact()
  const addToast = useAppStore((s) => s.addToast)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(contact.notes ?? '')

  const display = contact.name || contact.email
  const initial = display.slice(0, 1).toUpperCase()
  const hue = (contact.email.charCodeAt(0) * 17) % 360

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: `hsl(${hue}deg 55% 40%)`, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
        }}>{initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {display}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {contact.email} · {contact.contact_count} interaction{contact.contact_count === 1 ? '' : 's'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={() => update.mutate({ id: contact.id, isFavorite: contact.is_favorite !== 1 })}
            title={contact.is_favorite === 1 ? 'Unfavorite' : 'Favorite'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, filter: contact.is_favorite === 1 ? 'none' : 'grayscale(1) opacity(0.5)' }}
          >⭐</button>
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={onCompose}>✉️ Email</button>
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setEditingNotes((e) => !e)}>📝 Notes</button>
          <button
            className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--error)' }}
            onClick={() => { del.mutate(contact.id); addToast('Contact removed', 'success') }}
          >Delete</button>
        </div>
      </div>

      {(editingNotes || contact.notes) && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {editingNotes ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add a note about this contact…"
                style={{
                  flex: 1, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', resize: 'vertical',
                  background: 'var(--bg-base)', color: 'var(--text-primary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none',
                }}
              />
              <button
                className="btn btn-primary" style={{ fontSize: 11 }}
                onClick={() => { update.mutate({ id: contact.id, notes }); setEditingNotes(false); addToast('Note saved', 'success') }}
              >Save</button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{contact.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

const empty: React.CSSProperties = { fontSize: 13, color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }
