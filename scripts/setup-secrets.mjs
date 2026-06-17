#!/usr/bin/env node
// Setup script — generates all required Worker secrets
// Run once: node scripts/setup-secrets.js
// Then copy the values into your .dev.vars for local dev
// Or run: pnpm --filter worker wrangler secret put <KEY>

import { randomBytes, createHash } from 'node:crypto'
import { createInterface } from 'node:readline'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((resolve) => rl.question(q, resolve))

console.log('\n🚀 resend-client — Secret Setup\n')

const masterKey = randomBytes(32).toString('hex')
const jwtSecret = randomBytes(48).toString('hex')

console.log('Generated secrets (copy to your .dev.vars and Wrangler secrets):')
console.log('─'.repeat(60))
console.log(`MASTER_ENCRYPTION_KEY=${masterKey}`)
console.log(`JWT_SECRET=${jwtSecret}`)
console.log('─'.repeat(60))
console.log()

const username = await ask('Admin username (default: admin): ') || 'admin'
const password = await ask('Admin password: ')

if (!password) {
  console.error('Password cannot be empty')
  process.exit(1)
}

// SHA-256 hash of password (used for login verification)
const hash = createHash('sha256').update(password).digest('hex')

console.log()
console.log('─'.repeat(60))
console.log(`ADMIN_USERNAME=${username}`)
console.log(`ADMIN_PASSWORD_HASH=${hash}`)
console.log('─'.repeat(60))
console.log()
console.log('✅ Setup complete!')
console.log('Next steps:')
console.log('  1. Copy the values above to worker/.dev.vars')
console.log('  2. Run: npx wrangler secret put MASTER_ENCRYPTION_KEY')
console.log('  3. Run: npx wrangler secret put JWT_SECRET')
console.log('  4. Run: npx wrangler secret put ADMIN_USERNAME')
console.log('  5. Run: npx wrangler secret put ADMIN_PASSWORD_HASH')
console.log()

rl.close()
