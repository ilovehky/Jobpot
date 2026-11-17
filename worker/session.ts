import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { newSessionToken, sha256Hex } from './auth'
import { ValidationError } from './validate'

export type AppEnv = { Bindings: Env; Variables: { userId: string } }

export const SESSION_COOKIE = 'jobpot_session'
const SESSION_DAYS = 7
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

export async function readJson(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch {
    // Falls through to the error below.
  }
  throw new ValidationError('Send the request as a JSON object.')
}

export async function startSession(c: Context<AppEnv>, userId: string) {
  const token = newSessionToken()
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(userId, now),
    c.env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(
      await sha256Hex(token),
      userId,
      now + SESSION_MS,
      now,
    ),
  ])
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return c.json({ error: 'Log in to continue.' }, 401)
  const tokenHash = await sha256Hex(token)
  const session = await c.env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: number }>()
  if (!session || session.expires_at < Date.now()) {
    if (session) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
    return c.json({ error: 'Your session ended. Log in again.' }, 401)
  }
  c.set('userId', session.user_id)
  await next()
})
