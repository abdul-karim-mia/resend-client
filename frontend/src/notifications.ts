// New-mail notifications: title/tab badge, desktop notifications, and a sound
// chime — all gated behind user preferences. Detects new inbound mail by
// watching the selected account's inbox unread count.

import { useEffect, useRef } from 'react'
import { useAppStore } from './store'
import { usePreferences, useUnreadCounts, useAuth } from './queries'

const BASE_TITLE = 'resend-client'

/** Play a short two-tone chime via WebAudio (no audio asset needed). */
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    const notes = [880, 1175]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.type = 'sine'
      const start = now + i * 0.12
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.2)
    })
    setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch { /* audio unavailable — ignore */ }
}

export function useNotifications() {
  const accountId = useAppStore((s) => s.selectedAccountId)
  const setFolder = useAppStore((s) => s.setFolder)
  const { data: auth } = useAuth()
  const { data: prefs } = usePreferences(!!auth)
  const { data: counts } = useUnreadCounts(accountId)

  const prevInbox = useRef<number | null>(null)

  const inboxUnread = counts?.inbox ?? 0

  // Title/tab badge.
  useEffect(() => {
    if (prefs?.notifyBadge && inboxUnread > 0) {
      document.title = `(${inboxUnread}) ${BASE_TITLE}`
    } else {
      document.title = BASE_TITLE
    }
  }, [inboxUnread, prefs?.notifyBadge])

  // New-mail detection → desktop + sound.
  useEffect(() => {
    const prev = prevInbox.current
    prevInbox.current = inboxUnread
    if (prev === null) return // first observation — establish baseline only
    if (inboxUnread <= prev) return // no increase

    const delta = inboxUnread - prev

    if (prefs?.notifySound) playChime()

    if (prefs?.notifyDesktop && 'Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(`${delta} new email${delta > 1 ? 's' : ''}`, {
        body: 'You have new mail in your inbox.',
        icon: '/favicon.ico',
        tag: 'resend-client-newmail',
      })
      n.onclick = () => {
        window.focus()
        setFolder('inbox')
        n.close()
      }
    }
  }, [inboxUnread, prefs?.notifySound, prefs?.notifyDesktop, setFolder])
}
