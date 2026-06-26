// Theme application — maps the `theme` preference ('light' | 'dark' | 'system')
// to the document's data-theme attribute. "system" follows the OS setting and
// updates live when the OS preference changes.
//
// Default DOM (no data-theme attr) is the original dark design, so we only set
// data-theme="light" when light should be shown, and clear it for dark.

import { useEffect } from 'react'
import { usePreferences } from './queries'

export type ThemeSetting = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'rc-theme'

/** Resolve a theme setting to the concrete mode that should render. */
function resolveMode(setting: ThemeSetting): 'light' | 'dark' {
  if (setting === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return setting
}

/** Apply a concrete mode to the document root. */
function applyMode(mode: 'light' | 'dark') {
  const root = document.documentElement
  if (mode === 'light') root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
  root.style.colorScheme = mode
}

/**
 * Apply the theme as early as possible (before React hydration) using the
 * last-known value from localStorage to avoid a flash of the wrong theme.
 * Call once from main.tsx.
 */
export function initThemeEarly() {
  try {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeSetting | null) ?? 'system'
    applyMode(resolveMode(stored))
  } catch {
    applyMode('dark')
  }
}

/**
 * Hook that keeps the document theme in sync with the user's preference and
 * the OS setting (when 'system'). Mount once near the app root.
 */
export function useApplyTheme() {
  const { data: prefs } = usePreferences()
  const setting = (prefs?.theme as ThemeSetting | undefined) ?? 'system'

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, setting) } catch { /* ignore */ }
    applyMode(resolveMode(setting))

    if (setting !== 'system') return
    // Live-update when the OS theme changes and we're following it.
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => applyMode(resolveMode('system'))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [setting])
}
