import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function ConnexionPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname || '/'
  }, [location.state])

  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    setSubmitting(true)
    try {
      const loggedUser = await login({ email: email.trim(), motDePasse })
      const destination = loggedUser.role === 'admin' ? '/admin' : from
      navigate(destination, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur connexion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Connexion</h1>
        <p className="mt-1 text-sm text-slate-600">Connecte-toi pour accéder à ton panier, commandes, etc.</p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Email</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none ring-0 transition focus:border-slate-400 focus:bg-slate-50"
              type="email"
              placeholder="vous@exemple.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Mot de passe</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none ring-0 transition focus:border-slate-400 focus:bg-slate-50"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </label>

          <button
            disabled={submitting}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>

          <div className="text-center text-sm text-slate-600">
            Pas de compte ?{' '}
            <Link className="font-semibold text-slate-900 hover:underline" to="/inscription">
              Créer un compte
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
