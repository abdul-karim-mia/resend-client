import { useState } from 'react'
import { useAISummarize, useAIActionItems, useAICategorize } from '../queries'

const PRIORITY_COLOR: Record<string, string> = {
  high: 'var(--error)', normal: 'var(--accent-light)', low: 'var(--text-muted)',
}

/**
 * On-demand AI insights for the open email: one-line summary, extracted action
 * items, and priority/category classification. Each runs only when requested to
 * avoid unnecessary model calls.
 */
export default function AIInsights({ emailId, threadId }: { emailId: string; threadId: string }) {
  const summarize = useAISummarize()
  const actionItems = useAIActionItems()
  const categorize = useAICategorize()

  const [summary, setSummary] = useState<string | null>(null)
  const [items, setItems] = useState<string[] | null>(null)
  const [cat, setCat] = useState<{ priority: string; category: string; reason: string } | null>(null)

  const run = async (which: 'summary' | 'items' | 'cat') => {
    try {
      if (which === 'summary') setSummary((await summarize.mutateAsync(threadId)).summary)
      if (which === 'items') setItems((await actionItems.mutateAsync(emailId)).items)
      if (which === 'cat') setCat(await categorize.mutateAsync(emailId))
    } catch { /* errors surface via disabled state; keep UI quiet */ }
  }

  return (
    <div style={{
      borderTop: '1px solid var(--border)', padding: '12px 24px',
      display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ✨ AI insights
        </span>
        <button className="btn btn-ghost" style={chip} onClick={() => run('summary')} disabled={summarize.isPending}>
          {summarize.isPending ? 'Summarizing…' : 'Summarize'}
        </button>
        <button className="btn btn-ghost" style={chip} onClick={() => run('items')} disabled={actionItems.isPending}>
          {actionItems.isPending ? 'Extracting…' : 'Action items'}
        </button>
        <button className="btn btn-ghost" style={chip} onClick={() => run('cat')} disabled={categorize.isPending}>
          {categorize.isPending ? 'Analyzing…' : 'Priority & category'}
        </button>
      </div>

      {summary && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Summary: </strong>{summary}
        </p>
      )}

      {cat && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{
            fontWeight: 700, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em',
            color: PRIORITY_COLOR[cat.priority] ?? 'var(--text-muted)',
            padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-overlay)',
          }}>{cat.priority} priority</span>
          <span style={{
            padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-subtle)',
            color: 'var(--accent-light)', textTransform: 'capitalize', fontWeight: 600,
          }}>{cat.category}</span>
          {cat.reason && <span style={{ color: 'var(--text-muted)' }}>· {cat.reason}</span>}
        </div>
      )}

      {items && (
        items.length > 0 ? (
          <ul style={{ margin: '0 0 0 18px', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No action items found.</p>
        )
      )}
    </div>
  )
}

const chip: React.CSSProperties = { fontSize: 11, padding: '4px 10px' }
