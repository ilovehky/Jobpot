import { useState, type FormEvent } from 'react'
import { api, ApiError, type Me } from '../api'
import { DeleteAccount } from '../components/DeleteAccount'
import { HelperConnect } from '../components/HelperConnect'
import { ResumeUpload } from '../components/ResumeUpload'
import { SavedAnswers } from '../components/SavedAnswers'
import { SearchSettings } from '../components/SearchSettings'
import { SelfIdentification } from '../components/SelfIdentification'
import { TargetsFields, type Targets } from '../components/TargetsFields'
import { UsageReport } from '../components/UsageReport'

function formatSize(bytes: number) {
  return bytes < 1_000_000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`
}

type Props = { me: Me; onChanged: () => void; onDeleted: (notice: string) => void }

export function ProfileTab({ me, onChanged, onDeleted }: Props) {
  const [name, setName] = useState(me.user.name)
  const [portfolioUrl, setPortfolioUrl] = useState(me.profile.portfolioUrl)
  const [linkedinUrl, setLinkedinUrl] = useState(me.profile.linkedinUrl)
  const [targets, setTargets] = useState<Targets>({
    targetTitles: me.profile.targetTitles,
    targetLocations: me.profile.targetLocations,
    workTypes: me.profile.workTypes,
  })
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [replacing, setReplacing] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!targets.targetTitles.length || !targets.targetLocations.length) {
      return setMessage({ kind: 'error', text: 'Keep at least one job title and one location.' })
    }
    setMessage(null)
    setBusy(true)
    try {
      await api('/profile', { method: 'PUT', json: { name, portfolioUrl, linkedinUrl, ...targets } })
      setMessage({ kind: 'success', text: 'Changes saved.' })
      onChanged()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  const resume = me.resume
  return (
    <div className="profile">
      <section className="profile-summary" aria-labelledby="summary-heading">
        <h2 id="summary-heading">Summary</h2>
        {me.profile.summary ? (
          <>
            <p>{me.profile.summary}</p>
            {me.profile.summaryUpdatedAt && (
              <p className="muted fine-print">
                Written by your AI agent from your resume on{' '}
                {new Date(me.profile.summaryUpdatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}.
              </p>
            )}
          </>
        ) : (
          <p className="muted">
            Your AI agent writes a short summary of your experience during your first daily search.
          </p>
        )}
      </section>

      <HelperConnect onConnected={onChanged} />
      <SearchSettings />
      <UsageReport />

      <section aria-labelledby="resume-heading">
        <h2 id="resume-heading">Resume</h2>
        {resume && (
          <div className="resume-row">
            <div>
              <p className="resume-name">{resume.fileName}</p>
              <p className="muted">
                Uploaded {new Date(resume.uploadedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}, with{' '}
                {resume.wordCount.toLocaleString()} words read ({formatSize(resume.size)})
              </p>
            </div>
            <div className="resume-actions">
              <a className="button button-quiet" href="/api/resume/file">
                Download
              </a>
              <button type="button" className="button button-quiet" onClick={() => setReplacing((r) => !r)}>
                {replacing ? 'Cancel' : 'Replace'}
              </button>
            </div>
          </div>
        )}
        {replacing && (
          <ResumeUpload
            actionLabel="Upload a new resume"
            onUploaded={() => {
              setReplacing(false)
              onChanged()
            }}
          />
        )}
      </section>

      <form onSubmit={save} className="stack" aria-labelledby="details-heading">
        <h2 id="details-heading">Your details</h2>
        <div className="field">
          <label htmlFor="profile-name">Name</label>
          <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" value={me.user.email} readOnly aria-readonly="true" />
        </div>
        <div className="field">
          <label htmlFor="portfolio">Portfolio link</label>
          <input
            id="portfolio"
            type="url"
            placeholder="https://"
            value={portfolioUrl}
            onChange={(e) => setPortfolioUrl(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="linkedin">LinkedIn link</label>
          <input
            id="linkedin"
            type="url"
            placeholder="https://www.linkedin.com/in/"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
        </div>

        <h2>Job search</h2>
        <TargetsFields value={targets} onChange={setTargets} />

        {message && (
          <p className={message.kind === 'error' ? 'error' : 'success'} role={message.kind === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
        <div className="actions">
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
      <SelfIdentification me={me} onChanged={onChanged} />
      <SavedAnswers />
      <DeleteAccount onDeleted={onDeleted} />
    </div>
  )
}
