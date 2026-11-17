import { useEffect, useState } from 'react'
import { getHelperStatus, getJobs, type HelperStatus, type Job, type Tier } from '../api'
import { formatClock, lastRunSentence, sourceLabel } from '../lib/helperText'

const TIERS: Array<{ id: Tier; label: string; hint: string }> = [
  { id: 'closest', label: 'Closest fit', hint: 'Strong matches for your experience' },
  { id: 'reach', label: 'Reach', hint: 'Worth a try, with a gap or two' },
  { id: 'far', label: 'Far reach', hint: 'Big gaps, but possible' },
]

const WORK_TYPE_LABELS: Record<Job['workType'], string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  unknown: '',
}

function workTypeLabel(job: Job) {
  const label = WORK_TYPE_LABELS[job.workType]
  return label && !job.location.toLowerCase().includes(label.toLowerCase()) ? label : ''
}

type Data = { jobs: Job[]; cutoffs: { closest: number; reach: number }; status: HelperStatus }

function JobItem({ job }: { job: Job }) {
  return (
    <li className={`job tier-${job.tier}`}>
      <p className="score" aria-label={`Fit score ${job.score} out of 100`}>
        {job.score}
      </p>
      <div className="job-body">
        <h3>
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            {job.title}
          </a>
        </h3>
        <p className="job-meta">
          {[job.company, job.location, workTypeLabel(job), sourceLabel(job.source)].filter(Boolean).join(' · ')}
        </p>
        <p className="job-reason">{job.reason}</p>
      </div>
    </li>
  )
}

export function MatchesTab() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getJobs(), getHelperStatus()])
      .then(([jobs, status]) => active && setData({ ...jobs, status }))
      .catch(() => active && setError("Couldn't load your matches. Refresh to try again."))
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    )
  }
  if (!data) return <p className="muted">Loading…</p>

  const { jobs, cutoffs, status } = data
  if (!jobs.length) {
    const connected = status.devices.length > 0
    return (
      <div className="empty">
        <p className="empty-title">No matches yet</p>
        <p className="muted">
          {!connected ? (
            <>
              Connect your computer in <a href="#profile">Profile</a> to start your daily search.
            </>
          ) : status.settings ? (
            `Your next search starts at ${formatClock(status.settings.searchTime, -10)}. Matches will appear here, sorted into closest fit, reach, and far reach.`
          ) : (
            'Say "jobpot!" to your AI agent to set up your daily search.'
          )}
        </p>
      </div>
    )
  }

  const latestId = status.lastRun?.id
  const latest = jobs.filter((job) => job.runId === latestId)
  const earlier = jobs.filter((job) => job.runId !== latestId)
  const ranges: Record<Tier, string> = {
    closest: `${cutoffs.closest}+`,
    reach: `${cutoffs.reach}–${cutoffs.closest - 1}`,
    far: `under ${cutoffs.reach}`,
  }

  return (
    <div className="matches">
      {status.lastRun && <p className="muted">{lastRunSentence(status.lastRun)}</p>}
      {!latest.length && <p>Your latest search didn't find any new jobs. Earlier matches are below.</p>}
      {TIERS.map((tier) => {
        const group = latest.filter((job) => job.tier === tier.id)
        if (!group.length) return null
        return (
          <section key={tier.id} aria-labelledby={`tier-${tier.id}`} className="tier">
            <header className="tier-header">
              <h2 id={`tier-${tier.id}`}>
                {tier.label} <span className="tier-count">{group.length}</span>
              </h2>
              <p className="muted">
                {tier.hint} · score {ranges[tier.id]}
              </p>
            </header>
            <ul className="job-list">
              {group.map((job) => (
                <JobItem key={job.id} job={job} />
              ))}
            </ul>
          </section>
        )
      })}
      {earlier.length > 0 && (
        <details className="earlier" open={!latest.length}>
          <summary>
            Earlier matches <span className="tier-count">{earlier.length}</span>
          </summary>
          <ul className="job-list">
            {earlier.map((job) => (
              <JobItem key={job.id} job={job} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
