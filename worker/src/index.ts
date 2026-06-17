import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { jwt } from 'hono/jwt'
import type { Bindings } from './types'

// Route imports
import { authRoutes } from './routes/auth'
import { webhookRoutes } from './routes/webhooks'
import { emailRoutes } from './routes/emails'
import { sendRoutes } from './routes/send'
import { aiRoutes } from './routes/ai'
import { attachmentRoutes } from './routes/attachments'
import { templateRoutes } from './routes/templates'
import { adminRoutes } from './routes/admin'

const app = new Hono<{ Bindings: Bindings }>()

// Global middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
app.use('*', logger())

// Public routes (no auth required)
app.route('/api/auth', authRoutes)
app.route('/webhook', webhookRoutes) // Webhooks use their own HMAC verification

// Protected routes — JWT middleware
app.use('/api/*', async (c, next) => {
  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET,
    cookie: 'token',
  })
  return jwtMiddleware(c, next)
})

// Protected API routes
app.route('/api/emails', emailRoutes)
app.route('/api/send', sendRoutes)
app.route('/api/ai', aiRoutes)
app.route('/api/attachments', attachmentRoutes)
app.route('/api/templates', templateRoutes)
app.route('/api/admin', adminRoutes)

// Global error handler
app.onError((err, c) => {
  console.error('[Worker Error]', err.message, err.stack)
  return c.json({ success: false, error: 'Internal server error' }, 500)
})

// Catch-all: serve React SPA static assets
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
