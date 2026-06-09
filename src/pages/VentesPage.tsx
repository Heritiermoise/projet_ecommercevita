import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { DollarSign, Tag, Calendar, User, ShoppingCart } from 'lucide-react'

type Vente = {
  id: number
  commandeId: number
  reference: string
  montant: string | number
  dateVente: string
  clientEmail: string | null
  clientNom: string | null
  clientPrenom: string | null
}

function formatPrice(price: string | number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(Number(price))
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export default function VentesPage() {
  const [ventes, setVentes] = useState<Vente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Vente[]>('/api/admin/ventes')
      .then(setVentes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalRecettes = ventes.reduce((sum, v) => sum + Number(v.montant), 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Journal des Ventes</h1>
          <p className="mt-1 text-slate-600">Historique complet des revenus encaissés.</p>
        </div>
        <div className="rounded-2xl bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-200 lg:w-72">
          <div className="flex items-center gap-3 text-indigo-100 uppercase text-xs font-black tracking-widest">
            <DollarSign className="h-4 w-4" />
            Total Recettes
          </div>
          <div className="mt-2 text-3xl font-black">{formatPrice(totalRecettes)}</div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-600 border border-red-100">
          {error}
        </div>
      )}

      <div className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-900 uppercase tracking-tighter">Référence</th>
                <th className="px-6 py-4 font-bold text-slate-900 uppercase tracking-tighter">Client</th>
                <th className="px-6 py-4 font-bold text-slate-900 uppercase tracking-tighter">Date Vente</th>
                <th className="px-6 py-4 font-bold text-slate-900 uppercase tracking-tighter">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-8 h-16 bg-slate-50/20"></td>
                  </tr>
                ))
              ) : ventes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <ShoppingCart className="mx-auto h-12 w-12 text-slate-200" />
                    <p className="mt-4 text-slate-500 font-medium">Aucune vente enregistrée pour le moment.</p>
                  </td>
                </tr>
              ) : (
                ventes.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-indigo-500" />
                        <span className="font-mono font-bold text-slate-900">{v.reference}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-slate-500" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{v.clientPrenom} {v.clientNom}</div>
                          <div className="text-xs text-slate-400">{v.clientEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            {formatDate(v.dateVente)}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-lg bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">
                        {formatPrice(v.montant)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
