import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api/client'
import Spinner from './Spinner'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<'loading' | 'ok' | 'unauth'>('loading')

  useEffect(() => {
    api.me()
      .then(() => setAuthState('ok'))
      .catch(() => setAuthState('unauth'))
  }, [])

  if (authState === 'loading') return <Spinner message="Checking session…" />
  if (authState === 'unauth') return <Navigate to="/login" replace />
  return <>{children}</>
}
