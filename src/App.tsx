import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, getMe, type Me } from './api'
import { AppShell } from './screens/AppShell'
import { AuthScreen } from './screens/AuthScreen'
import { Onboarding } from './screens/Onboarding'
import { PrivacyPage } from './screens/PrivacyPage'

type State =
  | { status: 'loading' }
  | { status: 'signed-out'; notice?: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; me: Me }

async function loadState(): Promise<State> {
  try {
    return { status: 'ready', me: await getMe() }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { status: 'signed-out' }
    return { status: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' }
  }
}

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [hash, setHash] = useState(window.location.hash)

  const refresh = useCallback(() => loadState().then(setState), [])

  useEffect(() => {
    let active = true
    loadState().then((next) => active && setState(next))
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => {
      active = false
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    window.location.hash = ''
    setState({ status: 'signed-out' })
  }

  function onDeleted(notice: string) {
    window.location.hash = ''
    setState({ status: 'signed-out', notice })
  }

  if (hash === '#privacy') return <PrivacyPage />
  if (state.status === 'loading') return <p className="loading">Loading…</p>
  if (state.status === 'error') {
    return (
      <div className="loading">
        <p className="error" role="alert">
          {state.message}
        </p>
        <button type="button" className="button button-quiet" onClick={refresh}>
          Try again
        </button>
      </div>
    )
  }
  if (state.status === 'signed-out') return <AuthScreen onSignedIn={refresh} notice={state.notice} />

  const { me } = state
  const needsOnboarding = !me.resume || !me.profile.targetTitles.length || !me.profile.targetLocations.length
  return needsOnboarding ? (
    <Onboarding me={me} onChanged={refresh} onSignOut={signOut} />
  ) : (
    <AppShell me={me} onChanged={refresh} onSignOut={signOut} onDeleted={onDeleted} />
  )
}
