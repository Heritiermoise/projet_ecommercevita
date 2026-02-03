import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

type Role = 'client' | 'admin'

type FormState = {
  email: string
  motDePasse: string
  nom: string
  prenom: string
  telephone: string
  role: Role
}

export default function InscriptionPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname || '/'
  }, [location.state])

  const [form, setForm] = useState<FormState>({
    email: '',
    motDePasse: '',
    nom: '',
    prenom: '',
    telephone: '',
    role: 'client',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.email.trim()) return setError('Email requis')
    if (form.motDePasse.length < 6) return setError('Mot de passe: 6 caractères minimum')

    setSubmitting(true)
    try {
      const loggedUser = await register({
        email: form.email.trim(),
        motDePasse: form.motDePasse,
        nom: form.nom.trim() ? form.nom.trim() : null,
        prenom: form.prenom.trim() ? form.prenom.trim() : null,
        telephone: form.telephone.trim() ? form.telephone.trim() : null,
        role: form.role,
      })
      const destination = loggedUser.role === 'admin' ? '/admin' : from
      navigate(destination, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inscription')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Inscription</h1>
        <p className="mt-1 text-sm text-slate-600">Crée un compte client, ou admin (1 seul admin autorisé).</p>

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
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Mot de passe</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none ring-0 transition focus:border-slate-400 focus:bg-slate-50"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={form.motDePasse}
              onChange={(e) => setForm((f) => ({ ...f, motDePasse: e.target.value }))}
              required
            />
            <span className="text-xs text-slate-500">6 caractères minimum</span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Nom</span>
              <input
                className="h-11 rounded-xl border bg-white px-3 outline-none ring-0 transition focus:border-slate-400 focus:bg-slate-50"
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Prénom</span>
              <input
                className="h-11 rounded-xl border bg-white px-3 outline-none ring-0 transition focus:border-slate-400 focus:bg-slate-50"
                value={form.prenom}
                onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Téléphone</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none ring-0 transition focus:border-slate-400 focus:bg-slate-50"
              placeholder="0600000000"
              autoComplete="tel"
              value={form.telephone}
              onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Rôle</span>
            <select
              className="h-11 rounded-xl border bg-white px-3 outline-none ring-0 transition focus:border-slate-400 focus:bg-slate-50"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            >
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <button
            disabled={submitting}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Création…' : 'Créer mon compte'}
          </button>

          <div className="text-center text-sm text-slate-600">
            Déjà un compte ?{' '}
            <Link className="font-semibold text-slate-900 hover:underline" to="/connexion">
              Se connecter
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
