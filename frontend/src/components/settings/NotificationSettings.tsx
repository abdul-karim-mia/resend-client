import { usePreferences, useUpdatePreferences } from '../../queries'
import { useAppStore } from '../../store'
import { SettingsSection, SettingRow, Toggle } from './primitives'

export default function NotificationSettings() {
  const { data: prefs } = usePreferences()
  const update = useUpdatePreferences()
  const addToast = useAppStore((s) => s.addToast)
  if (!prefs) return null

  // Requesting desktop permission is gated behind enabling the toggle.
  const enableDesktop = async (on: boolean) => {
    if (on && 'Notification' in window && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        addToast('Desktop notifications were blocked by your browser', 'error')
        return
      }
    }
    update.mutate({ notifyDesktop: on })
  }

  const supported = 'Notification' in window

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SettingsSection title="Notifications" description="Choose how you're alerted about new email.">
        <SettingRow
          label="Desktop notifications"
          hint={supported ? 'Show a system notification when new mail arrives.' : 'Not supported in this browser.'}
          control={
            <Toggle
              ariaLabel="Desktop notifications"
              checked={!!prefs.notifyDesktop}
              onChange={enableDesktop}
            />
          }
        />
        <SettingRow
          label="Sound"
          hint="Play a subtle chime on new email."
          control={
            <Toggle
              ariaLabel="Notification sound"
              checked={!!prefs.notifySound}
              onChange={(v) => update.mutate({ notifySound: v })}
            />
          }
        />
        <SettingRow
          label="Unread badge"
          hint="Show unread counts on folders and the browser tab."
          control={
            <Toggle
              ariaLabel="Unread badge"
              checked={!!prefs.notifyBadge}
              onChange={(v) => update.mutate({ notifyBadge: v })}
            />
          }
        />
      </SettingsSection>
    </div>
  )
}
