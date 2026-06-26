import { useState } from 'react'
import SettingsPanel from '../SettingsPanel'
import AppearanceSettings from './AppearanceSettings'
import GeneralSettings from './GeneralSettings'
import NotificationSettings from './NotificationSettings'

type TabId = 'accounts' | 'general' | 'appearance' | 'notifications'

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'accounts', label: 'Accounts', icon: '👤' },
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
]

/**
 * Tabbed settings container that sits in the main content area beside the
 * sidebar. The "Accounts" tab renders the existing SettingsPanel full-bleed
 * (no functionality lost); preference tabs render in a centered column.
 */
export default function SettingsLayout() {
  const initial = window.location.hash.replace('#', '') as TabId
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === initial) ? initial : 'accounts'
  )

  const selectTab = (id: TabId) => {
    setTab(id)
    history.replaceState(null, '', `/settings#${id}`)
  }

  return (
    <main
      className="reading-pane active"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
    >
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Settings sections"
        style={{
          display: 'flex', gap: 4, padding: '0 16px',
          borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
          flexShrink: 0, flexWrap: 'wrap',
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '12px 14px', fontSize: 13, fontWeight: active ? 600 : 500,
                fontFamily: 'inherit', cursor: 'pointer', background: 'none',
                border: 'none', color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'color var(--duration-fast)',
              }}
            >
              <span aria-hidden>{t.icon}</span> {t.label}
            </button>
          )
        })}
      </div>

      {/* Active panel */}
      {tab === 'accounts' ? (
        // Full-bleed: SettingsPanel is its own two-column layout.
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <SettingsPanel />
        </div>
      ) : (
        <div role="tabpanel" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 64px' }}>
            {tab === 'general' && <GeneralSettings />}
            {tab === 'appearance' && <AppearanceSettings />}
            {tab === 'notifications' && <NotificationSettings />}
          </div>
        </div>
      )}
    </main>
  )
}
