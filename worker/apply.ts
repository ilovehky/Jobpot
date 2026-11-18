import { Hono } from 'hono'
import { readJson, requireUser, type AppEnv } from './session'
import { ValidationError } from './validate'

export const DOC_KINDS = ['resume', 'cover_letter', 'outreach'] as const
type DocKind = (typeof DOC_KINDS)[number]
// A document still "writing" after this long is treated as failed (the helper was closed or crashed).
const PENDING_TIMEOUT_MS = 10 * 60 * 1000
const MAX_ANSWER_LENGTH = 2000
const MAX_DOC_LENGTH = 20_000

export function questionKey(question: string) {
  return question
    .toLowerCase()
    .replace(/\(required\)|\*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 200)
}

type DocRow = {
  id: string
  job_id: string
  kind: DocKind
  status: string
  content: string
  error: string
  gmail_draft_id: string | null
  updated_at: number
}

function docJson(row: DocRow, includeContent: boolean) {
  const stale = row.status === 'pending' && Date.now() - row.updated_at > PENDING_TIMEOUT_MS
  return {
    id: row.id,
    jobId: row.job_id,
    kind: row.kind,
    status: stale ? 'failed' : row.status,
    error: stale ? 'Your computer stopped before finishing. Try again.' : row.error,
    gmailDraftId: row.gmail_draft_id,
    updatedAt: row.updated_at,
    ...(includeContent ? { content: row.content } : {}),
  }
}

export const applyRoutes = new Hono<AppEnv>()

// ---------- Website (cookie) routes ----------

applyRoutes.post('/jobs/:id/applied', requireUser, async (c) => {
  const result = await c.env.DB.prepare('UPDATE jobs SET applied_at = ? WHERE id = ? AND user_id = ? AND applied_at IS NULL')
    .bind(Date.now(), c.req.param('id'), c.get('userId'))
    .run()
  if (!result.meta.changes) {
    const exists = await c.env.DB.prepare('SELECT 1 FROM jobs WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('userId')).first()
    if (!exists) return c.json({ error: 'Job not found.' }, 404)
  }
  return c.json({ ok: true })
})

applyRoutes.delete('/jobs/:id/applied', requireUser, async (c) => {
  await c.env.DB.prepare('UPDATE jobs SET applied_at = NULL WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId'))
    .run()
  return c.json({ ok: true })
})

applyRoutes.get('/documents', requireUser, async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT id, job_id, kind, status, content, error, gmail_draft_id, updated_at FROM documents WHERE user_id = ? ORDER BY updated_at DESC',
  )
    .bind(c.get('userId'))
    .all<DocRow>()
  return c.json({ documents: rows.results.map((row) => docJson(row, false)) })
})

applyRoutes.get('/documents/:id', requireUser, async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT id, job_id, kind, status, content, error, gmail_draft_id, updated_at FROM documents WHERE id = ? AND user_id = ?',
  )
    .bind(c.req.param('id'), c.get('userId'))
    .first<DocRow>()
  if (!row) return c.json({ error: 'Document not found.' }, 404)
  return c.json(docJson(row, true))
})

applyRoutes.post('/jobs/:id/documents', requireUser, async (c) => {
  const body = await readJson(c)
  const kind = DOC_KINDS.find((k) => k === body.kind)
  if (!kind) throw new ValidationError('Choose a resume or a cover letter.')
  const userId = c.get('userId')
  const jobId = c.req.param('id')
  const job = await c.env.DB.prepare('SELECT 1 FROM jobs WHERE id = ? AND user_id = ?').bind(jobId, userId).first()
  if (!job) return c.json({ error: 'Job not found.' }, 404)
  const now = Date.now()
  const id = crypto.randomUUID()
  const row = await c.env.DB.prepare(
    `INSERT INTO documents (id, user_id, job_id, kind, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)
     ON CONFLICT (user_id, job_id, kind) DO UPDATE SET status = 'pending', error = '', updated_at = excluded.updated_at
     RETURNING id`,
  )
    .bind(id, userId, jobId, kind, now, now)
    .first<{ id: string }>()
  return c.json({ id: row?.id ?? id }, 201)
})

applyRoutes.get('/answers', requireUser, async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT question_key, question, answer, updated_at FROM answers WHERE user_id = ? ORDER BY updated_at DESC',
  )
    .bind(c.get('userId'))
    .all<{ question_key: string; question: string; answer: string; updated_at: number }>()
  return c.json({
    answers: rows.results.map((r) => ({ key: r.question_key, question: r.question, answer: r.answer, updatedAt: r.updated_at })),
  })
})

applyRoutes.delete('/answers/:key', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM answers WHERE user_id = ? AND question_key = ?')
    .bind(c.get('userId'), c.req.param('key'))
    .run()
  return c.json({ ok: true })
})

// ---------- Helper (bearer) routes; mounted behind requireHelper in helper.ts ----------

export const helperApplyRoutes = new Hono<AppEnv>()

helperApplyRoutes.get('/autofill', async (c) => {
  const userId = c.get('userId')
  const [profile, answers] = await Promise.all([
    c.env.DB.prepare(
      `SELECT u.name, u.email, p.portfolio_url, p.linkedin_url, p.target_locations, r.text
       FROM users u JOIN profiles p ON p.user_id = u.id LEFT JOIN resumes r ON r.user_id = u.id WHERE u.id = ?`,
    )
      .bind(userId)
      .first<{ name: string; email: string; portfolio_url: string; linkedin_url: string; target_locations: string; text: string | null }>(),
    c.env.DB.prepare('SELECT question_key, question, answer FROM answers WHERE user_id = ?')
      .bind(userId)
      .all<{ question_key: string; question: string; answer: string }>(),
  ])
  if (!profile) return c.json({ error: 'Account not found.' }, 404)
  return c.json({
    accountName: profile.name,
    email: profile.email,
    portfolioUrl: profile.portfolio_url,
    linkedinUrl: profile.linkedin_url,
    targetLocations: JSON.parse(profile.target_locations),
    resumeText: (profile.text ?? '').slice(0, 3000),
    answers: answers.results.map((a) => ({ key: a.question_key, question: a.question, answer: a.answer })),
  })
})

helperApplyRoutes.post('/answers', async (c) => {
  const body = await readJson(c)
  if (!Array.isArray(body.answers)) throw new ValidationError('Send answers as a list.')
  const userId = c.get('userId')
  const now = Date.now()
  const statements = []
  for (const raw of (body.answers as unknown[]).slice(0, 200)) {
    if (!raw || typeof raw !== 'object') continue
    const { question, answer } = raw as Record<string, unknown>
    if (typeof question !== 'string' || typeof answer !== 'string') continue
    const key = questionKey(question)
    const value = answer.trim()
    if (!key || !value || value.length > MAX_ANSWER_LENGTH) continue
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO answers (user_id, question_key, question, answer, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, question_key) DO UPDATE SET question = excluded.question, answer = excluded.answer,
           updated_at = excluded.updated_at`,
      ).bind(userId, key, question.trim().slice(0, 300), value, now),
    )
  }
  if (statements.length) await c.env.DB.batch(statements)
  return c.json({ ok: true, saved: statements.length })
})

helperApplyRoutes.get('/documents/:id', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT d.kind, j.title, j.company, j.location, j.url, j.apply_url, j.reason
     FROM documents d JOIN jobs j ON j.id = d.job_id WHERE d.id = ? AND d.user_id = ?`,
  )
    .bind(c.req.param('id'), c.get('userId'))
    .first<{ kind: DocKind; title: string; company: string; location: string; url: string; apply_url: string; reason: string }>()
  if (!row) return c.json({ error: 'Document not found.' }, 404)
  return c.json({
    kind: row.kind,
    job: { title: row.title, company: row.company, location: row.location, url: row.url, applyUrl: row.apply_url, reason: row.reason },
  })
})

helperApplyRoutes.put('/documents/:id', async (c) => {
  const body = await readJson(c)
  const status = body.status === 'ready' ? 'ready' : body.status === 'failed' ? 'failed' : null
  if (!status) throw new ValidationError('Status must be ready or failed.')
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (status === 'ready' && !content) throw new ValidationError('A finished document needs content.')
  if (content.length > MAX_DOC_LENGTH) throw new ValidationError('The document is too long.')
  const error = typeof body.error === 'string' ? body.error.slice(0, 300) : ''
  const aiRequests = typeof body.aiRequests === 'number' && Number.isInteger(body.aiRequests) ? body.aiRequests : null
  const draftId = typeof body.gmailDraftId === 'string' ? body.gmailDraftId.slice(0, 100) : null
  const result = await c.env.DB.prepare(
    `UPDATE documents SET status = ?, content = CASE WHEN ? = 'ready' THEN ? ELSE content END, error = ?, ai_requests = ?,
       gmail_draft_id = COALESCE(?, gmail_draft_id), updated_at = ? WHERE id = ? AND user_id = ?`,
  )
    .bind(status, status, content, error, aiRequests, draftId, Date.now(), c.req.param('id'), c.get('userId'))
    .run()
  if (!result.meta.changes) return c.json({ error: 'Document not found.' }, 404)
  return c.json({ ok: true })
})
