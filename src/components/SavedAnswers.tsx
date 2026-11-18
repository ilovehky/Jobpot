import { useEffect, useState } from 'react'
import { api, getAnswers, type SavedAnswer } from '../api'

export function SavedAnswers() {
  const [answers, setAnswers] = useState<SavedAnswer[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getAnswers()
      .then((data) => active && setAnswers(data.answers))
      .catch(() => active && setError("Couldn't load your saved answers."))
    return () => {
      active = false
    }
  }, [])

  async function remove(answer: SavedAnswer) {
    try {
      await api(`/answers/${encodeURIComponent(answer.key)}`, { method: 'DELETE' })
      setAnswers((list) => list?.filter((a) => a.key !== answer.key) ?? null)
    } catch {
      setError('Couldn’t delete that answer. Try again.')
    }
  }

  return (
    <section aria-labelledby="answers-heading">
      <h2 id="answers-heading">Saved answers</h2>
      <p className="muted">
        Answers you type into application forms are saved here, and Jobpot fills them in next time. Long answers and
        sensitive details like passwords or Social Security numbers are never saved.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {answers && !answers.length && <p className="muted">Nothing saved yet.</p>}
      {answers && answers.length > 0 && (
        <ul className="answer-list">
          {answers.map((a) => (
            <li key={a.key}>
              <div>
                <p className="answer-question">{a.question.replace(/\s*\*\s*$/, '')}</p>
                <p>{a.answer}</p>
              </div>
              <button type="button" className="link" onClick={() => remove(a)} aria-label={`Delete saved answer to: ${a.question}`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
