import { useEffect, useState } from 'react'
import type { Me } from '../api'
import { AppliedTab } from './AppliedTab'
import { InsightsTab } from './InsightsTab'
import { MatchesTab } from './MatchesTab'
import { ProfileTab } from './ProfileTab'

const TABS = [
  { id: 'matches', label: 'Matches' },
  { id: 'applied', label: 'Applied' },
  { id: 'insights', label: 'Insights' },
  { id: 'profile', label: 'Profile' },
] as const
type TabId = (typeof TABS)[number]['id']

function tabFromHash(): TabId {
  const hash = window.location.hash.slice(1)
  return TABS.some((tab) => tab.id === hash) ? (hash as TabId) : 'matches'
}

export function AppShell({ me, onChanged, onSignOut }: { me: Me; onChanged: () => void; onSignOut: () => void }) {
  const [tab, setTab] = useState<TabId>(tabFromHash)

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const current = TABS.find((t) => t.id === tab)!
  return (
    <div className="shell">
      <header className="topbar">
        <p className="wordmark">Jobpot</p>
        <nav aria-label="Main" className="tabs">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="tab" aria-current={t.id === tab ? 'page' : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
        <div className="account">
          <span className="muted">{me.user.name}</span>
          <button type="button" className="link" onClick={onSignOut}>
            Log out
          </button>
        </div>
      </header>
      <main className="page">
        <h1>{current.label}</h1>
        {tab === 'profile' ? (
          <ProfileTab me={me} onChanged={onChanged} />
        ) : tab === 'matches' ? (
          <MatchesTab />
        ) : tab === 'applied' ? (
          <AppliedTab />
        ) : (
          <InsightsTab />
        )}
      </main>
    </div>
  )
}
