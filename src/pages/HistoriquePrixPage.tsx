import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'

type HistoriquePrix = {
  id: number
  produitId: number
  produitNom: string
  ancienPrix: string | number
  nouveauPrix: string | number
  dateChangement: string
}

function formatPrice(price: HistoriquePrix['ancienPrix']) {
  const n = typeof price === 'string' ? Number(price) : price
  if (!Number.isFinite(n)) return String(price)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(n)
}

export default function HistoriquePrixPage() {
  const [items, setItems] = useState<HistoriquePrix[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiGet<HistoriquePrix[]>('/api/historique-prix')
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
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Historique des prix</h1>
      <p className="mt-1 text-slate-600">Audit des modifications de prix.</p>

      {error ? (
        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
          <div className="font-semibold text-slate-900">Erreur API</div>
          <div className="mt-1 text-slate-600">{error}</div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
            Aucun historique.
          </div>
        ) : (
          items.map((h) => (
            <div key={h.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{h.produitNom}</div>
                  <div className="mt-1 text-sm text-slate-600">#{h.produitId}</div>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {formatPrice(h.ancienPrix)} → {formatPrice(h.nouveauPrix)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
