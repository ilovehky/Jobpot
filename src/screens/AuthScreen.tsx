import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api'

type Mode = 'signup' | 'login'

export function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>('signup')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    setError('')
    setBusy(true)
    try {
      await api(mode === 'signup' ? '/auth/signup' : '/auth/login', { json: data })
      onSignedIn()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
  }

  return (
    <div className="auth">
      <section className="auth-hero" aria-label="About Jobpot">
        <p className="wordmark wordmark-light">Jobpot</p>
        <div className="sunrise" aria-hidden="true">
          <span className="sun" />
          <span className="clock">8:50</span>
        </div>
        <p className="auth-pitch">
          Every morning, Jobpot searches job sites for roles that fit your resume, so your best matches are waiting
          when you start your day.
        </p>
      </section>

      <main className="auth-panel">
        <div className="auth-form-wrap">
          <h1>{mode === 'signup' ? 'Create your account' : 'Log in'}</h1>
          <form onSubmit={onSubmit} className="stack" noValidate={false}>
            {mode === 'signup' && (
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" autoComplete="name" required maxLength={100} />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              {mode === 'signup' && (
                <p className="hint" id="password-hint">
                  At least 8 characters.
                </p>
              )}
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
                minLength={mode === 'signup' ? 8 : undefined}
                required
              />
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Log in'}
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button type="button" className="link" onClick={() => switchMode('login')}>
                  Log in
                </button>
              </>
            ) : (
              <>
                New to Jobpot?{' '}
                <button type="button" className="link" onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </>
            )}
          </p>
          <p className="fine-print">You'll stay logged in on this device for 7 days.</p>
        </div>
      </main>
    </div>
  )
}
