// Shared settings UI primitives — consistent cards, rows, toggles, selects.
// Reused across all settings tabs to keep the look uniform and DRY.
import React from 'react'

export const settingsCard: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
  boxShadow: 'var(--shadow-sm)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  maxWidth: 720,
}

export function SettingsSection({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div style={settingsCard}>
      <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
        {children}
      </div>
    </div>
  )
}

export function SettingRow({ label, hint, control }: {
  label: string
  hint?: string
  control: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  )
}

export function Toggle({ checked, onChange, ariaLabel }: {
  checked: boolean
  onChange: (v: boolean) => void
  ariaLabel: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 'var(--radius-full)',
        background: checked ? 'var(--accent)' : 'var(--bg-overlay)',
        border: '1px solid var(--border)', cursor: 'pointer', position: 'relative',
        transition: 'background var(--duration-fast)', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left var(--duration-fast) var(--ease-out)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

export function Select<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  ariaLabel: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        padding: '6px 10px', fontSize: 13, fontFamily: 'inherit',
        background: 'var(--bg-base)', color: 'var(--text-primary)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        cursor: 'pointer', minWidth: 160,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
