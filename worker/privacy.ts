import { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'
import { verifyPassword } from './auth'
import { SESSION_COOKIE, readJson, requireUser, type AppEnv } from './session'
import { ValidationError } from './validate'

export const USAGE_KINDS = ['search', 'resume', 'cover_letter', 'outreach', 'insights', 'gmail'] as const
type UsageKind = (typeof USAGE_KINDS)[number]
const USAGE_DAYS = 31

// Adds a row to the AI usage log; returns null when nothing was used.
export function usageStatement(db: D1Database, userId: string, kind: UsageKind, aiRequests: number | null | undefined) {
  if (!aiRequests || aiRequests <= 0) return null
  return db
    .prepare('INSERT INTO ai_usage (id, user_id, kind, ai_requests, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, kind, aiRequests, Date.now())
}

export const SELF_ID_OPTIONS = {
  gender: ['female', 'male', 'nonbinary', 'decline'],
  race: ['hispanic', 'white', 'black', 'asian', 'native_american', 'pacific_islander', 'two_or_more', 'decline'],
  veteran: ['yes', 'no', 'decline'],
  disability: ['yes', 'no', 'decline'],
  workAuthorized: ['yes', 'no'],
  needsSponsorship: ['yes', 'no'],
} as const
type SelfId = Partial<Record<keyof typeof SELF_ID_OPTIONS, string>>

function readSelfId(value: unknown): SelfId {
  if (!value || typeof value !== 'object') throw new ValidationError('Send self-identification answers as an object.')
  const out: SelfId = {}
  for (const [key, allowed] of Object.entries(SELF_ID_OPTIONS) as Array<[keyof SelfId, readonly string[]]>) {
    const v = (value as Record<string, unknown>)[key]
    if (v === undefined || v === null || v === '') continue
    if (typeof v !== 'string' || !allowed.includes(v)) throw new ValidationError(`Pick one of the listed choices for ${key}.`)
    out[key] = v
  }
  return out
}

export function parseSelfId(text: string | null | undefined): SelfId {
  try {
    return readSelfId(JSON.parse(text || '{}'))
  } catch {
    return {}
  }
}

// What the AI may see, only with consent: work authorization and sponsorship, never demographics.
export function aiWorkAuthorization(selfId: SelfId, consent: number) {
  if (consent !== 1 || (!selfId.workAuthorized && !selfId.needsSponsorship)) return null
  return { authorizedToWork: selfId.workAuthorized ?? null, needsSponsorship: selfId.needsSponsorship ?? null }
}

export const privacyRoutes = new Hono<AppEnv>()

privacyRoutes.put('/profile/self-id', requireUser, async (c) => {
  const body = await readJson(c)
  const selfId = readSelfId(body.selfId)
  if (typeof body.aiConsent !== 'boolean') throw new ValidationError('Say whether the AI may use your work authorization.')
  await c.env.DB.prepare('UPDATE profiles SET self_id = ?, ai_consent = ?, updated_at = ? WHERE user_id = ?')
    .bind(JSON.stringify(selfId), body.aiConsent ? 1 : 0, Date.now(), c.get('userId'))
    .run()
  return c.json({ ok: true })
})

privacyRoutes.get('/usage', requireUser, async (c) => {
  const since = Date.now() - USAGE_DAYS * 24 * 60 * 60 * 1000
  const rows = await c.env.DB.prepare(
    'SELECT kind, ai_requests, created_at FROM ai_usage WHERE user_id = ? AND created_at >= ? ORDER BY created_at',
  )
    .bind(c.get('userId'), since)
    .all<{ kind: UsageKind; ai_requests: number; created_at: number }>()
  return c.json({ entries: rows.results.map((r) => ({ kind: r.kind, aiRequests: r.ai_requests, at: r.created_at })) })
})

// Child tables first, so the delete works whether or not the database enforces cascades.
const USER_TABLES = [
  'job_events', 'documents', 'jobs', 'runs', 'answers', 'insights', 'ai_usage', 'settings',
  'helper_tokens', 'pairing_codes', 'sessions', 'resume_files', 'resumes', 'profiles',
]

privacyRoutes.delete('/account', requireUser, async (c) => {
  const body = await readJson(c)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) throw new ValidationError('Enter your password to delete your account.')
  const userId = c.get('userId')
  const user = await c.env.DB.prepare('SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?')
    .bind(userId)
    .first<{ password_hash: string; password_salt: string; password_iterations: number }>()
  const valid =
    user &&
    (await verifyPassword(password, { hash: user.password_hash, salt: user.password_salt, iterations: user.password_iterations }))
  if (!valid) return c.json({ error: 'That password is incorrect. Your account was not deleted.' }, 403)
  await c.env.DB.batch([
    ...USER_TABLES.map((table) => c.env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId)),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ])
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
  return c.json({ ok: true })
})

// Helper route for AI use that isn't tied to a run, document, or insight (Gmail sorting).
export const helperUsageRoutes = new Hono<AppEnv>()

helperUsageRoutes.post('/', async (c) => {
  const body = await readJson(c)
  const kind = USAGE_KINDS.find((k) => k === body.kind)
  if (!kind) throw new ValidationError(`Usage kind must be one of: ${USAGE_KINDS.join(', ')}.`)
  const n = body.aiRequests
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 1000) throw new ValidationError('aiRequests must be a whole number.')
  const statement = usageStatement(c.env.DB, c.get('userId'), kind, n)
  if (statement) await statement.run()
  return c.json({ ok: true })
})
