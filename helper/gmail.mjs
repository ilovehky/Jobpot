// Gmail access for the Jobpot helper. Runs only on the user's computer; email never goes to the Jobpot website.
// Only a status, the email date, its subject, and one short quote are uploaded per application update.
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const GMAIL_FILE = path.join(process.env.JOBPOT_HOME ?? path.join(os.homedir(), '.jobpot'), 'gmail.json')
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose']
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const MAX_PER_COMPANY = 15
const MAX_TEXT = 4000
const SEEN_LIMIT = 5000

// Ordered: the first matching rule wins when only one status matches.
const RULES = [
  ['offer', /pleased to (extend|offer)|offer letter|excited to (extend|offer) you|formal offer/i],
  [
    'rejected',
    /not (be )?(moving|move) forward|decided (not )?to (move forward|proceed|pursue) with (other|another)|other candidates|position has been filled|no longer (being )?consider|regret to inform|will not be (moving|proceeding)|not selected|unable to offer you/i,
  ],
  ['interview', /schedule (a|an|your|some) (call|interview|chat|time|conversation)|invite you to (an )?interview|phone screen|interview (with|for)|calendly\.com|goodtime\.io|speak with you|meet with (you|our)/i],
  ['assessment', /take[- ]home|assessment|design (exercise|challenge)|coding (challenge|test)|hackerrank|codesignal|questionnaire/i],
  ['in_review', /under review|reviewing your (application|candidacy)|currently review/i],
  ['applied', /(received|thank you for|thanks for) (your )?(application|applying|interest)|application (has been |was )?(received|submitted)/i],
]
const APPLICATION_WORDS = /applica|candida|interview|position|role|opportunit|recruit|hiring|offer/i

export function readGmail() {
  try {
    return JSON.parse(fs.readFileSync(GMAIL_FILE, 'utf8'))
  } catch {
    return null
  }
}

function writeGmail(data) {
  fs.mkdirSync(path.dirname(GMAIL_FILE), { recursive: true, mode: 0o700 })
  fs.writeFileSync(GMAIL_FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
}

async function googleClient(api) {
  return api('GET', '/helper/gmail/google-client')
}

async function tokenRequest(params) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (data.error === 'invalid_grant') throw new Error('Gmail access expired or was removed. Connect Gmail again.')
    throw new Error(`Google sign-in failed: ${data.error_description ?? data.error ?? response.status}`)
  }
  return data
}

let accessCache = null

async function accessToken(api) {
  const saved = readGmail()
  if (!saved?.refreshToken) throw new Error('Gmail is not connected.')
  if (accessCache && accessCache.expires > Date.now() + 60_000) return accessCache.token
  const client = await googleClient(api)
  const data = await tokenRequest({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    refresh_token: saved.refreshToken,
    grant_type: 'refresh_token',
  })
  accessCache = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 }
  return accessCache.token
}

async function gmail(api, route, options = {}) {
  const token = await accessToken(api)
  const response = await fetch(`${GMAIL}${route}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Gmail error: ${data.error?.message ?? response.status}`)
  return data
}

function openInBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
  spawn(command, [url], { stdio: 'ignore', detached: true }).unref()
}

// Google's desktop sign-in: a one-time local page on 127.0.0.1 receives the result (PKCE keeps the code private).
export async function connectGmail(api, { log = console.log } = {}) {
  const client = await googleClient(api)
  const verifier = crypto.randomBytes(48).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const state = crypto.randomBytes(16).toString('hex')

  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Gmail sign-in timed out. Try again.'))
    }, 5 * 60 * 1000)
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname !== '/') return res.writeHead(404).end()
      const ok = url.searchParams.get('state') === state && url.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<!doctype html><title>Jobpot</title><body style="font:18px system-ui;padding:3rem;color:#18213D">` +
          (ok ? '<h1>Gmail connected</h1><p>You can close this tab and go back to Jobpot.</p>' : '<h1>Gmail wasn’t connected</h1><p>Go back to Jobpot and try again.</p>'),
      )
      clearTimeout(timer)
      server.close()
      if (ok) resolve({ code: url.searchParams.get('code'), redirectUri: `http://127.0.0.1:${port}` })
      else reject(new Error(url.searchParams.get('error') === 'access_denied' ? 'Gmail access was not allowed.' : 'Gmail sign-in failed.'))
    })
    let port = 0
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port
      const params = new URLSearchParams({
        client_id: client.clientId,
        redirect_uri: `http://127.0.0.1:${port}`,
        response_type: 'code',
        scope: SCOPES.join(' '),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
        state,
      })
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
      log('Opening Google sign-in in your browser…')
      openInBrowser(authUrl)
    })
  })

  const tokens = await tokenRequest({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    code: code.code,
    code_verifier: verifier,
    redirect_uri: code.redirectUri,
    grant_type: 'authorization_code',
  })
  if (!tokens.refresh_token) throw new Error('Google didn’t return long-term access. Remove Jobpot from your Google account’s third-party access and try again.')
  accessCache = { token: tokens.access_token, expires: Date.now() + tokens.expires_in * 1000 }
  writeGmail({ refreshToken: tokens.refresh_token, email: '', connectedAt: Date.now(), lastCheckedAt: null, seen: [] })
  const profile = await gmail(api, '/profile')
  writeGmail({ ...readGmail(), email: profile.emailAddress })
  return profile.emailAddress
}

export async function disconnectGmail() {
  const saved = readGmail()
  if (saved?.refreshToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(saved.refreshToken)}`, { method: 'POST' }).catch(() => {})
  }
  fs.rmSync(GMAIL_FILE, { force: true })
  accessCache = null
}

export function gmailStatus() {
  const saved = readGmail()
  return saved?.refreshToken
    ? { connected: true, email: saved.email, lastCheckedAt: saved.lastCheckedAt, lastResult: saved.lastResult ?? null }
    : { connected: false }
}

function decode(data) {
  return Buffer.from(String(data ?? ''), 'base64url').toString('utf8')
}

function plainText(payload) {
  const parts = []
  const walk = (part) => {
    if (!part) return
    if (part.mimeType === 'text/plain' && part.body?.data) parts.push(decode(part.body.data))
    for (const child of part.parts ?? []) walk(child)
  }
  walk(payload)
  if (!parts.length) {
    const html = []
    const walkHtml = (part) => {
      if (!part) return
      if (part.mimeType === 'text/html' && part.body?.data) html.push(decode(part.body.data))
      for (const child of part.parts ?? []) walkHtml(child)
    }
    walkHtml(payload)
    parts.push(html.join(' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'))
  }
  return parts
    .join('\n')
    .replace(/\n>.*$/gm, '')
    .replace(/sent from my (iphone|ipad|android|phone|mobile)|get outlook for \w+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function header(message, name) {
  return message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function quoteFor(text, pattern) {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const hit = sentences.find((s) => pattern.test(s)) ?? sentences[0] ?? ''
  return hit.trim().slice(0, 220)
}

export function classifyByRules(subject, text) {
  const all = `${subject}. ${text}`
  const hits = RULES.filter(([, re]) => re.test(all))
  if (!hits.length) return null
  const statuses = new Set(hits.map(([s]) => s))
  // Mixed signals (e.g. "interview" and "other candidates") are left to the AI or the user.
  if (statuses.has('rejected') && (statuses.has('interview') || statuses.has('offer') || statuses.has('assessment'))) return null
  const [status, re] = hits[0]
  return { status, quote: quoteFor(all, re), confidence: 'high' }
}

function companyPattern(company) {
  const core = company.replace(/\(.*?\)|,?\s+(inc|llc|ltd|corp|co|company|technologies|labs)\.?$/gi, '').trim()
  return new RegExp(core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i')
}

function searchQuery(company, after) {
  const core = company.replace(/\(.*?\)|,?\s+(inc|llc|ltd|corp|co|company)\.?$/gi, '').trim().replace(/"/g, '')
  const date = new Date(after - 2 * 24 * 60 * 60 * 1000)
  const day = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  return `after:${day} -from:me -in:sent -in:drafts "${core}"`
}

// Finds emails about applied jobs and works out new statuses. classifyWithAi handles emails the rules can't decide.
export async function checkGmail(api, { classifyWithAi, log = console.log, recheck = false } = {}) {
  const saved = readGmail()
  if (!saved?.refreshToken) throw new Error('Gmail is not connected.')
  const { jobs } = await api('GET', '/helper/gmail/applied')
  // recheck re-reads emails checked before, e.g. after the rules change.
  const seen = new Set(recheck ? [] : (saved.seen ?? []))
  const byCompany = new Map()
  for (const job of jobs) {
    const key = job.company.toLowerCase()
    byCompany.set(key, [...(byCompany.get(key) ?? []), job])
  }

  const decided = []
  const unclear = []
  const newlySeen = []
  for (const group of byCompany.values()) {
    const after = Math.min(...group.map((j) => j.appliedAt))
    const list = await gmail(api, `/messages?maxResults=${MAX_PER_COMPANY}&q=${encodeURIComponent(searchQuery(group[0].company, after))}`)
    for (const { id } of list.messages ?? []) {
      if (seen.has(id)) continue
      newlySeen.push(id)
      const message = await gmail(api, `/messages/${id}?format=full`)
      const subject = header(message, 'Subject')
      const from = header(message, 'From')
      const text = plainText(message.payload).slice(0, MAX_TEXT)
      const emailDate = Number(message.internalDate) || null
      if (!companyPattern(group[0].company).test(`${from} ${subject} ${text}`)) continue
      const rule = classifyByRules(subject, text)
      // A clear status phrase is enough; otherwise the email must at least sound like it's about a job.
      if (!rule && !APPLICATION_WORDS.test(`${subject} ${text}`)) continue
      // When several applications share a company, only match the email to a job whose title it mentions.
      const titled = group.filter((j) => text.toLowerCase().includes(j.title.toLowerCase()) || subject.toLowerCase().includes(j.title.toLowerCase()))
      const targets = group.length === 1 ? group : titled.length ? titled : group
      const lowConfidence = group.length > 1 && !titled.length
      if (rule) {
        for (const job of targets) {
          decided.push({ jobId: job.id, ...rule, confidence: lowConfidence ? 'low' : rule.confidence, emailDate, subject })
        }
      } else {
        unclear.push({ jobs: targets, lowConfidence, from, subject, text: text.slice(0, 1500), emailDate })
      }
    }
  }

  let aiRequests = 0
  if (unclear.length && classifyWithAi) {
    const result = await classifyWithAi(unclear)
    aiRequests = result.aiRequests ?? 0
    if (aiRequests) await api('POST', '/helper/usage', { kind: 'gmail', aiRequests }).catch(() => {})
    for (const item of result.items) {
      const email = unclear[item.index]
      if (!email || !item.status) continue
      for (const job of email.jobs) {
        decided.push({
          jobId: job.id,
          status: item.status,
          quote: String(item.quote ?? '').slice(0, 220),
          confidence: email.lowConfidence || item.confidence === 'low' ? 'low' : 'high',
          emailDate: email.emailDate,
          subject: email.subject,
        })
      }
    }
  }

  // Oldest first, so the latest email decides the final status.
  decided.sort((a, b) => (a.emailDate ?? 0) - (b.emailDate ?? 0))
  const out = decided.length ? await api('POST', '/helper/gmail/statuses', { updates: decided }) : { changed: 0 }
  const summary = { emailsRead: newlySeen.length, updates: out.changed, unclear: unclear.length, aiRequests }
  writeGmail({
    ...readGmail(),
    seen: [...seen, ...newlySeen].slice(-SEEN_LIMIT),
    lastCheckedAt: Date.now(),
    lastResult: summary,
  })
  log(`Gmail checked: ${summary.emailsRead} new emails, ${summary.updates} status updates.`)
  return summary
}

function encodeHeader(value) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

// Saves a draft with no recipient; the user adds one and sends it themselves.
export async function createDraft(api, { subject, body }) {
  const raw = [
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n'),
  ].join('\r\n')
  const draft = await gmail(api, '/drafts', { method: 'POST', body: JSON.stringify({ message: { raw: Buffer.from(raw).toString('base64url') } }) })
  return draft.id
}
