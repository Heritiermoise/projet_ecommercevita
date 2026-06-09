import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'

type Adresse = {
  id: number
  typeAdresse: 'livraison' | 'facturation'
  rue: string
  ville: string
  codePostal: string
  pays: string
}

export default function AdressesPage() {
  const [items, setItems] = useState<Adresse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [typeAdresse, setTypeAdresse] = useState<'livraison' | 'facturation'>('livraison')
  const [rue, setRue] = useState('')
  const [ville, setVille] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [pays, setPays] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<Adresse[]>('/api/adresses')
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!rue.trim() || !ville.trim() || !codePostal.trim() || !pays.trim()) {
      setError('Tous les champs sont requis.')
      return
    }

    try {
      await apiPost<{ id: number }>('/api/adresses', {
        typeAdresse,
        rue: rue.trim(),
        ville: ville.trim(),
        codePostal: codePostal.trim(),
        pays: pays.trim(),
      })
      setSuccess('Adresse enregistrée avec succès.')
      setRue('')
      setVille('')
      setCodePostal('')
      setPays('')
      setTypeAdresse('livraison')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Mes adresses</h1>
      <p className="mt-1 text-slate-600">Adresses de livraison/facturation.</p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <form className="mt-6 grid gap-4 rounded-3xl border bg-white p-6 shadow-sm" onSubmit={onSubmit}>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Type</span>
          <select
            className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
            value={typeAdresse}
            onChange={(e) => setTypeAdresse(e.target.value as 'livraison' | 'facturation')}
          >
            <option value="livraison">Livraison</option>
            <option value="facturation">Facturation</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Rue</span>
          <input
            className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
            value={rue}
            onChange={(e) => setRue(e.target.value)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Ville</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Code postal</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Pays</span>
          <input
            className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
            value={pays}
            onChange={(e) => setPays(e.target.value)}
          />
        </label>

        <button className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
          Ajouter l’adresse
        </button>
      </form>

      <div className="mt-8 grid gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
            Aucune adresse enregistrée.
          </div>
        ) : (
          items.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">{a.typeAdresse}</div>
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {a.rue}, {a.ville} {a.codePostal} — {a.pays}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
