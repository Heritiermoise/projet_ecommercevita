import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

type Produit = {
  id: number
  nom: string
}

type Avis = {
  id: number
  produitId: number
  produitNom: string
  utilisateurId: number
  note: number
  commentaire: string | null
  datePublication: string
}

export default function AvisPage() {
  const { user } = useAuth()
  const [produits, setProduits] = useState<Produit[]>([])
  const [items, setItems] = useState<Avis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [produitId, setProduitId] = useState('')
  const [note, setNote] = useState('5')
  const [commentaire, setCommentaire] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [prods, avis] = await Promise.all([
        apiGet<Produit[]>('/api/produits'),
        apiGet<Avis[]>('/api/avis'),
      ])
      setProduits(prods)
      setItems(avis)
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

    if (!user) {
      setError('Connecte-toi pour laisser un avis.')
      return
    }

    if (!produitId) {
      setError('Sélectionne un produit.')
      return
    }

    try {
      await apiPost<{ id: number }>('/api/avis', {
        produitId: Number(produitId),
        note: Number(note),
        commentaire: commentaire.trim() ? commentaire.trim() : null,
      })
      setSuccess('Avis enregistré avec succès.')
      setCommentaire('')
      setNote('5')
      setProduitId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Avis clients</h1>
      <p className="mt-1 text-slate-600">Notes et commentaires des clients.</p>

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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Produit</span>
            <select
              className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
              value={produitId}
              onChange={(e) => setProduitId(e.target.value)}
            >
              <option value="">Sélectionner</option>
              {produits.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Note</span>
            <select
              className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Commentaire</span>
          <textarea
            className="min-h-28 rounded-xl border bg-white px-3 py-2 outline-none transition focus:border-slate-400"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
          />
        </label>

        <button className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
          Publier l’avis
        </button>
      </form>

      <div className="mt-8 grid gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
            Aucun avis pour le moment.
          </div>
        ) : (
          items.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">{a.produitNom}</div>
                <div className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  Note: {a.note}
                </div>
              </div>
              {a.commentaire ? (
                <div className="mt-2 text-sm text-slate-600">{a.commentaire}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
