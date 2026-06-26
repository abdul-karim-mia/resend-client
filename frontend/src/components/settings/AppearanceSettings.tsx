import { usePreferences, useUpdatePreferences } from '../../queries'
import type { ThemeSetting } from '../../theme'
import { SettingsSection, SettingRow, Select } from './primitives'

const THEME_OPTIONS: Array<{ value: ThemeSetting; label: string; preview: string }> = [
  { value: 'light', label: 'Light', preview: '#f7f8fa' },
  { value: 'dark', label: 'Dark', preview: '#0a0c10' },
  { value: 'system', label: 'System', preview: 'linear-gradient(135deg,#0a0c10 50%,#f7f8fa 50%)' },
]

export default function AppearanceSettings() {
  const { data: prefs } = usePreferences()
  const update = useUpdatePreferences()
  if (!prefs) return null

  const theme = prefs.theme

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SettingsSection title="Theme" description="Choose how resend-client looks. System follows your operating system.">
        <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => update.mutate({ theme: opt.value })}
                aria-pressed={active}
                style={{
                  flex: 1, maxWidth: 160, cursor: 'pointer', padding: 0,
                  background: 'transparent', border: 'none',
                  display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
                }}
              >
                <div style={{
                  width: '100%', height: 72, borderRadius: 'var(--radius-md)',
                  background: opt.preview,
                  border: active ? '2px solid var(--accent)' : '2px solid var(--border)',
                  boxShadow: active ? 'var(--shadow-glow)' : 'none',
                  transition: 'all var(--duration-fast)',
                }} />
                <span style={{
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                }}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Display" description="Adjust layout density and date formatting.">
        <SettingRow
          label="Density"
          hint="Compact reduces padding to fit more on screen."
          control={
            <Select
              ariaLabel="Density"
              value={prefs.density}
              onChange={(v) => update.mutate({ density: v })}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          }
        />
        <SettingRow
          label="Date format"
          hint="How timestamps are shown in lists and headers."
          control={
            <Select
              ariaLabel="Date format"
              value={prefs.dateFormat}
              onChange={(v) => update.mutate({ dateFormat: v })}
              options={[
                { value: 'relative', label: 'Relative (2h ago)' },
                { value: 'absolute', label: 'Absolute (Jun 26)' },
              ]}
            />
          }
        />
      </SettingsSection>
    </div>
  )
}
