import { useState, type FormEvent } from 'react'
import { api, ApiError, type Me, type SelfId, type SelfIdKey } from '../api'

const DECLINE = { value: 'decline', label: 'Prefer not to say' }

const FIELDS: Array<{ key: SelfIdKey; label: string; options: Array<{ value: string; label: string }> }> = [
  {
    key: 'gender',
    label: 'Gender',
    options: [
      { value: 'female', label: 'Woman' },
      { value: 'male', label: 'Man' },
      { value: 'nonbinary', label: 'Non-binary' },
      DECLINE,
    ],
  },
  {
    key: 'race',
    label: 'Race or ethnicity',
    options: [
      { value: 'hispanic', label: 'Hispanic or Latino' },
      { value: 'white', label: 'White' },
      { value: 'black', label: 'Black or African American' },
      { value: 'asian', label: 'Asian' },
      { value: 'native_american', label: 'American Indian or Alaska Native' },
      { value: 'pacific_islander', label: 'Native Hawaiian or Pacific Islander' },
      { value: 'two_or_more', label: 'Two or more races' },
      DECLINE,
    ],
  },
  {
    key: 'veteran',
    label: 'Veteran status',
    options: [
      { value: 'yes', label: 'I’m a protected veteran' },
      { value: 'no', label: 'I’m not a protected veteran' },
      DECLINE,
    ],
  },
  {
    key: 'disability',
    label: 'Disability',
    options: [
      { value: 'yes', label: 'Yes, I have or had a disability' },
      { value: 'no', label: 'No' },
      DECLINE,
    ],
  },
  {
    key: 'workAuthorized',
    label: 'Authorized to work in the U.S.?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
  {
    key: 'needsSponsorship',
    label: 'Need visa sponsorship, now or later?',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  },
]

export function SelfIdentification({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const [selfId, setSelfId] = useState<SelfId>(me.profile.selfId)
  const [aiConsent, setAiConsent] = useState(me.profile.aiConsent)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await api('/profile/self-id', { method: 'PUT', json: { selfId, aiConsent } })
      setMessage({ kind: 'success', text: 'Saved.' })
      onChanged()
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="stack" aria-labelledby="self-id-heading">
      <h2 id="self-id-heading">Self-identification</h2>
      <p className="muted">
        Optional. Jobpot uses these answers to fill in the voluntary questions on application forms. Leave any of them
        as “Not set” to answer on each form yourself.
      </p>
      <div className="select-grid">
        {FIELDS.map((field) => (
          <div className="field" key={field.key}>
            <label htmlFor={`self-${field.key}`}>{field.label}</label>
            <select
              id={`self-${field.key}`}
              value={selfId[field.key] ?? ''}
              onChange={(e) => {
                setSelfId({ ...selfId, [field.key]: e.target.value || undefined })
                setMessage(null)
              }}
            >
              <option value="">Not set</option>
              {field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={aiConsent}
          onChange={(e) => {
            setAiConsent(e.target.checked)
            setMessage(null)
          }}
          aria-describedby="ai-consent-hint"
        />
        <span>
          <strong>Let the AI use my work authorization and sponsorship answers</strong>
          <span className="hint" id="ai-consent-hint">
            The daily search can then rank lower the jobs you can’t take, like ones that don’t sponsor visas. Your
            gender, race, veteran, and disability answers are never sent to the AI.
          </span>
        </span>
      </label>
      {message && (
        <p className={message.kind === 'error' ? 'error' : 'success'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <div className="actions">
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save self-identification'}
        </button>
      </div>
    </form>
  )
}
