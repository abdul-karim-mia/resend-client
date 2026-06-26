// ============================================================
// D1 Idempotent Migration System
// ------------------------------------------------------------
// Runs on first request (after ensureDbInitialized creates base tables).
// Every migration is additive and backward-compatible:
//   - New columns are added only if missing (PRAGMA table_info guard)
//   - New tables use CREATE TABLE IF NOT EXISTS
//
// This is the source of truth for schema beyond the original base tables.
// Keep worker/schema.sql in sync for fresh `db:apply` runs.
// ============================================================

/** Columns added to the `contacts` table beyond the original base schema. */
const CONTACT_COLUMN_ADDITIONS: Array<{ name: string; ddl: string }> = [
  { name: 'notes', ddl: `ALTER TABLE contacts ADD COLUMN notes TEXT` },
  { name: 'is_favorite', ddl: `ALTER TABLE contacts ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0` },
  { name: 'contact_count', ddl: `ALTER TABLE contacts ADD COLUMN contact_count INTEGER NOT NULL DEFAULT 0` },
]

/** Columns added to the `emails` table beyond the original base schema. */
const EMAIL_COLUMN_ADDITIONS: Array<{ name: string; ddl: string }> = [
  { name: 'is_starred', ddl: `ALTER TABLE emails ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0` },
  { name: 'is_pinned', ddl: `ALTER TABLE emails ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0` },
  { name: 'snoozed_until', ddl: `ALTER TABLE emails ADD COLUMN snoozed_until DATETIME` },
  { name: 'scheduled_at', ddl: `ALTER TABLE emails ADD COLUMN scheduled_at DATETIME` },
  { name: 'reply_to', ddl: `ALTER TABLE emails ADD COLUMN reply_to TEXT` },
  { name: 'raw_headers', ddl: `ALTER TABLE emails ADD COLUMN raw_headers TEXT` },
]

/** Standalone tables introduced by later feature work. */
const NEW_TABLES: string[] = [
  // Labels / tags
  `CREATE TABLE IF NOT EXISTS labels (
      id          TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT '#6366f1',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, name)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_labels_account ON labels(account_id)`,

  // Email ↔ Label junction (many-to-many)
  `CREATE TABLE IF NOT EXISTS email_labels (
      email_id    TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      label_id    TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (email_id, label_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_labels_label ON email_labels(label_id)`,

  // Signatures
  `CREATE TABLE IF NOT EXISTS signatures (
      id          TEXT PRIMARY KEY,
      account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      body_html   TEXT NOT NULL DEFAULT '',
      is_default  INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_signatures_account ON signatures(account_id)`,

  // Email delivery / engagement events — powers the developer Event Timeline
  // and the Webhook Inspector (raw payload stored as JSON).
  `CREATE TABLE IF NOT EXISTS email_events (
      id            TEXT PRIMARY KEY,
      account_id    TEXT NOT NULL,
      email_id      TEXT,
      resend_email_id TEXT,
      type          TEXT NOT NULL,
      payload       TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_events_email ON email_events(email_id, created_at ASC)`,
  `CREATE INDEX IF NOT EXISTS idx_email_events_account ON email_events(account_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_email_events_resend ON email_events(resend_email_id)`,

  // Audit log — security/observability trail
  `CREATE TABLE IF NOT EXISTS audit_logs (
      id          TEXT PRIMARY KEY,
      action      TEXT NOT NULL,
      detail      TEXT,
      actor       TEXT,
      ip          TEXT,
      user_agent  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)`,

  // User preferences — simple key/value store (single-admin app)
  `CREATE TABLE IF NOT EXISTS user_preferences (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // Sessions — login history & active session management
  `CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      username    TEXT NOT NULL,
      ip          TEXT,
      user_agent  TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen   DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked     INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username, created_at DESC)`,
]

/** Indexes that depend on newly-added columns (created after columns exist). */
const COLUMN_DEPENDENT_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_emails_starred ON emails(account_id, is_starred) WHERE is_starred = 1`,
  `CREATE INDEX IF NOT EXISTS idx_emails_snoozed ON emails(snoozed_until) WHERE snoozed_until IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_emails_scheduled ON emails(scheduled_at) WHERE scheduled_at IS NOT NULL`,
]

/**
 * Apply all additive migrations. Safe to run on every cold start — each step
 * is guarded so re-runs are no-ops.
 */
export async function runMigrations(db: D1Database): Promise<void> {
  try {
    // 1. Add missing columns to `emails`
    const existing = await getColumns(db, 'emails')
    for (const col of EMAIL_COLUMN_ADDITIONS) {
      if (!existing.has(col.name)) {
        try {
          await db.prepare(col.ddl).run()
        } catch (err) {
          // Tolerate races / "duplicate column" on concurrent cold starts
          console.warn(`[migrations] add column ${col.name}:`, (err as Error).message)
        }
      }
    }

    // 1b. Add missing columns to `contacts`
    const contactCols = await getColumns(db, 'contacts')
    for (const col of CONTACT_COLUMN_ADDITIONS) {
      if (!contactCols.has(col.name)) {
        try {
          await db.prepare(col.ddl).run()
        } catch (err) {
          console.warn(`[migrations] add contacts column ${col.name}:`, (err as Error).message)
        }
      }
    }

    // 2. Create new tables + their indexes
    for (const stmt of NEW_TABLES) {
      await db.prepare(stmt).run()
    }

    // 3. Create indexes that depend on the new columns
    for (const stmt of COLUMN_DEPENDENT_INDEXES) {
      try {
        await db.prepare(stmt).run()
      } catch (err) {
        console.warn('[migrations] index:', (err as Error).message)
      }
    }
  } catch (err) {
    console.error('[migrations] Failed:', (err as Error).message, (err as Error).stack)
  }
}

/** Return the set of column names for a table via PRAGMA table_info. */
async function getColumns(db: D1Database, table: string): Promise<Set<string>> {
  try {
    const { results } = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()
    return new Set(results.map((r) => r.name))
  } catch {
    return new Set()
  }
}
