import { Hono } from 'hono'
import { readJson, requireUser, type AppEnv } from './session'
import { ValidationError } from './validate'

export const STATUSES = ['applied', 'in_review', 'assessment', 'interview', 'offer', 'rejected'] as const
type Status = (typeof STATUSES)[number]
// Statuses only move forward through this order; "rejected" can follow any of them.
const RANK: Record<Status, number> = { applied: 0, in_review: 1, assessment: 2, interview: 3, offer: 4, rejected: 5 }
const NO_REPLY_MS = 30 * 24 * 60 * 60 * 1000

function readStatus(value: unknown): Status {
  const status = STATUSES.find((s) => s === value)
  if (!status) throw new ValidationError(`Status must be one of: ${STATUSES.join(', ')}.`)
  return status
}

export const statusRoutes = new Hono<AppEnv>()

type AppliedRow = {
  id: string
  title: string
  company: string
  location: string
  url: string
  source: string
  score: number
  applied_at: number
  status: Status
  status_at: number | null
  needs_review: number
  last_status: Status | null
  last_quote: string | null
  last_subject: string | null
  last_email_date: number | null
  last_source: string | null
}

statusRoutes.get('/applied', requireUser, async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT j.id, j.title, j.company, j.location, j.url, j.source, j.score, j.applied_at, j.status, j.status_at, j.needs_review,
       e.status AS last_status, e.quote AS last_quote, e.subject AS last_subject, e.email_date AS last_email_date, e.source AS last_source
     FROM jobs j
     LEFT JOIN job_events e ON e.id = (SELECT id FROM job_events WHERE job_id = j.id ORDER BY created_at DESC LIMIT 1)
     WHERE j.user_id = ? AND j.applied_at IS NOT NULL
     ORDER BY j.applied_at DESC`,
  )
    .bind(c.get('userId'))
    .all<AppliedRow>()
  const now = Date.now()
  return c.json({
    jobs: rows.results.map((r) => {
      const quiet = (r.status === 'applied' || r.status === 'in_review') && now - (r.status_at ?? r.applied_at) > NO_REPLY_MS
      return {
        id: r.id,
        title: r.title,
        company: r.company,
        location: r.location,
        url: r.url,
        source: r.source,
        score: r.score,
        appliedAt: r.applied_at,
        status: r.status,
        displayStatus: quiet ? 'no_reply' : r.status,
        statusAt: r.status_at,
        needsReview: r.needs_review === 1,
        suggestedStatus: r.needs_review === 1 ? r.last_status : null,
        lastUpdate: r.last_source
          ? { source: r.last_source, quote: r.last_quote ?? '', subject: r.last_subject ?? '', emailDate: r.last_email_date }
          : null,
      }
    }),
  })
})

statusRoutes.put('/jobs/:id/status', requireUser, async (c) => {
  const body = await readJson(c)
  const status = readStatus(body.status)
  const userId = c.get('userId')
  const jobId = c.req.param('id')
  const now = Date.now()
  const result = await c.env.DB.prepare(
    'UPDATE jobs SET status = ?, status_at = ?, needs_review = 0 WHERE id = ? AND user_id = ? AND applied_at IS NOT NULL',
  )
    .bind(status, now, jobId, userId)
    .run()
  if (!result.meta.changes) return c.json({ error: 'Applied job not found.' }, 404)
  await c.env.DB.prepare(
    `INSERT INTO job_events (id, user_id, job_id, status, source, created_at) VALUES (?, ?, ?, ?, 'manual', ?)`,
  )
    .bind(crypto.randomUUID(), userId, jobId, status, now)
    .run()
  return c.json({ ok: true })
})

// ---------- Helper (bearer) routes; mounted behind requireHelper ----------

export const helperStatusRoutes = new Hono<AppEnv>()

helperStatusRoutes.get('/applied', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT id, title, company, applied_at, status FROM jobs WHERE user_id = ? AND applied_at IS NOT NULL ORDER BY applied_at',
  )
    .bind(c.get('userId'))
    .all<{ id: string; title: string; company: string; applied_at: number; status: Status }>()
  return c.json({
    jobs: rows.results.map((r) => ({ id: r.id, title: r.title, company: r.company, appliedAt: r.applied_at, status: r.status })),
  })
})

helperStatusRoutes.post('/statuses', async (c) => {
  const body = await readJson(c)
  if (!Array.isArray(body.updates)) throw new ValidationError('Send updates as a list.')
  const userId = c.get('userId')
  const jobs = await c.env.DB.prepare('SELECT id, status FROM jobs WHERE user_id = ? AND applied_at IS NOT NULL')
    .bind(userId)
    .all<{ id: string; status: Status }>()
  const current = new Map(jobs.results.map((j) => [j.id, j.status]))
  const now = Date.now()
  const statements = []
  let changed = 0
  for (const raw of (body.updates as unknown[]).slice(0, 200)) {
    if (!raw || typeof raw !== 'object') continue
    const u = raw as Record<string, unknown>
    const jobId = typeof u.jobId === 'string' ? u.jobId : ''
    const before = current.get(jobId)
    if (!before) continue
    const status = readStatus(u.status)
    const confident = u.confidence !== 'low'
    const forward = status === 'rejected' ? before !== 'rejected' : RANK[status] > RANK[before] && before !== 'rejected'
    if (!forward) continue
    const emailDate = typeof u.emailDate === 'number' ? u.emailDate : null
    const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO job_events (id, user_id, job_id, status, source, email_date, subject, quote, confidence, created_at)
         VALUES (?, ?, ?, ?, 'gmail', ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), userId, jobId, status, emailDate, text(u.subject, 200), text(u.quote, 240), confident ? 'high' : 'low', now),
    )
    // Unsure updates are only suggested: the status stays put until the user confirms.
    statements.push(
      confident
        ? c.env.DB.prepare('UPDATE jobs SET status = ?, status_at = ?, needs_review = 0 WHERE id = ? AND user_id = ?').bind(
            status,
            emailDate ?? now,
            jobId,
            userId,
          )
        : c.env.DB.prepare('UPDATE jobs SET needs_review = 1 WHERE id = ? AND user_id = ?').bind(jobId, userId),
    )
    if (confident) current.set(jobId, status)
    changed++
  }
  if (statements.length) await c.env.DB.batch(statements)
  return c.json({ ok: true, changed })
})

helperStatusRoutes.get('/google-client', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({ error: 'Gmail isn’t set up on this Jobpot server yet. The site owner needs to add Google credentials.' }, 503)
  }
  return c.json({ clientId: c.env.GOOGLE_CLIENT_ID, clientSecret: c.env.GOOGLE_CLIENT_SECRET })
})
