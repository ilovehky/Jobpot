export type WorkType = 'remote' | 'hybrid' | 'onsite'

export type SelfIdKey = 'gender' | 'race' | 'veteran' | 'disability' | 'workAuthorized' | 'needsSponsorship'
export type SelfId = Partial<Record<SelfIdKey, string>>

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
    selfId: SelfId
    aiConsent: boolean
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
  appliedAt: number | null
  tier: Tier
}

export type DocKind = 'resume' | 'cover_letter' | 'outreach'

export type DocSummary = {
  id: string
  jobId: string
  kind: DocKind
  status: 'pending' | 'ready' | 'failed'
  error: string
  gmailDraftId?: string | null
  updatedAt: number
}

export type SavedAnswer = { key: string; question: string; answer: string; updatedAt: number }

export const getMe = () => api<Me>('/me')
export const getHelperStatus = () => api<HelperStatus>('/helper/status')
export const getJobs = () => api<{ jobs: Job[]; cutoffs: { closest: number; reach: number } }>('/jobs')
export const getDocuments = () => api<{ documents: DocSummary[] }>('/documents')
export const getDocument = (id: string) => api<DocSummary & { content: string }>(`/documents/${id}`)
export const getAnswers = () => api<{ answers: SavedAnswer[] }>('/answers')

export type AppStatus = 'applied' | 'in_review' | 'assessment' | 'interview' | 'offer' | 'rejected'

export type AppliedJob = {
  id: string
  title: string
  company: string
  location: string
  url: string
  source: string
  score: number
  appliedAt: number
  status: AppStatus
  displayStatus: AppStatus | 'no_reply'
  statusAt: number | null
  needsReview: boolean
  suggestedStatus: AppStatus | null
  lastUpdate: { source: 'gmail' | 'manual'; quote: string; subject: string; emailDate: number | null } | null
}

export const getApplied = () => api<{ jobs: AppliedJob[] }>('/applied')

export type InsightsContent = {
  total: number
  summary: string
  jobs: Array<{ jobId: string; why: string }>
  gaps: Array<{ name: string; count: number }>
  longTerm: Array<{ name: string; count: number }>
  projects: Array<{ title: string; what: string; closes: string[]; size: string; resumeLine: string }>
}

export type Insights = {
  status: 'none' | 'pending' | 'ready' | 'failed'
  error: string
  updatedAt: number | null
  content: InsightsContent | null
  jobs: Array<{ id: string; title: string; company: string; url: string; outcome: 'rejected' | 'no_reply' }>
  newSinceAnalysis: number
}

export const getInsights = () => api<Insights>('/insights')

export type UsageKind = 'search' | 'resume' | 'cover_letter' | 'outreach' | 'insights' | 'gmail'
export type UsageEntry = { kind: UsageKind; aiRequests: number; at: number }

export const getUsage = () => api<{ entries: UsageEntry[] }>('/usage')
