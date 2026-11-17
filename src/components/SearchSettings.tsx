import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError, getHelperStatus, type HelperSettings } from '../api'
import { SITE_LABELS, formatClock } from '../lib/helperText'

type Form = {
  maxJobs: string
  maxMinutes: string
  maxRequests: string
  sites: string[]
  closestCutoff: string
  reachCutoff: string
}

function toForm(s: HelperSettings): Form {
  return {
    maxJobs: String(s.maxJobs),
    maxMinutes: String(s.maxMinutes),
    maxRequests: s.maxRequests == null ? '' : String(s.maxRequests),
    sites: s.sites,
    closestCutoff: String(s.closestCutoff),
    reachCutoff: String(s.reachCutoff),
  }
}

function NumberField(props: { id: string; label: string; hint: string; value: string; min: number; max: number; optional?: boolean; onChange: (v: string) => void }) {
  return (
    <div className="field number-field">
      <label htmlFor={props.id}>{props.label}</label>
      <p className="hint" id={`${props.id}-hint`}>
        {props.hint}
      </p>
      <input
        id={props.id}
        type="number"
        inputMode="numeric"
        min={props.min}
        max={props.max}
        required={!props.optional}
        aria-describedby={`${props.id}-hint`}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  )
}

export function SearchSettings() {
  const [settings, setSettings] = useState<HelperSettings | null | undefined>(undefined)
  const [form, setForm] = useState<Form | null>(null)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    getHelperStatus()
      .then((status) => {
        if (!active) return
        setSettings(status.settings)
        if (status.settings) setForm(toForm(status.settings))
      })
      .catch(() => active && setSettings(null))
    return () => {
      active = false
    }
  }, [])

  if (!settings || !form) return null

  const set = (patch: Partial<Form>) => {
    setForm({ ...form, ...patch })
    setMessage(null)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    if (!form.sites.length) return setMessage({ kind: 'error', text: 'Pick at least one job site.' })
    setBusy(true)
    try {
      await api('/settings', {
        method: 'PUT',
        json: {
          maxJobs: Number(form.maxJobs),
          maxMinutes: Number(form.maxMinutes),
          maxRequests: form.maxRequests.trim() ? Number(form.maxRequests) : null,
          sites: form.sites,
          closestCutoff: Number(form.closestCutoff),
          reachCutoff: Number(form.reachCutoff),
        },
      })
      setMessage({ kind: 'success', text: 'Saved. Your next search uses these settings.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  const toggleSite = (site: string) =>
    set({ sites: form.sites.includes(site) ? form.sites.filter((s) => s !== site) : [...form.sites, site] })

  return (
    <form onSubmit={save} className="stack" aria-labelledby="search-heading">
      <h2 id="search-heading">Daily search</h2>
      <p className="muted">
        Runs every day at {formatClock(settings.searchTime)}. To change the time, say "jobpot!" to your AI agent so it
        can update your computer's schedule.
      </p>
      <div className="number-grid">
        <NumberField id="max-jobs" label="Jobs per day" hint="1 to 100" min={1} max={100} value={form.maxJobs} onChange={(v) => set({ maxJobs: v })} />
        <NumberField id="max-minutes" label="Time limit (minutes)" hint="1 to 60" min={1} max={60} value={form.maxMinutes} onChange={(v) => set({ maxMinutes: v })} />
        <NumberField id="max-requests" label="AI request limit" hint="Leave empty for no limit" min={1} max={500} optional value={form.maxRequests} onChange={(v) => set({ maxRequests: v })} />
      </div>
      <fieldset className="field">
        <legend>Job sites</legend>
        <div className="toggles">
          {Object.entries(SITE_LABELS).map(([site, label]) => (
            <label key={site} className="toggle">
              <input type="checkbox" checked={form.sites.includes(site)} onChange={() => toggleSite(site)} />
              <span>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="number-grid">
        <NumberField id="closest-cutoff" label="Closest fit from" hint="Score out of 100" min={1} max={100} value={form.closestCutoff} onChange={(v) => set({ closestCutoff: v })} />
        <NumberField id="reach-cutoff" label="Reach from" hint="Below this is Far reach" min={0} max={99} value={form.reachCutoff} onChange={(v) => set({ reachCutoff: v })} />
      </div>
      {message && (
        <p className={message.kind === 'error' ? 'error' : 'success'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <div className="actions">
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save search settings'}
        </button>
      </div>
    </form>
  )
}
