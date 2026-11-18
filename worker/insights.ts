import { Hono, type Context } from 'hono'
import { readJson, requireUser, type AppEnv } from './session'
import { ValidationError } from './validate'

const NO_REPLY_MS = 30 * 24 * 60 * 60 * 1000
const PENDING_TIMEOUT_MS = 10 * 60 * 1000
const MAX_CONTENT = 30_000

type EligibleRow = {
  id: string
  title: string
  company: string
  url: string
  apply_url: string
  reason: string
  score: number
  status: string
  applied_at: number
}

// Jobs Insights learns from: rejected, or no reply for 30+ days (still Applied or In review).
async function eligibleJobs(c: Context<AppEnv>) {
  const rows = await c.env.DB.prepare(
    `SELECT id, title, company, url, apply_url, reason, score, status, applied_at FROM jobs
     WHERE user_id = ? AND applied_at IS NOT NULL
       AND (status = 'rejected' OR (status IN ('applied', 'in_review') AND COALESCE(status_at, applied_at) < ?))
     ORDER BY applied_at`,
  )
    .bind(c.get('userId'), Date.now() - NO_REPLY_MS)
    .all<EligibleRow>()
  return rows.results
}

type InsightsRow = { status: string; content: string; job_ids: string; error: string; updated_at: number }

export const insightsRoutes = new Hono<AppEnv>()

insightsRoutes.get('/insights', requireUser, async (c) => {
  const [row, eligible] = await Promise.all([
    c.env.DB.prepare('SELECT status, content, job_ids, error, updated_at FROM insights WHERE user_id = ?')
      .bind(c.get('userId'))
      .first<InsightsRow>(),
    eligibleJobs(c),
  ])
  const analyzed = new Set<string>(row ? JSON.parse(row.job_ids) : [])
  const stale = row?.status === 'pending' && Date.now() - row.updated_at > PENDING_TIMEOUT_MS
  let content = null
  if (row?.content) {
    try {
      content = JSON.parse(row.content)
    } catch {
      content = null
    }
  }
  return c.json({
    status: stale ? 'failed' : (row?.status ?? 'none'),
    error: stale ? 'Your computer stopped before finishing. Try again.' : (row?.error ?? ''),
    updatedAt: row?.updated_at ?? null,
    content,
    jobs: eligible.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      url: j.url,
      outcome: j.status === 'rejected' ? 'rejected' : 'no_reply',
    })),
    newSinceAnalysis: eligible.filter((j) => !analyzed.has(j.id)).length,
  })
})

insightsRoutes.post('/insights/refresh', requireUser, async (c) => {
  const eligible = await eligibleJobs(c)
  if (!eligible.length) throw new ValidationError('There are no rejected or no-reply applications to learn from yet.')
  await c.env.DB.prepare(
    `INSERT INTO insights (user_id, status, updated_at) VALUES (?, 'pending', ?)
     ON CONFLICT (user_id) DO UPDATE SET status = 'pending', error = '', updated_at = excluded.updated_at`,
  )
    .bind(c.get('userId'), Date.now())
    .run()
  return c.json({ ok: true })
})

// ---------- Helper (bearer) routes; mounted behind requireHelper ----------

export const helperInsightsRoutes = new Hono<AppEnv>()

helperInsightsRoutes.get('/', async (c) => {
  const [eligible, row] = await Promise.all([
    eligibleJobs(c),
    c.env.DB.prepare('SELECT job_ids FROM insights WHERE user_id = ?').bind(c.get('userId')).first<{ job_ids: string }>(),
  ])
  return c.json({
    analyzedJobIds: row ? JSON.parse(row.job_ids) : [],
    jobs: eligible.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      url: j.apply_url || j.url,
      score: j.score,
      reason: j.reason,
      outcome: j.status === 'rejected' ? 'rejected' : 'no_reply',
    })),
  })
})

helperInsightsRoutes.put('/', async (c) => {
  const body = await readJson(c)
  const status = body.status === 'ready' ? 'ready' : body.status === 'failed' ? 'failed' : body.status === 'pending' ? 'pending' : null
  if (!status) throw new ValidationError('Status must be pending, ready, or failed.')
  const content = status === 'ready' ? JSON.stringify(body.content ?? null) : null
  if (content && content.length > MAX_CONTENT) throw new ValidationError('The insights are too long.')
  const jobIds = Array.isArray(body.jobIds) ? JSON.stringify(body.jobIds.filter((id: unknown) => typeof id === 'string').slice(0, 500)) : null
  const error = typeof body.error === 'string' ? body.error.slice(0, 300) : ''
  const aiRequests = Number.isInteger(body.aiRequests) ? (body.aiRequests as number) : null
  await c.env.DB.prepare(
    `INSERT INTO insights (user_id, status, content, job_ids, error, ai_requests, updated_at) VALUES (?, ?, COALESCE(?, ''), COALESCE(?, '[]'), ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET status = excluded.status,
       content = COALESCE(?, insights.content), job_ids = COALESCE(?, insights.job_ids),
       error = excluded.error, ai_requests = excluded.ai_requests, updated_at = excluded.updated_at`,
  )
    .bind(c.get('userId'), status, content, jobIds, error, aiRequests, Date.now(), content, jobIds)
    .run()
  return c.json({ ok: true })
})
