import { Hono } from 'hono'
import { deleteCookie, getCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { hashPassword, sha256Hex, verifyPassword } from './auth'
import { helperRoutes } from './helper'
import { SESSION_COOKIE, readJson, requireUser, startSession, type AppEnv } from './session'
import {
  ValidationError,
  readEmail,
  readList,
  readName,
  readPassword,
  readUrl,
  readWorkTypes,
} from './validate'

// Stays under D1's 2 MB row limit.
const MAX_RESUME_BYTES = 1_900_000
const MIN_RESUME_TEXT = 50
const MAX_RESUME_TEXT = 100_000

const app = new Hono<AppEnv>().basePath('/api')

app.use(csrf())

// API responses hold private data and change often, so browsers must never reuse a stored copy.
app.use(async (c, next) => {
  await next()
  if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store')
})

app.post('/auth/signup', async (c) => {
  const body = await readJson(c)
  const name = readName(body.name)
  const email = readEmail(body.email)
  const password = readPassword(body.password)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) return c.json({ error: 'An account with this email already exists. Log in instead.' }, 409)

  const userId = crypto.randomUUID()
  const now = Date.now()
  const hashed = await hashPassword(password)
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO users (id, email, name, password_hash, password_salt, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(userId, email, name, hashed.hash, hashed.salt, hashed.iterations, now),
      c.env.DB.prepare('INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)').bind(userId, now),
    ])
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return c.json({ error: 'An account with this email already exists. Log in instead.' }, 409)
    }
    throw error
  }
  await startSession(c, userId)
  return c.json({ ok: true }, 201)
})

app.post('/auth/login', async (c) => {
  const body = await readJson(c)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  const user = await c.env.DB.prepare(
    'SELECT id, password_hash, password_salt, password_iterations FROM users WHERE email = ?',
  )
    .bind(email)
    .first<{ id: string; password_hash: string; password_salt: string; password_iterations: number }>()

  // Hash even when the email is unknown so response timing doesn't reveal which emails have accounts.
  const valid = user
    ? await verifyPassword(password, {
        hash: user.password_hash,
        salt: user.password_salt,
        iterations: user.password_iterations,
      })
    : (await hashPassword(password), false)
  if (!user || !valid) return c.json({ error: 'Email or password is incorrect.' }, 401)

  await startSession(c, user.id)
  return c.json({ ok: true })
})

app.post('/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run()
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
  return c.json({ ok: true })
})

type ProfileRow = {
  name: string
  email: string
  portfolio_url: string
  linkedin_url: string
  target_titles: string
  target_locations: string
  work_types: string
  summary: string
  summary_updated_at: number | null
  file_name: string | null
  size: number | null
  uploaded_at: number | null
  text: string | null
}

app.get('/me', requireUser, async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT u.name, u.email, p.portfolio_url, p.linkedin_url, p.target_titles, p.target_locations, p.work_types, p.summary, p.summary_updated_at,
            r.file_name, r.size, r.uploaded_at, r.text
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     LEFT JOIN resumes r ON r.user_id = u.id
     WHERE u.id = ?`,
  )
    .bind(c.get('userId'))
    .first<ProfileRow>()
  if (!row) return c.json({ error: 'Log in to continue.' }, 401)

  return c.json({
    user: { name: row.name, email: row.email },
    profile: {
      portfolioUrl: row.portfolio_url,
      linkedinUrl: row.linkedin_url,
      targetTitles: JSON.parse(row.target_titles),
      targetLocations: JSON.parse(row.target_locations),
      workTypes: JSON.parse(row.work_types),
      summary: row.summary,
      summaryUpdatedAt: row.summary_updated_at,
    },
    resume: row.file_name
      ? {
          fileName: row.file_name,
          size: row.size,
          uploadedAt: row.uploaded_at,
          wordCount: (row.text ?? '').split(/\s+/).filter(Boolean).length,
        }
      : null,
  })
})

app.put('/profile', requireUser, async (c) => {
  const body = await readJson(c)
  const userId = c.get('userId')
  const now = Date.now()
  const updates: D1PreparedStatement[] = []

  if ('name' in body) {
    updates.push(c.env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(readName(body.name), userId))
  }
  const fields: Array<[string, string, (value: unknown) => string]> = [
    ['portfolioUrl', 'portfolio_url', (v) => readUrl(v, 'portfolio')],
    ['linkedinUrl', 'linkedin_url', (v) => readUrl(v, 'LinkedIn')],
    ['targetTitles', 'target_titles', (v) => JSON.stringify(readList(v, 'job titles'))],
    ['targetLocations', 'target_locations', (v) => JSON.stringify(readList(v, 'locations'))],
    ['workTypes', 'work_types', (v) => JSON.stringify(readWorkTypes(v))],
  ]
  for (const [key, column, read] of fields) {
    if (key in body) {
      updates.push(
        c.env.DB.prepare(`UPDATE profiles SET ${column} = ?, updated_at = ? WHERE user_id = ?`).bind(
          read(body[key]),
          now,
          userId,
        ),
      )
    }
  }
  if (updates.length) await c.env.DB.batch(updates)
  return c.json({ ok: true })
})

function resumeKind(fileName: string, bytes: Uint8Array): { mimeType: string } | null {
  const lower = fileName.toLowerCase()
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
  if (lower.endsWith('.pdf') && isPdf) return { mimeType: 'application/pdf' }
  if (lower.endsWith('.docx') && isZip) {
    return { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  }
  return null
}

app.post('/resume', requireUser, async (c) => {
  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  const text = form?.get('text')
  if (!(file instanceof File) || typeof text !== 'string') {
    throw new ValidationError('Choose a resume file to upload.')
  }
  if (file.size > MAX_RESUME_BYTES) throw new ValidationError('Choose a resume file under 1.9 MB.')

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = resumeKind(file.name, bytes)
  if (!kind) throw new ValidationError('Upload your resume as a PDF or Word (.docx) file.')

  const cleanText = text.trim()
  if (cleanText.length < MIN_RESUME_TEXT) {
    throw new ValidationError(
      "We couldn't read text from this file. It may be a scanned image. Upload a PDF saved from a document editor, or a Word file.",
    )
  }
  if (cleanText.length > MAX_RESUME_TEXT) throw new ValidationError('This resume is too long. Upload a shorter version.')

  const userId = c.get('userId')
  const fileName = file.name.slice(0, 200)
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT OR REPLACE INTO resumes (user_id, file_name, mime_type, size, text, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(userId, fileName, kind.mimeType, file.size, cleanText, now),
    c.env.DB.prepare('INSERT OR REPLACE INTO resume_files (user_id, data) VALUES (?, ?)').bind(userId, bytes),
  ])
  return c.json({ ok: true }, 201)
})

app.get('/resume/file', requireUser, async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT r.file_name, r.mime_type, f.data FROM resumes r JOIN resume_files f ON f.user_id = r.user_id WHERE r.user_id = ?',
  )
    .bind(c.get('userId'))
    .first<{ file_name: string; mime_type: string; data: ArrayBuffer | number[] }>()
  if (!row) return c.json({ error: 'No resume uploaded yet.' }, 404)

  const data = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : new Uint8Array(row.data)
  const safeName = row.file_name.replace(/[^\w.\- ]/g, '_')
  return new Response(data, {
    headers: {
      'Content-Type': row.mime_type,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
})

app.route('/', helperRoutes)

app.notFound((c) => c.json({ error: 'Not found.' }, 404))

app.onError((error, c) => {
  if (error instanceof ValidationError) return c.json({ error: error.message }, 400)
  if (error instanceof HTTPException) {
    return c.json({ error: error.status === 403 ? 'This request was blocked for security reasons.' : error.message }, error.status)
  }
  console.error(JSON.stringify({ message: 'Unhandled API error', error: String(error), path: c.req.path }))
  return c.json({ error: 'Something went wrong on our side. Try again.' }, 500)
})

export default app
