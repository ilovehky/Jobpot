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

type Data = { jobs: Job[]; status: HelperStatus }

export function MatchesTab() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getJobs(), getHelperStatus()])
      .then(([jobs, status]) => active && setData({ jobs: jobs.jobs, status }))
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

  const { jobs, status } = data
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

  return (
    <div className="matches">
      {status.lastRun && <p className="muted">{lastRunSentence(status.lastRun)}</p>}
      {TIERS.map((tier) => {
        const group = jobs.filter((job) => job.tier === tier.id)
        if (!group.length) return null
        return (
          <section key={tier.id} aria-labelledby={`tier-${tier.id}`} className={`tier tier-${tier.id}`}>
            <header className="tier-header">
              <h2 id={`tier-${tier.id}`}>
                {tier.label} <span className="tier-count">{group.length}</span>
              </h2>
              <p className="muted">{tier.hint}</p>
            </header>
            <ul className="job-list">
              {group.map((job) => (
                <li key={job.id} className="job">
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
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
