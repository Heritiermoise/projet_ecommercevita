import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'

type Visite = {
  id: number
  ip: string
  mapsur: string | null
  dateVisite: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export default function VisitesPage() {
  const [items, setItems] = useState<Visite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiGet<Visite[]>('/api/visites')
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
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Visites</h1>
      <p className="mt-1 text-slate-600">Journal des visites.</p>

      {error ? (
        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
          <div className="font-semibold text-slate-900">Erreur API</div>
          <div className="mt-1 text-slate-600">{error}</div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
            Aucune visite.
          </div>
        ) : (
          items.map((v) => (
            <div key={v.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{v.ip}</div>
                  <div className="mt-1 text-sm text-slate-600">{v.mapsur ?? '-'}</div>
                </div>
                <div className="text-sm text-slate-600">{formatDate(v.dateVisite)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
