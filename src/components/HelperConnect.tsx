import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, getHelperStatus, type HelperStatus } from '../api'
import { formatWhen, lastRunSentence, scheduleSentence } from '../lib/helperText'

type Code = { code: string; expiresAt: number }

export function HelperConnect({ onConnected }: { onConnected: () => void }) {
  const [status, setStatus] = useState<HelperStatus | null>(null)
  const [code, setCode] = useState<Code | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => getHelperStatus().then(setStatus), [])

  useEffect(() => {
    let active = true
    getHelperStatus()
      .then((next) => active && setStatus(next))
      .catch(() => active && setError("Couldn't load your computer's status. Refresh to try again."))
    return () => {
      active = false
    }
  }, [])

  const connected = Boolean(status?.devices.length)

  // While a code is showing, check every few seconds whether the helper has used it.
  useEffect(() => {
    if (!code || connected) return
    const timer = window.setInterval(async () => {
      const next = await getHelperStatus().catch(() => null)
      if (next) setStatus(next)
      if (next?.devices.length) {
        setCode(null)
        onConnected()
      } else if (Date.now() > code.expiresAt) setCode(null)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [code, connected, onConnected])

  async function getCode() {
    setError('')
    setBusy(true)
    try {
      setCode(await api<Code>('/helper/pairing-code', { method: 'POST' }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect your computer? Daily searches will stop until you connect again.')) return
    setBusy(true)
    try {
      await api('/helper/devices', { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const command = code ? `node helper/jobpot.mjs pair ${code.code}` : ''
  async function copy() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section aria-labelledby="computer-heading" className="computer">
      <h2 id="computer-heading">Your computer</h2>
      {!status && !error && <p className="muted">Loading…</p>}

      {status && connected && (
        <>
          <p className="computer-state">
            <span className="dot" aria-hidden="true" /> Connected: {status.devices[0].name}
            <span className="muted"> · last active {formatWhen(status.devices[0].lastUsedAt)}</span>
          </p>
          <p>
            {status.settings
              ? scheduleSentence(status.settings)
              : 'Say "jobpot!" to your AI agent in the Jobpot folder to set up your daily search.'}
          </p>
          {status.lastRun && <p className="muted">{lastRunSentence(status.lastRun)}</p>}
          <div className="actions">
            <button type="button" className="button button-quiet" onClick={disconnect} disabled={busy}>
              Disconnect
            </button>
          </div>
        </>
      )}

      {status && !connected && !code && (
        <>
          <p>
            Jobpot searches for jobs from your own computer, using your AI agent. Connect it once and the search runs
            every morning on its own.
          </p>
          <div className="actions">
            <button type="button" className="button button-primary" onClick={getCode} disabled={busy}>
              {busy ? 'One moment…' : 'Connect your computer'}
            </button>
          </div>
        </>
      )}

      {code && !connected && (
        <div className="pairing">
          <p className="pairing-code" aria-label={`Connection code ${code.code.split('').join(' ')}`}>
            {code.code}
          </p>
          <ol className="pairing-steps">
            <li>
              Open Terminal in your Jobpot folder and run:
              <span className="command-row">
                <code>{command}</code>
                <button type="button" className="button button-quiet" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </span>
            </li>
            <li>Then say "jobpot!" to your AI agent to choose when the daily search runs.</li>
          </ol>
          <p className="muted" role="status">
            Waiting for your computer… This code works once and expires at{' '}
            {new Date(code.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
          </p>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
