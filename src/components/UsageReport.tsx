import { useEffect, useState } from 'react'
import { getUsage, type UsageEntry, type UsageKind } from '../api'

const DAYS = 30

const KIND_LABELS: Record<UsageKind, string> = {
  search: 'Daily search',
  resume: 'Tailored resumes',
  cover_letter: 'Cover letters',
  outreach: 'Messages',
  insights: 'Insights',
  gmail: 'Gmail sorting',
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function lastDays() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (DAYS - 1 - i))
    return date
  })
}

export function UsageReport() {
  const [entries, setEntries] = useState<UsageEntry[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getUsage()
      .then((data) => active && setEntries(data.entries))
      .catch(() => active && setError('Couldn’t load your AI usage.'))
    return () => {
      active = false
    }
  }, [])

  const days = lastDays()
  const start = days[0].getTime()
  const perDay = new Map<string, number>()
  const perKind = new Map<UsageKind, number>()
  for (const e of entries ?? []) {
    if (e.at < start) continue
    const key = dayKey(new Date(e.at))
    perDay.set(key, (perDay.get(key) ?? 0) + e.aiRequests)
    perKind.set(e.kind, (perKind.get(e.kind) ?? 0) + e.aiRequests)
  }
  const totals = days.map((d) => ({ date: d, total: perDay.get(dayKey(d)) ?? 0 }))
  const today = totals[totals.length - 1].total
  const month = totals.reduce((sum, d) => sum + d.total, 0)
  const max = Math.max(1, ...totals.map((d) => d.total))
  const label = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const plural = (n: number) => `${n} ${n === 1 ? 'request' : 'requests'}`

  return (
    <section aria-labelledby="usage-heading">
      <h2 id="usage-heading">AI usage</h2>
      <p className="muted">
        Counted in GitHub Copilot premium requests, because Copilot doesn’t report tokens. Everything Jobpot asks the AI
        to do is included.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {entries && (
        <>
          <div className="usage-totals">
            <p>
              <span className="usage-number">{today}</span> today
            </p>
            <p>
              <span className="usage-number">{month}</span> in the last {DAYS} days
            </p>
          </div>
          <div
            className="usage-chart"
            role="img"
            aria-label={`AI requests per day for the last ${DAYS} days. Busiest day: ${month ? plural(max) : 'none'}.`}
          >
            {totals.map((d, i) => (
              <div key={d.date.getTime()} className="usage-bar" title={`${label(d.date)}: ${plural(d.total)}`}>
                <span style={{ height: `${(d.total / max) * 100}%` }} className={i === totals.length - 1 ? 'is-today' : undefined} />
              </div>
            ))}
          </div>
          <div className="usage-axis muted fine-print" aria-hidden="true">
            <span>{label(days[0])}</span>
            <span>Today</span>
          </div>
          {month > 0 ? (
            <ul className="usage-kinds">
              {(Object.keys(KIND_LABELS) as UsageKind[])
                .filter((k) => perKind.get(k))
                .map((k) => (
                  <li key={k}>
                    <span>{KIND_LABELS[k]}</span>
                    <span>{perKind.get(k)}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="muted">No AI use in the last {DAYS} days.</p>
          )}
          {month > 0 && (
            <details className="earlier">
              <summary>Show by day</summary>
              <ul className="usage-kinds">
                {totals
                  .filter((d) => d.total)
                  .reverse()
                  .map((d) => (
                    <li key={d.date.getTime()}>
                      <span>{label(d.date)}</span>
                      <span>{d.total}</span>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}
