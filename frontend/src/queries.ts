// TanStack Query hooks — all server state lives here
// Pattern: react-state-management, cc-skill-backend-patterns

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

const API_BASE = '/api'

// ── Types ─────────────────────────────────────────────────────

export interface Account {
  id: string
  name: string
  domain: string
  from_name: string
  webhook_secret: string
  auto_reply_enabled: number
  ai_system_prompt: string
  ai_model: string
  email_count: number
  created_at: string
}

export interface Email {
  id: string
  account_id: string
  thread_id: string
  message_id: string | null
  folder: string
  direction: 'inbound' | 'outbound'
  sender_name: string | null
  sender_email: string
  recipient_to: string
  subject: string | null
  body_html: string | null
  body_text: string | null
  read_status: number
  delivery_status: string
  created_at: string
  attachment_count?: number
}

export interface Attachment {
  id: string
  filename: string
  content_type: string | null
  size_bytes: number | null
}

// ── API helper ────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
    ...init,
  })

  if (res.status === 401) {
    // Session expired — reload to trigger redirect to /login (only if not already on /login)
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  const data = await res.json() as { success: boolean; data?: T; error?: string }
  if (!data.success) throw new Error(data.error ?? 'API error')
  return data.data as T
}

// ── Accounts ──────────────────────────────────────────────────

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiFetch<Account[]>('/admin/accounts'),
    staleTime: 30_000,
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      domain: string
      fromName: string
      resendApiKey: string
      aiSystemPrompt?: string
      autoReplyEnabled?: boolean
      aiModel?: string
    }) =>
      apiFetch<{
        id: string
        webhookUrl: string
        webhookSecret: string
        maskedApiKey: string
      }>('/admin/accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string
      name?: string
      fromName?: string
      resendApiKey?: string
      aiSystemPrompt?: string
      autoReplyEnabled?: boolean
      aiModel?: string
    }) =>
      apiFetch(`/admin/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/accounts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

// ── Emails ────────────────────────────────────────────────────

export function useEmails(
  accountId: string | null,
  folder: string,
  refetchInterval = 30_000
) {
  return useQuery({
    queryKey: ['emails', accountId, folder],
    queryFn: () =>
      apiFetch<Email[]>(`/emails?accountId=${accountId}&folder=${folder}`),
    enabled: !!accountId,
    refetchInterval,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  })
}

export function useEmail(emailId: string | null) {
  return useQuery({
    queryKey: ['email', emailId],
    queryFn: () => apiFetch<Email & { attachments: Attachment[] }>(`/emails/${emailId}`),
    enabled: !!emailId,
    staleTime: 60_000,
  })
}

export function useSearchEmails(accountId: string | null, query: string) {
  return useQuery({
    queryKey: ['search', accountId, query],
    queryFn: () =>
      apiFetch<Email[]>(`/emails/search?accountId=${accountId}&q=${encodeURIComponent(query)}`),
    enabled: !!accountId && query.length > 2,
    staleTime: 5_000,
  })
}

// ── Mutations ─────────────────────────────────────────────────

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ emailId, read }: { emailId: string; read: boolean }) =>
      apiFetch(`/emails/${emailId}/read`, {
        method: 'PUT',
        body: JSON.stringify({ read }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
    },
  })
}

export function useMoveFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ emailId, folder }: { emailId: string; folder: string }) =>
      apiFetch(`/emails/${emailId}/folder`, {
        method: 'PUT',
        body: JSON.stringify({ folder }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
    },
  })
}

export function useDeleteEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (emailId: string) =>
      apiFetch(`/emails/${emailId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
    },
  })
}

export function useSendEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      accountId: string
      to: string[]
      cc?: string[]
      subject: string
      html: string
      text?: string
      replyToEmailId?: string
    }) => apiFetch('/send', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
    },
  })
}

// ── AI ────────────────────────────────────────────────────────

export function useAIDraftReply(emailId: string | null) {
  return useQuery({
    queryKey: ['ai-draft', emailId],
    queryFn: () =>
      apiFetch<{ draft: string }>(`/ai/draft-reply/${emailId}`, { method: 'POST' }),
    enabled: false, // Only fetches when explicitly triggered via refetch()
  })
}

export function useAISummarize() {
  return useMutation({
    mutationFn: (threadId: string) =>
      apiFetch<{ summary: string }>(`/ai/summarize/${threadId}`, { method: 'POST' }),
  })
}

export function useAIAdjustTone() {
  return useMutation({
    mutationFn: (payload: { text: string; tone: 'formal' | 'casual' | 'concise' }) =>
      apiFetch<{ result: string }>('/ai/adjust-tone', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  })
}

// ── Auth ──────────────────────────────────────────────────────

export function useAuth() {
  return useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<{ username: string }>('/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (creds: { username: string; password: string }) =>
      apiFetch<{ username: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(creds),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-me'] })
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear()
      window.location.href = '/login'
    },
  })
}
