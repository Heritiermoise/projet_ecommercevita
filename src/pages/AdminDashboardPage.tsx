import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { ShoppingBag, Users, Package, ArrowRight, CreditCard, TrendingUp, FileText } from 'lucide-react'

type Client = {
  id: number
  email: string
  nom: string | null
  prenom: string | null
  telephone: string | null
  dateInscription: string
  lastSeen: string | null
  isConnected: boolean
}

type ProduitsParCategorie = {
  categorieId: number | null
  categorieNom: string | null
  totalProduits: number
}

type VisitesParHeure = {
  heure: string
  total: number
}

type DashboardData = {
  clients: Client[]
  connectedCount: number
  produitsParCategorie: ProduitsParCategorie[]
  visitesParHeure: VisitesParHeure[]
  activeWindowMinutes: number
  statsVentes?: {
    total60Jours: number
    totalGlobal: number
  }
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export default function AdminDashboardPage() {
  const { token } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await apiGet<DashboardData>('/api/admin/dashboard')
        if (!cancelled) setData(res)
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

  const totalClients = data?.clients.length ?? 0
  const totalProduits = useMemo(() => {
    if (!data) return 0
    return data.produitsParCategorie.reduce((sum, p) => sum + Number(p.totalProduits || 0), 0)
  }, [data])

  const maxVisites = useMemo(() => {
    if (!data || data.visitesParHeure.length === 0) return 0
    return Math.max(...data.visitesParHeure.map((v) => v.total))
  }, [data])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Tableau de bord admin
          </h1>
          <p className="mt-1 text-slate-600">
            Vue globale des clients, produits et visites.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <a
            href={`${import.meta.env.VITE_API_URL || ''}/api/admin/rapport-commandes/pdf?token=${token}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800"
          >
            <FileText className="h-4 w-4" />
            Rapport PDF des Commandes
          </a>
          {data ? (
            <div className="text-xs font-semibold text-slate-600">
              Connectés = activité dans les {data.activeWindowMinutes} dernières minutes
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
          <div className="font-semibold text-slate-900">Erreur API</div>
          <div className="mt-1 text-slate-600">{error}</div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-slate-900 p-8 text-white shadow-xl shadow-slate-200">
          <div className="text-sm font-bold uppercase tracking-widest opacity-80">Total Ventes (60 jours)</div>
          <div className="mt-2 text-4xl font-black">
            {loading ? '...' : formatAmount(data?.statsVentes?.total60Jours ?? 0)}
          </div>
          <p className="mt-4 text-xs opacity-70 italic">* Basé sur les transactions validées uniquement</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-900 p-8 text-white shadow-xl shadow-slate-200">
          <div className="text-sm font-bold uppercase tracking-widest opacity-80">Total Temps Réel (Global)</div>
          <div className="mt-2 text-4xl font-black">
            {loading ? '...' : formatAmount(data?.statsVentes?.totalGlobal ?? 0)}
          </div>
          <p className="mt-4 text-xs opacity-70 italic">Cumul historique de toutes les ventes réussies</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link 
          to="/commandes" 
          className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm hover:bg-slate-100 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-slate-900 p-2 text-white shadow-lg shadow-slate-200">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Commandes</div>
            <div className="text-2xl font-black text-slate-900">Gérer</div>
          </div>
        </Link>

        <Link 
          to="/admin/transactions" 
          className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm hover:bg-slate-100 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-slate-900 p-2 text-white shadow-lg shadow-slate-200">
              <CreditCard className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Finances</div>
            <div className="text-2xl font-black text-slate-900">Transactions</div>
          </div>
        </Link>

        {/* Gestion des Utilisateurs */}
        <Link 
          to="/admin/utilisateurs" 
          className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm hover:bg-slate-100 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-slate-900 p-2 text-white shadow-lg shadow-slate-200">
              <Users className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Utilisateurs</div>
            <div className="text-2xl font-black text-slate-900">Gérer les comptes</div>
          </div>
        </Link>

        {/* Journal des Ventes */}
        <Link 
          to="/admin/ventes" 
          className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm hover:bg-slate-100 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-slate-900 p-2 text-white shadow-lg shadow-slate-200">
              <TrendingUp className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Revenus</div>
            <div className="text-2xl font-black text-slate-900">Journal des Ventes</div>
          </div>
        </Link>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-400">
              <Users className="h-5 w-5" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Clients</div>
          </div>
          <div className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">
            {loading ? '—' : totalClients}
          </div>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-400">
              <Users className="h-5 w-5" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">En ligne</div>
          </div>
          <div className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">
            {loading ? '—' : data?.connectedCount ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-400">
              <Package className="h-5 w-5" />
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock total</div>
          </div>
          <div className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">
            {loading ? '—' : totalProduits}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Clients</h2>
            <span className="text-xs font-semibold text-slate-500">{totalClients} total</span>
          </div>

          <div className="mt-4 grid gap-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border p-3">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                </div>
              ))
            ) : data && data.clients.length > 0 ? (
              data.clients.map((c) => (
                <div key={c.id} className="rounded-2xl border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-slate-900">
                          {c.prenom || c.nom ? `${c.prenom ?? ''} ${c.nom ?? ''}`.trim() : 'Client'}
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            c.isConnected
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {c.isConnected ? 'Connecté' : 'Hors ligne'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{c.email}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Téléphone: {c.telephone ?? '—'}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      Inscrit: {formatDate(c.dateInscription)}
                      <div>Dernière activité: {formatDate(c.lastSeen)}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border p-6 text-center text-sm text-slate-600">
                Aucun client.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Produits par catégorie</h2>
          <div className="mt-4 grid gap-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="rounded-2xl border p-3">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                </div>
              ))
            ) : data && data.produitsParCategorie.length > 0 ? (
              data.produitsParCategorie.map((c) => (
                <div key={`${c.categorieId ?? 'none'}`} className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">
                      {c.categorieNom ?? 'Sans catégorie'}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {c.totalProduits}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border p-6 text-center text-sm text-slate-600">
                Aucune catégorie.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-10 rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Visites par heure</h2>
          <span className="text-xs text-slate-500">Dernières 24h</span>
        </div>

        <div className="mt-4 grid gap-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-5 w-full animate-pulse rounded bg-slate-100" />
            ))
          ) : data && data.visitesParHeure.length > 0 ? (
            data.visitesParHeure.map((v) => {
              const width = maxVisites > 0 ? Math.round((v.total / maxVisites) * 100) : 0
              return (
                <div key={v.heure} className="grid gap-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{v.heure}</span>
                    <span className="font-semibold text-slate-900">{v.total}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-900"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-2xl border p-6 text-center text-sm text-slate-600">
              Aucune visite sur les dernières 24h.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
