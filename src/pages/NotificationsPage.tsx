import { useEffect, useState } from 'react'
import { apiGet, apiPut } from '../lib/api'

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

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<Notification[]>('/api/notifications')
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await apiPut(`/api/notifications/${id}/lu`, {})
      setItems(prev => 
        prev.map(n => n.id === id ? { ...n, lu: 1 } : n)
      )
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchNotifications()
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
              onClick={() => !n.lu && markAsRead(n.id)}
              className={`rounded-2xl border p-4 shadow-sm transition-all cursor-pointer ${
                n.lu ? 'bg-white opacity-75' : 'bg-white border-slate-900 shadow-md ring-1 ring-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`font-semibold ${n.lu ? 'text-slate-600' : 'text-slate-900'}`}>
                    {n.message}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{formatDate(n.creeLe)}</div>
                </div>
                <span
                  className={
                    n.lu
                      ? 'rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600'
                      : 'rounded-full border border-rose-600 bg-rose-600 px-3 py-1 text-xs font-semibold text-white'
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
