import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, getInsights, type Insights } from '../api'
import { formatWhen } from '../lib/helperText'
import { HelperOffline, helperOnline, refreshInsights } from '../lib/helperClient'

const HELPER_OFFLINE =
  'Jobpot needs its helper running on this computer. Open Terminal in your Jobpot folder and run: node helper/jobpot.mjs service install'

export function InsightsTab() {
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(() => getInsights().then(setData), [])

  useEffect(() => {
    let active = true
    getInsights()
      .then((d) => active && setData(d))
      .catch(() => active && setError("Couldn't load your insights. Refresh to try again."))
    return () => {
      active = false
    }
  }, [])

  const pending = data?.status === 'pending'
  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => load().catch(() => {}), 5000)
    return () => window.clearInterval(timer)
  }, [pending, load])

  async function refresh() {
    setNotice('')
    if (!(await helperOnline())) return setNotice(HELPER_OFFLINE)
    try {
      await api('/insights/refresh', { method: 'POST' })
      await refreshInsights()
      await load()
    } catch (err) {
      setNotice(err instanceof HelperOffline ? HELPER_OFFLINE : err instanceof ApiError ? err.message : (err as Error).message)
    }
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    )
  }
  if (!data) return <p className="muted">Loading…</p>

  if (!data.jobs.length) {
    return (
      <div className="empty">
        <p className="empty-title">Nothing to analyze yet</p>
        <p className="muted">
          When applications are rejected or go 30 days without a reply, Jobpot looks for patterns in what those jobs
          asked for and suggests portfolio projects to close the gaps.
        </p>
      </div>
    )
  }

  const rejected = data.jobs.filter((j) => j.outcome === 'rejected').length
  const quiet = data.jobs.length - rejected
  const content = data.content
  const jobsById = new Map(data.jobs.map((j) => [j.id, j]))

  return (
    <div className="insights">
      <div className="insights-head">
        <p className="muted">
          Based on {data.jobs.length} {data.jobs.length === 1 ? 'application' : 'applications'}
          {rejected ? ` · ${rejected} rejected` : ''}
          {quiet ? ` · ${quiet} with no reply after 30 days` : ''}
          {data.updatedAt && data.status === 'ready' ? ` · updated ${formatWhen(data.updatedAt)}` : ''}
        </p>
        <button type="button" className="button button-quiet button-small" onClick={refresh} disabled={pending}>
          {pending ? 'Analyzing…' : content ? 'Refresh insights' : 'Analyze my applications'}
        </button>
      </div>
      {pending && (
        <p className="muted fine-print" role="status">
          Your AI agent is reading these jobs on your computer. It usually takes 2–5 minutes.
        </p>
      )}
      {data.status === 'failed' && data.error && <p className="error">{data.error}</p>}
      {notice && (
        <p className="error" role="alert">
          {notice}
        </p>
      )}
      {data.newSinceAnalysis > 0 && content && !pending && (
        <p className="muted">
          {data.newSinceAnalysis} new {data.newSinceAnalysis === 1 ? 'application' : 'applications'} since this analysis.
          It refreshes after your next daily search, or refresh it now.
        </p>
      )}

      {!content && !pending && data.status !== 'failed' && (
        <div className="empty">
          <p className="empty-title">Ready to analyze</p>
          <p className="muted">Click Analyze my applications to find common gaps and project ideas.</p>
        </div>
      )}

      {content && (
        <>
          {content.summary && <p className="insights-summary">{content.summary}</p>}

          {!content.gaps.length && !content.projects.length && (
            <p className="muted">
              No clear pattern yet. Gaps and project ideas appear once several jobs share the same missing requirements.
            </p>
          )}

          {content.gaps.length > 0 && (
            <section aria-labelledby="gaps-heading" className="insights-section">
              <h2 id="gaps-heading">Common gaps</h2>
              <ul className="gap-list">
                {content.gaps.map((gap) => (
                  <li key={gap.name}>
                    <span className="gap-name">{gap.name}</span>
                    <span className="gap-bar" aria-hidden="true">
                      <span style={{ width: `${Math.round((gap.count / content.total) * 100)}%` }} />
                    </span>
                    <span className="gap-count">
                      {gap.count} of {content.total} jobs
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {content.projects.length > 0 && (
            <section aria-labelledby="projects-heading" className="insights-section">
              <h2 id="projects-heading">Projects to close the gaps</h2>
              <ul className="project-list">
                {content.projects.map((p) => (
                  <li key={p.title} className="project">
                    <div className="project-head">
                      <h3>{p.title}</h3>
                      {p.size && <span className="project-size">{p.size}</span>}
                    </div>
                    <p>{p.what}</p>
                    {p.closes.length > 0 && <p className="muted fine-print">Closes: {p.closes.join(', ')}</p>}
                    {p.resumeLine && (
                      <p className="resume-line">
                        <span className="muted fine-print">Resume line once it’s done</span>
                        {p.resumeLine}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {content.longTerm.length > 0 && (
            <section aria-labelledby="longterm-heading" className="insights-section">
              <h2 id="longterm-heading">Longer-term</h2>
              <p className="muted">Gaps a project can't close quickly, like years of experience.</p>
              <ul className="plain-list">
                {content.longTerm.map((g) => (
                  <li key={g.name}>
                    {g.name} <span className="muted">· {g.count} of {content.total} jobs</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {content.jobs.length > 0 && (
            <section aria-labelledby="why-heading" className="insights-section">
              <h2 id="why-heading">Job by job</h2>
              <ul className="job-list">
                {content.jobs.map((j) => {
                  const job = jobsById.get(j.jobId)
                  if (!job) return null
                  return (
                    <li key={j.jobId} className="why-item">
                      <p>
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          {job.title}
                        </a>{' '}
                        <span className="muted">
                          · {job.company} · {job.outcome === 'rejected' ? 'Rejected' : 'No reply'}
                        </span>
                      </p>
                      <p>{j.why}</p>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
