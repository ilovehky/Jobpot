import { useCallback, useEffect, useState } from 'react'
import {
  api,
  ApiError,
  getApplied,
  getDocument,
  getDocuments,
  type AppliedJob,
  type AppStatus,
  type DocSummary,
} from '../api'
import { formatWhen, sourceLabel } from '../lib/helperText'
import {
  checkGmail,
  connectGmail,
  disconnectGmail,
  getGmailStatus,
  HelperOffline,
  helperOnline,
  writeDocument,
  type GmailStatus,
} from '../lib/helperClient'

const STATUS_LABELS: Record<AppStatus | 'no_reply', string> = {
  applied: 'Applied',
  in_review: 'In review',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  no_reply: 'No reply (30+ days)',
}
const PIPELINE: Array<AppStatus | 'no_reply'> = ['applied', 'in_review', 'assessment', 'interview', 'offer', 'rejected', 'no_reply']
const EDITABLE: AppStatus[] = ['applied', 'in_review', 'assessment', 'interview', 'offer', 'rejected']
const HELPER_OFFLINE =
  'Jobpot needs its helper running on this computer. Open Terminal in your Jobpot folder and run: node helper/jobpot.mjs service install'

function parseOutreach(content: string) {
  const part = (name: string) => content.match(new RegExp(`===${name}===\\s*([\\s\\S]*?)\\s*(?====[A-Z ]+===|$)`))?.[1]?.trim() ?? ''
  return { linkedin: part('LINKEDIN'), subject: part('SUBJECT'), email: part('EMAIL') }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="button button-quiet button-small"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}

function Outreach({ doc }: { doc: DocSummary & { content?: string } }) {
  const [content, setContent] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getDocument(doc.id).then((full) => active && setContent(full.content)).catch(() => {})
    return () => {
      active = false
    }
  }, [doc.id, doc.updatedAt])
  if (!content) return null
  const parts = parseOutreach(content)
  return (
    <div className="outreach">
      <div className="outreach-part">
        <p className="outreach-label">LinkedIn note ({parts.linkedin.length} characters)</p>
        <p className="outreach-text">{parts.linkedin}</p>
        <CopyButton text={parts.linkedin} label="Copy note" />
      </div>
      <div className="outreach-part">
        <p className="outreach-label">Email: {parts.subject}</p>
        <p className="outreach-text">{parts.email}</p>
        <div className="job-actions">
          {doc.gmailDraftId ? (
            <a className="button button-quiet button-small" href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noopener noreferrer">
              Open Gmail drafts
            </a>
          ) : null}
          <CopyButton text={`${parts.subject}\n\n${parts.email}`} label="Copy email" />
        </div>
        <p className="muted fine-print">
          {doc.gmailDraftId
            ? 'Saved as a draft in your Gmail with no recipient. Add who it’s to, review it, and send it yourself.'
            : doc.error || 'Connect Gmail to save this as a draft automatically.'}
        </p>
      </div>
    </div>
  )
}

function GmailCard({ status, onChange }: { status: GmailStatus | 'offline' | null; onChange: () => void }) {
  const [busy, setBusy] = useState<'' | 'connect' | 'check' | 'disconnect'>('')
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  async function run(kind: 'connect' | 'check' | 'disconnect') {
    setBusy(kind)
    setMessage(null)
    try {
      if (kind === 'connect') {
        const out = await connectGmail()
        setMessage({ kind: 'success', text: `Connected ${out.email}. Checking for updates…` })
        const result = await checkGmail()
        setMessage({ kind: 'success', text: `Connected ${out.email}. ${result.updates} status ${result.updates === 1 ? 'update' : 'updates'} found.` })
      } else if (kind === 'check') {
        const result = await checkGmail()
        setMessage({
          kind: 'success',
          text: `Checked ${result.emailsRead} new ${result.emailsRead === 1 ? 'email' : 'emails'}: ${result.updates} status ${result.updates === 1 ? 'update' : 'updates'}.`,
        })
      } else {
        if (!window.confirm('Disconnect Gmail? Jobpot will stop updating statuses from your email.')) return
        await disconnectGmail()
      }
      onChange()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof HelperOffline ? HELPER_OFFLINE : (err as Error).message })
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="gmail-card" aria-labelledby="gmail-heading">
      <h2 id="gmail-heading">Gmail</h2>
      {status === null && <p className="muted">Checking…</p>}
      {status === 'offline' && <p className="muted">{HELPER_OFFLINE}</p>}
      {status && status !== 'offline' && !status.connected && (
        <>
          <p>
            Connect Gmail so Jobpot can update each application from replies, and save outreach messages as drafts. Your
            email is read on this computer only; Jobpot keeps just the status and one short line from each update.
          </p>
          <div className="actions">
            <button type="button" className="button button-primary" onClick={() => run('connect')} disabled={!!busy}>
              {busy === 'connect' ? 'Waiting for Google sign-in…' : 'Connect Gmail'}
            </button>
          </div>
        </>
      )}
      {status && status !== 'offline' && status.connected && (
        <>
          <p className="computer-state">
            <span className="dot" aria-hidden="true" /> Connected: {status.email}
            <span className="muted">
              {' '}
              · {status.lastCheckedAt ? `last checked ${formatWhen(status.lastCheckedAt)}` : 'not checked yet'}
            </span>
          </p>
          <p className="muted">Checked automatically during your daily search.</p>
          <div className="actions">
            <button type="button" className="button button-primary button-small" onClick={() => run('check')} disabled={!!busy}>
              {busy === 'check' ? 'Checking Gmail…' : 'Check Gmail now'}
            </button>
            <button type="button" className="button button-quiet button-small" onClick={() => run('disconnect')} disabled={!!busy}>
              Disconnect
            </button>
          </div>
        </>
      )}
      {message && (
        <p className={message.kind === 'error' ? 'error' : 'success'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  )
}

export function AppliedTab() {
  const [jobs, setJobs] = useState<AppliedJob[] | null>(null)
  const [docs, setDocs] = useState<Record<string, DocSummary>>({})
  const [gmail, setGmail] = useState<GmailStatus | 'offline' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ jobId: string; text: string } | null>(null)
  const [filter, setFilter] = useState<AppStatus | 'no_reply' | 'all'>('all')

  const load = useCallback(async () => {
    const [applied, documents] = await Promise.all([getApplied(), getDocuments()])
    setJobs(applied.jobs)
    setDocs(Object.fromEntries(documents.documents.filter((d) => d.kind === 'outreach').map((d) => [d.jobId, d])))
  }, [])

  const loadGmail = useCallback(() => {
    getGmailStatus()
      .then(setGmail)
      .catch(() => setGmail('offline'))
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getApplied(), getDocuments()])
      .then(([applied, documents]) => {
        if (!active) return
        setJobs(applied.jobs)
        setDocs(Object.fromEntries(documents.documents.filter((d) => d.kind === 'outreach').map((d) => [d.jobId, d])))
      })
      .catch(() => active && setError("Couldn't load your applications. Refresh to try again."))
    getGmailStatus()
      .then((s) => active && setGmail(s))
      .catch(() => active && setGmail('offline'))
    return () => {
      active = false
    }
  }, [])

  const pending = Object.values(docs).some((d) => d.status === 'pending')
  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => {
      getDocuments()
        .then((documents) =>
          setDocs(Object.fromEntries(documents.documents.filter((d) => d.kind === 'outreach').map((d) => [d.jobId, d]))),
        )
        .catch(() => {})
    }, 5000)
    return () => window.clearInterval(timer)
  }, [pending])

  async function setStatus(job: AppliedJob, status: AppStatus) {
    try {
      await api(`/jobs/${job.id}/status`, { method: 'PUT', json: { status } })
      await load()
    } catch (err) {
      setNotice({ jobId: job.id, text: err instanceof ApiError ? err.message : 'Couldn’t save that. Try again.' })
    }
  }

  async function undo(job: AppliedJob) {
    try {
      await api(`/jobs/${job.id}/applied`, { method: 'DELETE' })
      await load()
    } catch {
      setNotice({ jobId: job.id, text: 'Couldn’t move that job back. Try again.' })
    }
  }

  async function draft(job: AppliedJob) {
    setNotice(null)
    if (!(await helperOnline())) return setNotice({ jobId: job.id, text: HELPER_OFFLINE })
    try {
      const { id } = await api<{ id: string }>(`/jobs/${job.id}/documents`, { json: { kind: 'outreach' } })
      setDocs((d) => ({ ...d, [job.id]: { id, jobId: job.id, kind: 'outreach', status: 'pending', error: '', updatedAt: Date.now() } }))
      await writeDocument(id)
    } catch (err) {
      setNotice({ jobId: job.id, text: err instanceof HelperOffline ? HELPER_OFFLINE : (err as Error).message })
    }
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    )
  }
  if (!jobs) return <p className="muted">Loading…</p>

  const counts = PIPELINE.map((s) => [s, jobs.filter((j) => j.displayStatus === s).length] as const)
  const shown = filter === 'all' ? jobs : jobs.filter((j) => j.displayStatus === filter)

  return (
    <div className="matches">
      <GmailCard status={gmail} onChange={() => {
        loadGmail()
        load().catch(() => {})
      }} />

      {!jobs.length ? (
        <div className="empty">
          <p className="empty-title">No applications yet</p>
          <p className="muted">When you apply from Matches and confirm you submitted, the job shows up here.</p>
        </div>
      ) : (
        <>
          <div className="pipeline" role="group" aria-label="Filter by status">
            <button type="button" className="pill" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              All <span>{jobs.length}</span>
            </button>
            {counts
              .filter(([, n]) => n > 0)
              .map(([s, n]) => (
                <button key={s} type="button" className={`pill pill-${s}`} aria-pressed={filter === s} onClick={() => setFilter(s)}>
                  {STATUS_LABELS[s]} <span>{n}</span>
                </button>
              ))}
          </div>

          <ul className="job-list">
            {shown.map((job) => {
              const doc = docs[job.id]
              return (
                <li key={job.id} className="job applied-job">
                  <span className={`status status-${job.displayStatus}`}>{STATUS_LABELS[job.displayStatus]}</span>
                  <div className="job-body">
                    <h3>
                      <a href={job.url} target="_blank" rel="noopener noreferrer">
                        {job.title}
                      </a>
                    </h3>
                    <p className="job-meta">
                      {[job.company, job.location, sourceLabel(job.source)].filter(Boolean).join(' · ')} · applied{' '}
                      {new Date(job.appliedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                    {job.lastUpdate?.source === 'gmail' && !job.needsReview && (
                      <p className="job-reason">
                        <span className="muted">
                          Email{job.lastUpdate.emailDate ? `, ${formatWhen(job.lastUpdate.emailDate)}` : ''}:
                        </span>{' '}
                        “{job.lastUpdate.quote}”
                      </p>
                    )}
                    {job.needsReview && job.suggestedStatus && (
                      <div className="review">
                        <p>
                          An email might mean <strong>{STATUS_LABELS[job.suggestedStatus]}</strong>
                          {job.lastUpdate?.quote ? `: “${job.lastUpdate.quote}”` : '.'} Is that right?
                        </p>
                        <div className="job-actions">
                          <button type="button" className="button button-primary button-small" onClick={() => setStatus(job, job.suggestedStatus!)}>
                            Yes, mark {STATUS_LABELS[job.suggestedStatus]}
                          </button>
                          <button type="button" className="button button-quiet button-small" onClick={() => setStatus(job, job.status)}>
                            No, keep {STATUS_LABELS[job.status]}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="job-actions">
                      <label className="status-select">
                        <span className="visually-hidden">Status for {job.title}</span>
                        <select value={job.status} onChange={(e) => setStatus(job, e.target.value as AppStatus)}>
                          {EDITABLE.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {doc?.status === 'pending' ? (
                        <button type="button" className="button button-quiet button-small" disabled>
                          Writing message…
                        </button>
                      ) : (
                        <button type="button" className="button button-quiet button-small" onClick={() => draft(job)}>
                          {doc?.status === 'ready' ? 'Rewrite message' : doc?.status === 'failed' ? 'Try message again' : 'Draft message'}
                        </button>
                      )}
                      <button type="button" className="link fine-print" onClick={() => undo(job)}>
                        Move back to Matches
                      </button>
                    </div>
                    {doc?.status === 'pending' && (
                      <p className="muted fine-print" role="status">
                        Your AI agent is writing a LinkedIn note and an email. It usually takes 1–3 minutes.
                      </p>
                    )}
                    {doc?.status === 'failed' && doc.error && <p className="error fine-print">{doc.error}</p>}
                    {doc?.status === 'ready' && <Outreach doc={doc} />}
                    {notice?.jobId === job.id && (
                      <p className="error fine-print" role="alert">
                        {notice.text}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
