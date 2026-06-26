import { usePreferences, useUpdatePreferences } from '../../queries'
import { SettingsSection, SettingRow, Select } from './primitives'

// A pragmatic subset of common IANA timezones + "auto" (browser-detected).
const TIMEZONES = [
  'auto', 'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Dhaka', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
]

export default function GeneralSettings() {
  const { data: prefs } = usePreferences()
  const update = useUpdatePreferences()
  if (!prefs) return null

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SettingsSection title="Regional" description="Language and time settings for your account.">
        <SettingRow
          label="Language"
          hint="Interface language."
          control={
            <Select
              ariaLabel="Language"
              value={prefs.language}
              onChange={(v) => update.mutate({ language: v })}
              options={[
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
                { value: 'fr', label: 'Français' },
                { value: 'de', label: 'Deutsch' },
              ]}
            />
          }
        />
        <SettingRow
          label="Timezone"
          hint={prefs.timezone === 'auto' ? `Auto-detected: ${browserTz}` : 'Used to display email timestamps.'}
          control={
            <Select
              ariaLabel="Timezone"
              value={prefs.timezone}
              onChange={(v) => update.mutate({ timezone: v })}
              options={TIMEZONES.map((tz) => ({ value: tz, label: tz === 'auto' ? 'Automatic' : tz }))}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Email behavior" description="Defaults applied when reading and replying.">
        <SettingRow
          label="Default reply action"
          hint="Which reply mode the R shortcut and Reply button use."
          control={
            <Select
              ariaLabel="Default reply action"
              value={prefs.defaultReplyBehavior}
              onChange={(v) => update.mutate({ defaultReplyBehavior: v })}
              options={[
                { value: 'reply', label: 'Reply' },
                { value: 'replyAll', label: 'Reply All' },
              ]}
            />
          }
        />
        <SettingRow
          label="Undo send window"
          hint="Seconds to cancel a send after clicking Send. 0 disables."
          control={
            <Select
              ariaLabel="Undo send window"
              value={String(prefs.sendUndoSeconds)}
              onChange={(v) => update.mutate({ sendUndoSeconds: Number(v) })}
              options={[
                { value: '0', label: 'Off' },
                { value: '5', label: '5 seconds' },
                { value: '10', label: '10 seconds' },
                { value: '20', label: '20 seconds' },
                { value: '30', label: '30 seconds' },
              ]}
            />
          }
        />
      </SettingsSection>
    </div>
  )
}
