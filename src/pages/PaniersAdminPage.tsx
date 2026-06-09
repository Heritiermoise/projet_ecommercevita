import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'

type PanierAdmin = {
  panierId: number
  utilisateurId: number | null
  jetonVisiteur: string | null
  creeLe: string
  utilisateurEmail: string | null
  totalArticles: number
  montantEstime: string | number
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function formatAmount(amount: string | number) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return String(amount)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(n)
}

export default function PaniersAdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PanierAdmin[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiGet<PanierAdmin[]>('/api/admin/paniers')
        if (!cancelled) setItems(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur inconnue')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Paniers (Admin)</h1>
      <p className="mt-1 text-slate-600">Supervision des paniers enregistrés (tables paniers + panier_articles).</p>

      {error ? (
        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
          <div className="font-semibold text-slate-900">Erreur API</div>
          <div className="mt-1 text-slate-600">{error}</div>
        </div>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-900">Panier</th>
              <th className="px-4 py-3 font-semibold text-slate-900">Utilisateur</th>
              <th className="px-4 py-3 font-semibold text-slate-900">Articles</th>
              <th className="px-4 py-3 font-semibold text-slate-900">Montant estimé</th>
              <th className="px-4 py-3 font-semibold text-slate-900">Créé le</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3" colSpan={5}>
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-600" colSpan={5}>
                  Aucun panier enregistré.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.panierId} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-900">#{p.panierId}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {p.utilisateurEmail ?? (p.utilisateurId ? `Utilisateur #${p.utilisateurId}` : p.jetonVisiteur || 'Visiteur')}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{Number(p.totalArticles)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatAmount(p.montantEstime)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.creeLe)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
