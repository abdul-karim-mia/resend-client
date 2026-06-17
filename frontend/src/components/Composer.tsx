import { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { useDropzone } from 'react-dropzone'
import { useAppStore } from '../store'
import { useSendEmail, useAIAdjustTone } from '../queries'

interface ComposerProps {
  accountId: string
  replyToEmailId?: string | null
}

export default function Composer({ accountId, replyToEmailId }: ComposerProps) {
  const close = useAppStore((s) => s.closeComposer)
  const addToast = useAppStore((s) => s.addToast)
  const sendEmail = useSendEmail()
  const adjustTone = useAIAdjustTone()

  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [showCc, setShowCc] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<Array<{ key: string; filename: string }>>([])
  const [sending, setSending] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Write your email…' }),
    ],
    editorProps: {
      attributes: {
        style: 'min-height: 200px; outline: none; padding: 16px; color: var(--text-primary); font-family: inherit; font-size: 14px; line-height: 1.6;',
      },
    },
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      for (const file of files) {
        // 25MB limit (from file-uploads skill)
        if (file.size > 25 * 1024 * 1024) {
          addToast(`${file.name} exceeds 25MB limit`, 'error')
          continue
        }
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`/api/attachments/upload?accountId=${accountId}`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        })
        const data = await res.json() as { success: boolean; data: { key: string; filename: string } }
        if (data.success) {
          setAttachedFiles((prev) => [...prev, data.data])
        }
      }
    },
  })

  const handleSend = async () => {
    if (!to || !subject || !editor) return
    setSending(true)
    try {
      await sendEmail.mutateAsync({
        accountId,
        to: to.split(',').map((t) => t.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        subject,
        html: editor.getHTML(),
        text: editor.getText(),
        replyToEmailId: replyToEmailId ?? undefined,
      })
      addToast('Email sent', 'success')
      close()
    } catch (e) {
      addToast('Failed to send email', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleAdjustTone = async (tone: 'formal' | 'casual' | 'concise') => {
    if (!editor) return
    const text = editor.getText()
    if (!text.trim()) return
    try {
      const result = await adjustTone.mutateAsync({ text, tone })
      editor.commands.setContent(result.result)
    } catch {
      addToast('Failed to adjust tone', 'error')
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 580,
        maxHeight: '75vh',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-hover)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 200,
        overflow: 'hidden',
        animation: 'slideUp 0.25s var(--ease-spring)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {replyToEmailId ? 'Reply' : 'New Message'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* AI Tone buttons */}
          {['formal', 'casual', 'concise'].map((tone) => (
            <button
              key={tone}
              className="btn btn-ghost"
              style={{ padding: '3px 8px', fontSize: 11 }}
              onClick={() => handleAdjustTone(tone as 'formal' | 'casual' | 'concise')}
              title={`Make ${tone}`}
            >
              {tone === 'formal' ? '🎩' : tone === 'casual' ? '✌️' : '⚡'} {tone}
            </button>
          ))}
          <button className="btn-icon btn" onClick={close} aria-label="Close composer">
            ✕
          </button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24 }}>To</span>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            aria-label="To"
          />
          <button
            onClick={() => setShowCc(!showCc)}
            style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            CC
          </button>
        </div>

        {showCc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24 }}>Cc</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              aria-label="CC"
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24 }}>Subj</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            aria-label="Subject"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 2, padding: '4px 12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {[
          { label: 'B', cmd: () => editor?.chain().focus().toggleBold().run(), title: 'Bold' },
          { label: 'I', cmd: () => editor?.chain().focus().toggleItalic().run(), title: 'Italic' },
          { label: 'U', cmd: () => editor?.chain().focus().toggleUnderline().run(), title: 'Underline' },
          { label: '• List', cmd: () => editor?.chain().focus().toggleBulletList().run(), title: 'Bullet list' },
        ].map(({ label, cmd, title }) => (
          <button key={label} onClick={cmd} className="btn-icon btn" title={title} style={{ fontSize: 12, padding: '3px 7px' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Body — with dropzone */}
      <div
        {...getRootProps()}
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          background: isDragActive ? 'var(--accent-subtle)' : 'transparent',
          transition: 'background 0.2s',
        }}
        onClick={(e) => { e.stopPropagation(); editor?.commands.focus() }}
      >
        <input {...getInputProps()} />
        <EditorContent editor={editor} />
        {isDragActive && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: 'var(--accent-light)', fontWeight: 500, pointerEvents: 'none',
          }}>
            Drop files to attach
          </div>
        )}
      </div>

      {/* Attachments */}
      {attachedFiles.length > 0 && (
        <div style={{ padding: '8px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
          {attachedFiles.map((f) => (
            <span
              key={f.key}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 'var(--radius-full)',
                background: 'var(--bg-overlay)', border: '1px solid var(--border)',
                fontSize: 12, color: 'var(--text-secondary)',
              }}
            >
              📎 {f.filename}
              <button
                onClick={() => setAttachedFiles((prev) => prev.filter((a) => a.key !== f.key))}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderTop: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => {}}>
          📎 Attach
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={close}>Discard</button>
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending || !to || !subject}
          >
            {sending ? 'Sending…' : 'Send ↗'}
          </button>
        </div>
      </div>
    </div>
  )
}
