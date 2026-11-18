// Talks to the Jobpot helper running on this computer (helper/jobpot.mjs serve).
const HELPER_URL = 'http://127.0.0.1:47821'

export class HelperOffline extends Error {
  constructor() {
    super('The Jobpot helper isn’t running on this computer.')
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${HELPER_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new HelperOffline()
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'The Jobpot helper hit a problem. Try again.')
  return data as T
}

export async function helperOnline() {
  try {
    await call('/ping')
    return true
  } catch {
    return false
  }
}

export type ResumeFile = { name: string; type: string; base64: string }

export const openApplication = (url: string, resume: ResumeFile | null) => call('/apply', { url, resume })
export const saveTypedAnswers = () => call<{ saved: number }>('/answers', {})
export const writeDocument = (documentId: string) => call(`/documents/${documentId}/generate`, {})
export const forgetComputer = () => call('/forget', {})

export async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export type GmailStatus =
  | { connected: false }
  | {
      connected: true
      email: string
      lastCheckedAt: number | null
      lastResult: { emailsRead: number; updates: number; unclear: number; aiRequests: number } | null
    }

export const getGmailStatus = () => call<GmailStatus>('/gmail/status')
export const connectGmail = () => call<{ email: string }>('/gmail/connect', {})
export const checkGmail = () => call<{ emailsRead: number; updates: number }>('/gmail/check', {})
export const disconnectGmail = () => call('/gmail/disconnect', {})
export const refreshInsights = () => call('/insights/generate', {})
