import React, { useState } from 'react'
import { useLogin, LoginError } from '../queries'
import { useAppStore } from '../store'

export default function LoginPage() {
  const login = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [requiresTotp, setRequiresTotp] = useState(false)
  const addToast = useAppStore((s) => s.addToast)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login.mutateAsync({ username, password, totpCode: requiresTotp ? totpCode : undefined })
      window.location.href = '/'
    } catch (err) {
      if (err instanceof LoginError && err.requiresTotp) {
        setRequiresTotp(true)
        addToast(totpCode ? 'Invalid two-factor code' : 'Enter your two-factor code', 'info')
      } else {
        addToast('Invalid username or password', 'error')
      }
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="22,6 12,13 2,6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>resend-client</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Sign in to your inbox
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label
              htmlFor="login-username"
              style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}
            >
              Username
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="admin"
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {requiresTotp && (
            <div>
              <label
                htmlFor="login-totp"
                style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}
              >
                Two-factor code
              </label>
              <input
                id="login-totp"
                type="text"
                inputMode="numeric"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input"
                placeholder="123456"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={login.isPending || !username || !password || (requiresTotp && totpCode.length !== 6)}
            style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: 14, marginTop: 8 }}
          >
            {login.isPending ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                    display: 'inline-block',
                  }}
                />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
          Self-hosted on Cloudflare Workers ·{' '}
          <a
            href="https://github.com/abdul-karim-mia/resend-client"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-light)' }}
          >
            resend-client
          </a>
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
