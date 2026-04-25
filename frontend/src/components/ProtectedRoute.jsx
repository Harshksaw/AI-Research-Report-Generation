import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api/client'
import Spinner from './Spinner'

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('loading')

  useEffect(() => {
    api.me()
      .then(() => setState('ok'))
      .catch(() => setState('unauth'))
  }, [])

  if (state === 'loading') return <Spinner message="Checking session…" />
  if (state === 'unauth') return <Navigate to="/login" replace />
  return children
}
