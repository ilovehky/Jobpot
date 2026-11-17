import { Hono, type Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { newSessionToken, sha256Hex } from './auth'
import { readJson, requireUser, type AppEnv } from './session'
import { ValidationError } from './validate'

const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PAIRING_MINUTES = 10
const MAX_DEVICES = 5
const MAX_JOBS_PER_RUN = 100
// D1 allows 100 bound parameters per statement; each job row uses 14.
const JOB_ROWS_PER_INSERT = 7
export const SITES = ['linkedin', 'indeed', 'company-pages', 'wellfound', 'builtin'] as const
const RUN_STATUSES = ['completed', 'time-limit', 'request-limit', 'failed'] as const
const JOB_WORK_TYPES = ['remote', 'hybrid', 'onsite', 'unknown'] as const

type SettingsRow = {
  search_time: string
  timezone: string
  max_minutes: number
  max_requests: number | null
  max_jobs: number
  sites: string
  closest_cutoff: number
  reach_cutoff: number
  ai_consent: number
  updated_at: number
}

function settingsJson(row: SettingsRow | null) {
  if (!row) return null
  return {
    searchTime: row.search_time,
    timezone: row.timezone,
    maxMinutes: row.max_minutes,
    maxRequests: row.max_requests,
    maxJobs: row.max_jobs,
    sites: JSON.parse(row.sites) as string[],
    closestCutoff: row.closest_cutoff,
    reachCutoff: row.reach_cutoff,
    aiConsent: row.ai_consent === 1,
    updatedAt: row.updated_at,
  }
}

function readSettings(c: Context<AppEnv>, userId: string) {
  return c.env.DB.prepare('SELECT * FROM settings WHERE user_id = ?').bind(userId).first<SettingsRow>()
}

function normalizeCode(value: unknown) {
  return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
}

function str(value: unknown, label: string, max: number, required = true): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw new ValidationError(`Missing ${label}.`)
  if (text.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer.`)
  return text
}

function int(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${label} must be a whole number from ${min} to ${max}.`)
  }
  return value
}

function httpUrl(value: unknown, label: string, required: boolean): string {
  const text = str(value, label, 1000, required)
  if (!text) return ''
  try {
    const url = new URL(text)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString()
  } catch {
    // Falls through to the error below.
  }
  throw new ValidationError(`${label} must be a web link starting with https://`)
}

const requireHelper = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return c.json({ error: 'This computer is not connected. Run the pair command again.' }, 401)
  const tokenHash = await sha256Hex(token)
  const row = await c.env.DB.prepare('SELECT user_id FROM helper_tokens WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ user_id: string }>()
  if (!row) {
    return c.json({ error: 'This computer was disconnected. Get a new code in Profile and pair again.' }, 401)
  }
  await c.env.DB.prepare('UPDATE helper_tokens SET last_used_at = ? WHERE token_hash = ?').bind(Date.now(), tokenHash).run()
  c.set('userId', row.user_id)
  await next()
})

export const helperRoutes = new Hono<AppEnv>()

// Website (logged-in browser) routes.

helperRoutes.post('/helper/pairing-code', requireUser, async (c) => {
  const userId = c.get('userId')
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const code = [...bytes].map((b) => PAIRING_ALPHABET[b % PAIRING_ALPHABET.length]).join('')
  const expiresAt = Date.now() + PAIRING_MINUTES * 60 * 1000
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM pairing_codes WHERE user_id = ? OR expires_at < ?').bind(userId, Date.now()),
    c.env.DB.prepare('INSERT INTO pairing_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(
      await sha256Hex(code),
      userId,
      expiresAt,
    ),
  ])
  return c.json({ code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt }, 201)
})

helperRoutes.get('/helper/status', requireUser, async (c) => {
  const userId = c.get('userId')
  const [devices, settings, lastRun] = await Promise.all([
    c.env.DB.prepare(
      'SELECT device_name, created_at, last_used_at FROM helper_tokens WHERE user_id = ? ORDER BY last_used_at DESC',
    )
      .bind(userId)
      .all<{ device_name: string; created_at: number; last_used_at: number }>(),
    readSettings(c, userId),
    c.env.DB.prepare(
      'SELECT id, started_at, finished_at, status, ai_requests, jobs_found FROM runs WHERE user_id = ? ORDER BY started_at DESC LIMIT 1',
    )
      .bind(userId)
      .first<{ id: string; started_at: number; finished_at: number; status: string; ai_requests: number | null; jobs_found: number }>(),
  ])
  return c.json({
    devices: devices.results.map((d) => ({ name: d.device_name, connectedAt: d.created_at, lastUsedAt: d.last_used_at })),
    settings: settingsJson(settings),
    lastRun: lastRun
      ? {
          id: lastRun.id,
          startedAt: lastRun.started_at,
          finishedAt: lastRun.finished_at,
          status: lastRun.status,
          aiRequests: lastRun.ai_requests,
          jobsFound: lastRun.jobs_found,
        }
      : null,
  })
})

helperRoutes.delete('/helper/devices', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM helper_tokens WHERE user_id = ?').bind(c.get('userId')).run()
  return c.json({ ok: true })
})

helperRoutes.put('/settings', requireUser, async (c) => {
  const body = await readJson(c)
  const userId = c.get('userId')
  const current = await readSettings(c, userId)
  if (!current) throw new ValidationError('Connect your computer and say "jobpot!" to your agent first.')
  const maxMinutes = int(body.maxMinutes, 'Max search time', 1, 60)
  const maxRequests = body.maxRequests == null ? null : int(body.maxRequests, 'AI request limit', 1, 500)
  const maxJobs = int(body.maxJobs, 'Jobs per day', 1, MAX_JOBS_PER_RUN)
  if (!Array.isArray(body.sites) || !body.sites.length) throw new ValidationError('Pick at least one job site.')
  const sites = SITES.filter((site) => (body.sites as unknown[]).includes(site))
  const closest = int(body.closestCutoff, 'Closest fit score', 1, 100)
  const reach = int(body.reachCutoff, 'Reach score', 0, 99)
  if (reach >= closest) throw new ValidationError('The Reach score must be lower than the Closest fit score.')
  await c.env.DB.prepare(
    `UPDATE settings SET max_minutes = ?, max_requests = ?, max_jobs = ?, sites = ?, closest_cutoff = ?, reach_cutoff = ?,
       updated_at = ? WHERE user_id = ?`,
  )
    .bind(maxMinutes, maxRequests, maxJobs, JSON.stringify(sites), closest, reach, Date.now(), userId)
    .run()
  return c.json({ ok: true })
})

helperRoutes.get('/jobs', requireUser, async (c) => {
  const userId = c.get('userId')
  const [jobs, settings] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, run_id, url, title, company, location, work_type, source, apply_url, posted_at, score, reason, found_at
       FROM jobs WHERE user_id = ? ORDER BY score DESC, found_at DESC LIMIT 200`,
    )
      .bind(userId)
      .all<{
        id: string
        run_id: string
        url: string
        title: string
        company: string
        location: string
        work_type: string
        source: string
        apply_url: string
        posted_at: string
        score: number
        reason: string
        found_at: number
      }>(),
    readSettings(c, userId),
  ])
  const closest = settings?.closest_cutoff ?? 75
  const reach = settings?.reach_cutoff ?? 50
  return c.json({
    cutoffs: { closest, reach },
    jobs: jobs.results.map((j) => ({
      id: j.id,
      runId: j.run_id,
      url: j.url,
      title: j.title,
      company: j.company,
      location: j.location,
      workType: j.work_type,
      source: j.source,
      applyUrl: j.apply_url,
      postedAt: j.posted_at,
      score: j.score,
      reason: j.reason,
      foundAt: j.found_at,
      tier: j.score >= closest ? 'closest' : j.score >= reach ? 'reach' : 'far',
    })),
  })
})

// Helper (computer) routes. Pairing exchanges a one-time code for a long-lived token.

helperRoutes.post('/helper/pair', async (c) => {
  const body = await readJson(c)
  const code = normalizeCode(body.code)
  const deviceName = str(body.deviceName, 'device name', 100, false) || 'My computer'
  if (code.length !== 8) throw new ValidationError('Enter the 8-character code shown in Jobpot under Profile.')

  const codeHash = await sha256Hex(code)
  const row = await c.env.DB.prepare('SELECT user_id, expires_at FROM pairing_codes WHERE code_hash = ?')
    .bind(codeHash)
    .first<{ user_id: string; expires_at: number }>()
  await c.env.DB.prepare('DELETE FROM pairing_codes WHERE code_hash = ?').bind(codeHash).run()
  if (!row || row.expires_at < Date.now()) {
    return c.json({ error: 'This code is wrong or has expired. Get a new code in Jobpot under Profile.' }, 400)
  }

  const token = `jph_${newSessionToken()}`
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO helper_tokens (token_hash, user_id, device_name, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(await sha256Hex(token), row.user_id, deviceName, now, now),
    c.env.DB.prepare(
      `DELETE FROM helper_tokens WHERE user_id = ? AND token_hash NOT IN
       (SELECT token_hash FROM helper_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)`,
    ).bind(row.user_id, row.user_id, MAX_DEVICES),
  ])
  return c.json({ token }, 201)
})

helperRoutes.get('/helper/profile', requireHelper, async (c) => {
  const userId = c.get('userId')
  const [profile, settings, seen] = await Promise.all([
    c.env.DB.prepare(
      `SELECT u.name, p.portfolio_url, p.linkedin_url, p.target_titles, p.target_locations, p.work_types, p.summary, r.text
       FROM users u JOIN profiles p ON p.user_id = u.id LEFT JOIN resumes r ON r.user_id = u.id WHERE u.id = ?`,
    )
      .bind(userId)
      .first<{
        name: string
        portfolio_url: string
        linkedin_url: string
        target_titles: string
        target_locations: string
        work_types: string
        summary: string
        text: string | null
      }>(),
    readSettings(c, userId),
    c.env.DB.prepare('SELECT url FROM jobs WHERE user_id = ? AND found_at > ? ORDER BY found_at DESC LIMIT 1000')
      .bind(userId, Date.now() - 90 * 24 * 60 * 60 * 1000)
      .all<{ url: string }>(),
  ])
  if (!profile) return c.json({ error: 'Account not found.' }, 404)
  return c.json({
    name: profile.name,
    portfolioUrl: profile.portfolio_url,
    linkedinUrl: profile.linkedin_url,
    targetTitles: JSON.parse(profile.target_titles),
    targetLocations: JSON.parse(profile.target_locations),
    workTypes: JSON.parse(profile.work_types),
    summary: profile.summary,
    resumeText: profile.text ?? '',
    settings: settingsJson(settings),
    seenUrls: seen.results.map((r) => r.url),
  })
})

helperRoutes.put('/helper/settings', requireHelper, async (c) => {
  const body = await readJson(c)
  const searchTime = str(body.searchTime, 'search time', 5)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(searchTime)) throw new ValidationError('Search time must look like 09:00.')
  const timezone = str(body.timezone, 'time zone', 64)
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
  } catch {
    throw new ValidationError('Time zone must be a name like America/Los_Angeles.')
  }
  const maxMinutes = int(body.maxMinutes, 'Max search time', 1, 60)
  const maxRequests = body.maxRequests == null ? null : int(body.maxRequests, 'Max AI requests', 1, 500)
  const maxJobs = int(body.maxJobs, 'Max jobs per day', 1, MAX_JOBS_PER_RUN)
  if (!Array.isArray(body.sites) || !body.sites.length) throw new ValidationError('Pick at least one job site.')
  const sites = SITES.filter((site) => (body.sites as unknown[]).includes(site))
  if (sites.length !== body.sites.length) throw new ValidationError(`Job sites must be from: ${SITES.join(', ')}.`)
  if (typeof body.aiConsent !== 'boolean') throw new ValidationError('Say whether sensitive info may be sent to the AI.')

  await c.env.DB.prepare(
    `INSERT INTO settings (user_id, search_time, timezone, max_minutes, max_requests, max_jobs, sites, ai_consent, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET search_time = excluded.search_time, timezone = excluded.timezone,
       max_minutes = excluded.max_minutes, max_requests = excluded.max_requests, max_jobs = excluded.max_jobs,
       sites = excluded.sites, ai_consent = excluded.ai_consent, updated_at = excluded.updated_at`,
  )
    .bind(c.get('userId'), searchTime, timezone, maxMinutes, maxRequests, maxJobs, JSON.stringify(sites), body.aiConsent ? 1 : 0, Date.now())
    .run()
  return c.json({ ok: true })
})

helperRoutes.put('/helper/summary', requireHelper, async (c) => {
  const body = await readJson(c)
  const summary = str(body.summary, 'summary', 1500)
  await c.env.DB.prepare('UPDATE profiles SET summary = ?, summary_updated_at = ? WHERE user_id = ?')
    .bind(summary, Date.now(), c.get('userId'))
    .run()
  return c.json({ ok: true })
})

helperRoutes.post('/helper/runs', requireHelper, async (c) => {
  const body = await readJson(c)
  const userId = c.get('userId')
  const startedAt = int(body.startedAt, 'startedAt', 0, Number.MAX_SAFE_INTEGER)
  const finishedAt = int(body.finishedAt, 'finishedAt', startedAt, Number.MAX_SAFE_INTEGER)
  const status = RUN_STATUSES.find((s) => s === body.status)
  if (!status) throw new ValidationError(`Run status must be one of: ${RUN_STATUSES.join(', ')}.`)
  const aiRequests = body.aiRequests == null ? null : int(body.aiRequests, 'aiRequests', 0, 100_000)
  const note = str(body.note, 'note', 500, false)
  if (!Array.isArray(body.jobs)) throw new ValidationError('Send jobs as a list.')
  if (body.jobs.length > MAX_JOBS_PER_RUN) throw new ValidationError(`Send at most ${MAX_JOBS_PER_RUN} jobs per run.`)

  const now = Date.now()
  const seen = new Set<string>()
  const jobs = []
  for (const [index, raw] of (body.jobs as unknown[]).entries()) {
    if (!raw || typeof raw !== 'object') throw new ValidationError(`Job ${index + 1} must be an object.`)
    const j = raw as Record<string, unknown>
    const label = (field: string) => `Job ${index + 1} ${field}`
    const url = httpUrl(j.url, label('url'), true)
    if (seen.has(url)) continue
    seen.add(url)
    const workType = JOB_WORK_TYPES.find((w) => w === j.workType) ?? 'unknown'
    jobs.push([
      crypto.randomUUID(),
      url,
      str(j.title, label('title'), 200),
      str(j.company, label('company'), 200),
      str(j.location, label('location'), 200, false),
      workType,
      str(j.source, label('source'), 50),
      httpUrl(j.applyUrl, label('applyUrl'), false),
      str(j.postedAt, label('postedAt'), 40, false),
      int(j.score, label('score'), 0, 100),
      str(j.reason, label('reason'), 300),
    ])
  }

  const runId = crypto.randomUUID()
  const statements = [
    c.env.DB.prepare(
      'INSERT INTO runs (id, user_id, started_at, finished_at, status, ai_requests, jobs_found, note) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
    ).bind(runId, userId, startedAt, finishedAt, status, aiRequests, note),
  ]
  for (let i = 0; i < jobs.length; i += JOB_ROWS_PER_INSERT) {
    const chunk = jobs.slice(i, i + JOB_ROWS_PER_INSERT)
    statements.push(
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO jobs (id, url, title, company, location, work_type, source, apply_url, posted_at, score, reason,
           user_id, run_id, found_at) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      ).bind(...chunk.flatMap((row) => [...row, userId, runId, now])),
    )
  }
  const results = await c.env.DB.batch(statements)
  const added = results.slice(1).reduce((sum, r) => sum + (r.meta.changes ?? 0), 0)
  await c.env.DB.prepare('UPDATE runs SET jobs_found = ? WHERE id = ?').bind(added, runId).run()
  return c.json({ ok: true, runId, added, skipped: jobs.length - added }, 201)
})
