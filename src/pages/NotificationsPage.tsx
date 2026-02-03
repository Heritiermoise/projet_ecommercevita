import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'

type Notification = {
  id: number
  message: string
  lu: 0 | 1
  creeLe: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Notification[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiGet<Notification[]>('/api/notifications')
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
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
        Notifications
      </h1>
      <p className="mt-1 text-slate-600">Chargées depuis la base de données.</p>

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
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
            Aucune notification.
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{n.message}</div>
                  <div className="mt-1 text-sm text-slate-600">{formatDate(n.creeLe)}</div>
                </div>
                <span
                  className={
                    n.lu
                      ? 'rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600'
                      : 'rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white'
                  }
                >
                  {n.lu ? 'Lu' : 'Nouveau'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
