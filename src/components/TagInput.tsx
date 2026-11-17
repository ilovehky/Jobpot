import { useId, useState, type KeyboardEvent } from 'react'

type Props = {
  label: string
  hint: string
  placeholder: string
  values: string[]
  onChange: (values: string[]) => void
}

export function TagInput({ label, hint, placeholder, values, onChange }: Props) {
  const [draft, setDraft] = useState('')
  const id = useId()

  function add() {
    const value = draft.trim()
    setDraft('')
    if (!value || values.some((v) => v.toLowerCase() === value.toLowerCase()) || values.length >= 10) return
    onChange([...values, value])
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      add()
    } else if (event.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <p className="hint" id={`${id}-hint`}>
        {hint}
      </p>
      <div className="tags">
        {values.map((value) => (
          <span className="tag" key={value}>
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((v) => v !== value))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          aria-describedby={`${id}-hint`}
          value={draft}
          placeholder={values.length ? '' : placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
        />
      </div>
    </div>
  )
}
