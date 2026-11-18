import { useCallback, useEffect, useRef, useState } from 'react'
import {
  api,
  ApiError,
  getDocument,
  getDocuments,
  getHelperStatus,
  getJobs,
  type DocKind,
  type DocSummary,
  type HelperStatus,
  type Job,
  type Tier,
} from '../api'
import { documentFileName, documentPdf, downloadBlob } from '../lib/documentPdf'
import { formatClock, lastRunSentence, sourceLabel } from '../lib/helperText'
import {
  blobToBase64,
  HelperOffline,
  helperOnline,
  openApplication,
  saveTypedAnswers,
  writeDocument,
  type ResumeFile,
} from '../lib/helperClient'

const TIERS: Array<{ id: Tier; label: string; hint: string }> = [
  { id: 'closest', label: 'Closest fit', hint: 'Strong matches for your experience' },
  { id: 'reach', label: 'Reach', hint: 'Worth a try, with a gap or two' },
  { id: 'far', label: 'Far reach', hint: 'Big gaps, but possible' },
]

const WORK_TYPE_LABELS: Record<Job['workType'], string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', unknown: '' }
const DOC_LABELS: Record<Exclude<DocKind, 'outreach'>, { noun: string; write: string }> = {
  resume: { noun: 'resume', write: 'Write tailored resume' },
  cover_letter: { noun: 'cover letter', write: 'Write cover letter' },
}
const HELPER_OFFLINE =
  'Jobpot needs its helper running on this computer. Open Terminal in your Jobpot folder and run: node helper/jobpot.mjs service install'

function workTypeLabel(job: Job) {
  const label = WORK_TYPE_LABELS[job.workType]
  return label && !job.location.toLowerCase().includes(label.toLowerCase()) ? label : ''
}

type PdfKind = Exclude<DocKind, 'outreach'>
type Docs = Record<string, Partial<Record<PdfKind, DocSummary>>>

function indexDocs(list: DocSummary[]): Docs {
  const docs: Docs = {}
  for (const doc of list) if (doc.kind !== 'outreach') docs[doc.jobId] = { ...docs[doc.jobId], [doc.kind]: doc }
  return docs
}

async function documentBlob(doc: DocSummary, company: string) {
  const full = await getDocument(doc.id)
  const name = full.content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ''
  const fileName = documentFileName(name, company, doc.kind as PdfKind)
  return { blob: await documentPdf(full.content, fileName.replace(/\.pdf$/, '')), fileName }
}

async function resumeForApplication(job: Job, docs: Docs): Promise<ResumeFile | null> {
  const tailored = docs[job.id]?.resume
  if (tailored?.status === 'ready') {
    const { blob, fileName } = await documentBlob(tailored, job.company)
    return { name: fileName, type: 'application/pdf', base64: await blobToBase64(blob) }
  }
  const response = await fetch('/api/resume/file', { credentials: 'same-origin' })
  if (!response.ok) return null
  const blob = await response.blob()
  const name = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'resume.pdf'
  return { name, type: blob.type, base64: await blobToBase64(blob) }
}

type Notice = { jobId: string; text: string } | null

type DocButtonProps = {
  job: Job
  kind: PdfKind
  doc?: DocSummary
  onWrite: (job: Job, kind: PdfKind) => void
  onDownload: (job: Job, doc: DocSummary) => void
}

function DocButton({ job, kind, doc, onWrite, onDownload }: DocButtonProps) {
  const label = DOC_LABELS[kind]
  if (doc?.status === 'pending') {
    return (
      <button type="button" className="button button-quiet button-small" disabled>
        Writing {label.noun}…
      </button>
    )
  }
  if (doc?.status === 'ready') {
    return (
      <span className="doc-ready">
        <button type="button" className="button button-quiet button-small" onClick={() => onDownload(job, doc)}>
          Download {label.noun}
        </button>
        <button type="button" className="link fine-print" onClick={() => onWrite(job, kind)}>
          Rewrite
        </button>
      </span>
    )
  }
  return (
    <button type="button" className="button button-quiet button-small" onClick={() => onWrite(job, kind)}>
      {doc?.status === 'failed' ? `Try ${label.noun} again` : label.write}
    </button>
  )
}

type JobItemProps = {
  job: Job
  docs?: Partial<Record<PdfKind, DocSummary>>
  notice: Notice
  busy: boolean
  onApply: (job: Job) => void
  onWrite: (job: Job, kind: PdfKind) => void
  onDownload: (job: Job, doc: DocSummary) => void
}

function JobItem({ job, docs, notice, busy, onApply, onWrite, onDownload }: JobItemProps) {
  const failed = [docs?.resume, docs?.cover_letter].find((d) => d?.status === 'failed' && d.error)
  const writing = docs?.resume?.status === 'pending' || docs?.cover_letter?.status === 'pending'
  return (
    <li className={`job tier-${job.tier}`} id={`job-${job.id}`}>
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
        <div className="job-actions">
          <button
            type="button"
            id={`apply-${job.id}`}
            className="button button-primary button-small"
            onClick={() => onApply(job)}
            disabled={busy}
          >
            {busy ? 'Opening…' : 'Apply'}
          </button>
          <DocButton job={job} kind="resume" doc={docs?.resume} onWrite={onWrite} onDownload={onDownload} />
          <DocButton job={job} kind="cover_letter" doc={docs?.cover_letter} onWrite={onWrite} onDownload={onDownload} />
        </div>
        {writing && (
          <p className="muted fine-print" role="status">
            Your AI agent is writing this on your computer. It usually takes 1–3 minutes.
          </p>
        )}
        {failed && <p className="error fine-print">{failed.error}</p>}
        {notice?.jobId === job.id && (
          <p className="error fine-print" role="alert">
            {notice.text}
          </p>
        )}
      </div>
    </li>
  )
}

function AppliedDialog({ job, onAnswer }: { job: Job | null; onAnswer: (applied: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (job && !dialog.open) dialog.showModal()
    if (!job && dialog.open) dialog.close()
  }, [job])
  return (
    <dialog
      ref={ref}
      className="applied-dialog"
      aria-labelledby="applied-title"
      // The user has to answer Yes or No, so Escape doesn't close it.
      onCancel={(event) => event.preventDefault()}
    >
      {job && (
        <>
          <h2 id="applied-title">Applied?</h2>
          <p>
            Finish the application for <strong>{job.title}</strong> at {job.company} in the Jobpot browser window. Did
            you submit it?
          </p>
          <p className="muted fine-print">Answers you typed there are saved either way, so Jobpot can fill them in next time.</p>
          <div className="actions">
            <button type="button" className="button button-primary" onClick={() => onAnswer(true)}>
              Yes, I applied
            </button>
            <button type="button" className="button button-quiet" onClick={() => onAnswer(false)}>
              No, not yet
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}

type Data = { jobs: Job[]; cutoffs: { closest: number; reach: number }; status: HelperStatus }

export function MatchesTab() {
  const [data, setData] = useState<Data | null>(null)
  const [docs, setDocs] = useState<Docs>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [applying, setApplying] = useState<Job | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getJobs(), getHelperStatus(), getDocuments()])
      .then(([jobs, status, documents]) => {
        if (!active) return
        setData({ ...jobs, status })
        setDocs(indexDocs(documents.documents))
      })
      .catch(() => active && setError("Couldn't load your matches. Refresh to try again."))
    return () => {
      active = false
    }
  }, [])

  const hasPending = Object.values(docs).some((d) => d.resume?.status === 'pending' || d.cover_letter?.status === 'pending')
  useEffect(() => {
    if (!hasPending) return
    const timer = window.setInterval(() => {
      getDocuments()
        .then((documents) => setDocs(indexDocs(documents.documents)))
        .catch(() => {})
    }, 5000)
    return () => window.clearInterval(timer)
  }, [hasPending])

  const apply = useCallback(
    async (job: Job) => {
      setNotice(null)
      setMessage('')
      setOpening(job.id)
      try {
        const resume = await resumeForApplication(job, docs)
        await openApplication(job.applyUrl || job.url, resume)
        setApplying(job)
      } catch (err) {
        setNotice({ jobId: job.id, text: err instanceof HelperOffline ? HELPER_OFFLINE : (err as Error).message })
      } finally {
        setOpening(null)
      }
    },
    [docs],
  )

  async function answerApplied(applied: boolean) {
    const job = applying
    if (!job) return
    setApplying(null)
    saveTypedAnswers().catch(() => {})
    if (!applied) {
      document.getElementById(`apply-${job.id}`)?.focus()
      return
    }
    try {
      await api(`/jobs/${job.id}/applied`, { method: 'POST' })
      setData((d) => d && { ...d, jobs: d.jobs.map((j) => (j.id === job.id ? { ...j, appliedAt: Date.now() } : j)) })
      setMessage(`Moved ${job.title} at ${job.company} to Applied.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setNotice({ jobId: job.id, text: err instanceof ApiError ? err.message : 'Couldn’t save that. Try again.' })
    }
  }

  async function write(job: Job, kind: PdfKind) {
    setNotice(null)
    if (!(await helperOnline())) return setNotice({ jobId: job.id, text: HELPER_OFFLINE })
    try {
      const { id } = await api<{ id: string }>(`/jobs/${job.id}/documents`, { json: { kind } })
      const pending: DocSummary = { id, jobId: job.id, kind, status: 'pending', error: '', updatedAt: Date.now() }
      setDocs((d) => ({ ...d, [job.id]: { ...d[job.id], [kind]: pending } }))
      await writeDocument(id)
    } catch (err) {
      const text = err instanceof HelperOffline ? HELPER_OFFLINE : (err as Error).message
      setNotice({ jobId: job.id, text })
      setDocs((d) => {
        const current = d[job.id]?.[kind]
        return current ? { ...d, [job.id]: { ...d[job.id], [kind]: { ...current, status: 'failed', error: '' } } } : d
      })
    }
  }

  async function download(job: Job, doc: DocSummary) {
    try {
      const { blob, fileName } = await documentBlob(doc, job.company)
      downloadBlob(blob, fileName)
    } catch {
      setNotice({ jobId: job.id, text: 'Couldn’t make the PDF. Try again.' })
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

  const { cutoffs, status } = data
  const jobs = data.jobs.filter((job) => !job.appliedAt)
  const itemProps = { notice, onApply: apply, onWrite: write, onDownload: download }

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
      {message && (
        <p className="success" role="status">
          {message} <a href="#applied">See Applied</a>
        </p>
      )}
      {!latest.length && <p>No new jobs from your latest search. Earlier matches are below.</p>}
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
                <JobItem key={job.id} job={job} docs={docs[job.id]} busy={opening === job.id} {...itemProps} />
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
              <JobItem key={job.id} job={job} docs={docs[job.id]} busy={opening === job.id} {...itemProps} />
            ))}
          </ul>
        </details>
      )}
      <AppliedDialog job={applying} onAnswer={answerApplied} />
    </div>
  )
}
