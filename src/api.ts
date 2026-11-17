export type WorkType = 'remote' | 'hybrid' | 'onsite'

export type Me = {
  user: { name: string; email: string }
  profile: {
    portfolioUrl: string
    linkedinUrl: string
    targetTitles: string[]
    targetLocations: string[]
    workTypes: WorkType[]
    summary: string
    summaryUpdatedAt: number | null
  }
  resume: { fileName: string; size: number; uploadedAt: number; wordCount: number } | null
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type RequestOptions = { method?: string; json?: unknown; form?: FormData }

export async function api<T = { ok: true }>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? (options.json || options.form ? 'POST' : 'GET'),
      headers: options.json ? { 'Content-Type': 'application/json' } : undefined,
      body: options.json ? JSON.stringify(options.json) : options.form,
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError("Couldn't reach Jobpot. Check your connection and try again.", 0)
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(data.error ?? 'Something went wrong on our side. Try again.', response.status)
  }
  return data as T
}

export type HelperSettings = {
  searchTime: string
  timezone: string
  maxMinutes: number
  maxRequests: number | null
  maxJobs: number
  sites: string[]
  closestCutoff: number
  reachCutoff: number
  aiConsent: boolean
}

export type HelperStatus = {
  devices: Array<{ name: string; connectedAt: number; lastUsedAt: number }>
  settings: HelperSettings | null
  lastRun: {
    id: string
    startedAt: number
    finishedAt: number
    status: 'completed' | 'time-limit' | 'request-limit' | 'failed'
    aiRequests: number | null
    jobsFound: number
  } | null
}

export type Tier = 'closest' | 'reach' | 'far'

export type Job = {
  id: string
  runId: string
  url: string
  title: string
  company: string
  location: string
  workType: 'remote' | 'hybrid' | 'onsite' | 'unknown'
  source: string
  applyUrl: string
  postedAt: string
  score: number
  reason: string
  foundAt: number
  tier: Tier
}

export const getMe = () => api<Me>('/me')
export const getHelperStatus = () => api<HelperStatus>('/helper/status')
export const getJobs = () => api<{ jobs: Job[]; cutoffs: { closest: number; reach: number } }>('/jobs')
