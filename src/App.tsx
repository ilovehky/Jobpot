import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, getMe, type Me } from './api'
import { AppShell } from './screens/AppShell'
import { AuthScreen } from './screens/AuthScreen'
import { Onboarding } from './screens/Onboarding'

type State =
  | { status: 'loading' }
  | { status: 'signed-out' }
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

  const refresh = useCallback(() => loadState().then(setState), [])

  useEffect(() => {
    let active = true
    loadState().then((next) => active && setState(next))
    return () => {
      active = false
    }
  }, [])

  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    window.location.hash = ''
    setState({ status: 'signed-out' })
  }

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
  if (state.status === 'signed-out') return <AuthScreen onSignedIn={refresh} />

  const { me } = state
  const needsOnboarding = !me.resume || !me.profile.targetTitles.length || !me.profile.targetLocations.length
  return needsOnboarding ? (
    <Onboarding me={me} onChanged={refresh} onSignOut={signOut} />
  ) : (
    <AppShell me={me} onChanged={refresh} onSignOut={signOut} />
  )
}
