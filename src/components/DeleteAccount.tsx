import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api'
import { forgetComputer, HelperOffline } from '../lib/helperClient'

export function DeleteAccount({ onDeleted }: { onDeleted: (notice: string) => void }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function remove(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/account', { method: 'DELETE', json: { password } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
      setBusy(false)
      return
    }
    let notice = 'Your account and everything Jobpot saved have been deleted, including Jobpot’s data on this computer.'
    try {
      await forgetComputer()
    } catch (err) {
      notice =
        err instanceof HelperOffline
          ? 'Your account and everything Jobpot saved online have been deleted. The Jobpot helper wasn’t running, so to clear this computer too, run: node helper/jobpot.mjs forget'
          : `Your account and everything Jobpot saved online have been deleted. ${err instanceof Error ? err.message : ''} To clear this computer anyway, run: node helper/jobpot.mjs forget`
    }
    onDeleted(notice)
  }

  return (
    <section aria-labelledby="delete-heading">
      <h2 id="delete-heading">Delete account</h2>
      <p className="muted">
        Permanently deletes your account and everything Jobpot saved: resume, profile, saved answers, jobs, documents,
        insights, and usage. It also clears Jobpot from this computer: Gmail access, the Jobpot browser window and its
        saved logins, run files, and the daily schedule. Gmail drafts and files you downloaded stay. This can’t be undone.
      </p>
      {!open ? (
        <div className="actions">
          <button type="button" className="button button-danger" onClick={() => setOpen(true)}>
            Delete account…
          </button>
        </div>
      ) : (
        <form onSubmit={remove} className="stack danger-zone">
          <div className="field">
            <label htmlFor="delete-password">Enter your password to confirm</label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="button button-danger" disabled={busy || !password}>
              {busy ? 'Deleting…' : 'Delete my account forever'}
            </button>
            <button
              type="button"
              className="button button-quiet"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setPassword('')
                setError('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
