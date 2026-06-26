// Zustand store — client UI state (NOT server data, that's TanStack Query)
// Pattern: cc-skill-backend-patterns + react-state-management skill

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface AppState {
  // Selected email/account
  selectedAccountId: string | null
  selectedEmailId: string | null
  selectedFolder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive' | 'spam' | 'starred' | 'scheduled'
  emailListPage: number
  searchQuery: string
  isSearching: boolean
  selectedIds: string[]

  // UI state
  composerOpen: boolean
  composerReplyToId: string | null
  commandPaletteOpen: boolean
  shortcutsOverlayOpen: boolean
  sidebarOpen: boolean // Mobile

  // Toasts
  toasts: Toast[]

  // Actions
  setAccount: (id: string) => void
  setEmail: (id: string | null) => void
  setFolder: (folder: AppState['selectedFolder']) => void
  setEmailListPage: (page: number) => void
  setSearchQuery: (query: string) => void
  setIsSearching: (searching: boolean) => void
  toggleSelect: (id: string) => void
  setSelection: (ids: string[]) => void
  clearSelection: () => void
  openComposer: (replyToId?: string) => void
  closeComposer: () => void
  toggleCommandPalette: () => void
  toggleShortcuts: () => void
  toggleSidebar: () => void
  addToast: (message: string, type: Toast['type'], action?: Toast['action'], duration?: number) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      selectedAccountId: null,
      selectedEmailId: null,
      selectedFolder: 'inbox',
      emailListPage: 1,
      searchQuery: '',
      isSearching: false,
      selectedIds: [],
      composerOpen: false,
      composerReplyToId: null,
      commandPaletteOpen: false,
      shortcutsOverlayOpen: false,
      sidebarOpen: false,
      toasts: [],

      setAccount: (id) => set({ selectedAccountId: id, selectedEmailId: null, emailListPage: 1, searchQuery: '', isSearching: false, selectedIds: [] }),
      setEmail: (id) => set({ selectedEmailId: id }),
      setFolder: (folder) => set({ selectedFolder: folder, selectedEmailId: null, emailListPage: 1, searchQuery: '', isSearching: false, selectedIds: [] }),
      setEmailListPage: (page) => set({ emailListPage: page, selectedEmailId: null, selectedIds: [] }),
      setSearchQuery: (query) => set({ searchQuery: query, emailListPage: 1 }),
      setIsSearching: (searching) => set({ isSearching: searching }),
      toggleSelect: (id) => set((s) => ({
        selectedIds: s.selectedIds.includes(id)
          ? s.selectedIds.filter((x) => x !== id)
          : [...s.selectedIds, id],
      })),
      setSelection: (ids) => set({ selectedIds: ids }),
      clearSelection: () => set({ selectedIds: [] }),
      openComposer: (replyToId) =>
        set({ composerOpen: true, composerReplyToId: replyToId ?? null }),
      closeComposer: () => set({ composerOpen: false, composerReplyToId: null }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      toggleShortcuts: () => set((s) => ({ shortcutsOverlayOpen: !s.shortcutsOverlayOpen })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      addToast: (message, type, action, duration = 4000) => {
        const id = crypto.randomUUID()
        set((s) => ({ toasts: [...s.toasts, { id, message, type, action, duration }] }))
        setTimeout(() => get().removeToast(id), duration)
      },
      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    { name: 'resend-client' }
  )
)
