import type { HelperSettings, HelperStatus } from '../api'

export const SITE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  'company-pages': 'company career pages',
  wellfound: 'Wellfound',
  builtin: 'Built In',
}

const SOURCE_LABELS: Record<string, string> = { ...SITE_LABELS, 'company-pages': 'Company site' }

export function sourceLabel(source: string) {
  const key = source.toLowerCase()
  return SOURCE_LABELS[key] ?? (key.endsWith(' careers') ? 'Company site' : source)
}

export function formatClock(time: string, offsetMinutes = 0) {
  const [h, m] = time.split(':').map(Number)
  const total = (h * 60 + m + offsetMinutes + 24 * 60) % (24 * 60)
  const date = new Date(2000, 0, 1, Math.floor(total / 60), total % 60)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatWhen(ms: number) {
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function scheduleSentence(s: HelperSettings) {
  const sites = s.sites.map((site) => SITE_LABELS[site] ?? site).join(', ')
  return `Every day at ${formatClock(s.searchTime)} (starting ${formatClock(s.searchTime, -10)}), up to ${s.maxMinutes} minutes and ${s.maxJobs} jobs. Searches ${sites}.`
}

const STATUS_TEXT: Record<NonNullable<HelperStatus['lastRun']>['status'], string> = {
  completed: 'finished',
  'time-limit': 'stopped at the time limit',
  'request-limit': 'stopped at the AI request limit',
  failed: "didn't finish",
}

export function lastRunSentence(run: NonNullable<HelperStatus['lastRun']>) {
  const minutes = Math.max(0.1, Math.round((run.finishedAt - run.startedAt) / 6000) / 10)
  const requests = run.aiRequests == null ? '' : `, ${run.aiRequests} AI ${run.aiRequests === 1 ? 'request' : 'requests'}`
  const jobs = `${run.jobsFound} new ${run.jobsFound === 1 ? 'job' : 'jobs'}`
  return `Last search ${formatWhen(run.startedAt)} ${STATUS_TEXT[run.status]}: ${jobs} in ${minutes} min${requests}.`
}
