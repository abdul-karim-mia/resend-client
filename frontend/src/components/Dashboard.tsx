import { useState } from 'react'
import { useAppStore } from '../store'
import { useAnalytics, type Analytics } from '../queries'

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

export default function Dashboard() {
  const accountId = useAppStore((s) => s.selectedAccountId)
  const [days, setDays] = useState(30)
  const { data, isLoading } = useAnalytics(accountId, days)

  return (
    <main className="reading-pane active" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', width: '100%', padding: '28px 24px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Analytics</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Email activity and deliverability.</p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                style={{
                  padding: '6px 12px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                  background: days === r.days ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                  color: days === r.days ? 'var(--accent-light)' : 'var(--text-secondary)',
                  border: `1px solid ${days === r.days ? 'var(--border-accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {!accountId && <Empty text="Select an account to view analytics." />}
        {accountId && isLoading && <Empty text="Crunching numbers…" />}
        {accountId && data && <DashboardBody data={data} />}
      </div>
    </main>
  )
}

function DashboardBody({ data }: { data: Analytics }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <Kpi label="Sent" value={data.totals.sent} />
        <Kpi label="Received" value={data.totals.received} />
        <Kpi label="Delivery rate" value={`${data.rates.deliveryRate}%`} tone="good" />
        <Kpi label="Open rate" value={`${data.rates.openRate}%`} tone="accent" />
        <Kpi label="Bounce rate" value={`${data.rates.bounceRate}%`} tone={data.rates.bounceRate > 5 ? 'bad' : 'muted'} />
      </div>

      {/* Activity chart */}
      <Card title="Daily activity">
        <ActivityChart daily={data.daily} />
      </Card>

      {/* Top senders / recipients */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <Card title="Top senders">
          <RankedList rows={data.topSenders.map((s) => ({ label: s.name, sub: s.email, count: s.count }))} empty="No inbound mail yet." />
        </Card>
        <Card title="Top recipients">
          <RankedList rows={data.topRecipients.map((r) => ({ label: r.email, count: r.count }))} empty="No sent mail yet." />
        </Card>
      </div>
    </div>
  )
}

function ActivityChart({ daily }: { daily: Analytics['daily'] }) {
  if (daily.length === 0) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No activity in this period.</p>
  const max = Math.max(1, ...daily.map((d) => Math.max(d.sent, d.received)))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, overflowX: 'auto', paddingTop: 8 }}>
      {daily.map((d) => (
        <div key={d.day} title={`${d.day}\nSent: ${d.sent}  Received: ${d.received}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 14, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 140 }}>
            <div style={{ width: 6, height: `${(d.received / max) * 100}%`, background: 'var(--info)', borderRadius: '2px 2px 0 0', minHeight: d.received ? 2 : 0 }} />
            <div style={{ width: 6, height: `${(d.sent / max) * 100}%`, background: 'var(--accent)', borderRadius: '2px 2px 0 0', minHeight: d.sent ? 2 : 0 }} />
          </div>
        </div>
      ))}
      <div style={{ position: 'sticky', right: 0 }} />
    </div>
  )
}

function RankedList({ rows, empty }: { rows: Array<{ label: string; sub?: string; count: number }>; empty: string }) {
  if (rows.length === 0) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{empty}</p>
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
            <div style={{ height: 4, background: 'var(--bg-overlay)', borderRadius: 2, marginTop: 4 }}>
              <div style={{ height: '100%', width: `${(r.count / max) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{r.count}</span>
        </div>
      ))}
    </div>
  )
}

function Kpi({ label, value, tone = 'muted' }: { label: string; value: string | number; tone?: 'good' | 'bad' | 'accent' | 'muted' }) {
  const color = tone === 'good' ? 'var(--success)' : tone === 'bad' ? 'var(--error)' : tone === 'accent' ? 'var(--accent-light)' : 'var(--text-primary)'
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, marginTop: 6, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>{text}</p>
}
