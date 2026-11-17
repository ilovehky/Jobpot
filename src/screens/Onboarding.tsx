import { useState, type FormEvent } from 'react'
import { api, ApiError, type Me } from '../api'
import { ResumeUpload } from '../components/ResumeUpload'
import { TargetsFields, type Targets } from '../components/TargetsFields'

export function Onboarding({ me, onChanged, onSignOut }: { me: Me; onChanged: () => void; onSignOut: () => void }) {
  const step = me.resume ? 2 : 1
  const [targets, setTargets] = useState<Targets>({
    targetTitles: me.profile.targetTitles,
    targetLocations: me.profile.targetLocations,
    workTypes: me.profile.workTypes,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function saveTargets(event: FormEvent) {
    event.preventDefault()
    if (!targets.targetTitles.length || !targets.targetLocations.length) {
      return setError('Add at least one job title and one location.')
    }
    setError('')
    setBusy(true)
    try {
      await api('/profile', { method: 'PUT', json: targets })
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding">
      <header className="topbar">
        <p className="wordmark">Jobpot</p>
        <button type="button" className="link" onClick={onSignOut}>
          Log out
        </button>
      </header>
      <main className="onboarding-body">
        <p className="step">Step {step} of 2</p>
        {step === 1 ? (
          <>
            <h1>Start with your resume</h1>
            <p className="lede">
              Jobpot compares every job it finds against your resume to decide how well it fits you.
            </p>
            <ResumeUpload actionLabel="Upload your resume" onUploaded={onChanged} />
          </>
        ) : (
          <form onSubmit={saveTargets} className="stack">
            <h1>What are you looking for?</h1>
            <p className="lede">
              We read {me.resume?.wordCount.toLocaleString()} words from {me.resume?.fileName}. Tell us which roles and
              places to search for. You can change these anytime in Profile.
            </p>
            <TargetsFields
              value={targets}
              onChange={(next) => {
                setTargets(next)
                setError('')
              }}
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <button className="button button-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save and continue'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
