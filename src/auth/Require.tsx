import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function LoadingBlock() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-medium text-slate-700">Chargement…</div>
      </div>
    </div>
  )
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingBlock />
  if (!user) return <Navigate to="/connexion" replace state={{ from: location }} />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingBlock />
  if (!user) return <Navigate to="/connexion" replace state={{ from: location }} />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

export function RequireClient({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingBlock />
  if (!user) return <Navigate to="/connexion" replace state={{ from: location }} />
  if (user.role !== 'client') return <Navigate to="/commandes" replace />
  return <>{children}</>
}
