import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { ShieldCheck, Clock, XCircle, CreditCard } from 'lucide-react'

type Transaction = {
  id: number
  commandeId: number | null
  reference: string | null
  montant: string | number
  devise: string
  modePaiement: string
  statut: 'en_attente' | 'reussi' | 'echoue' | 'annule'
  date: string
}

function formatPrice(price: string | number, cur: string) {
  const n = Number(price)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format(n)
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export default function HistoriquePaiementsPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Transaction[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiGet<Transaction[]>('/api/admin/transactions')
        setItems(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-3">
        <CreditCard className="h-8 w-8 text-indigo-600" />
        <h1 className="text-3xl font-bold text-slate-900">Suivi des Transactions</h1>
      </div>
      <p className="mt-2 text-slate-600">Historique des paiements via Maisha Pay et autres méthodes.</p>

      <div className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-700">Commande</th>
              <th className="px-6 py-4 font-bold text-slate-700">Montant</th>
              <th className="px-6 py-4 font-bold text-slate-700">Méthode</th>
              <th className="px-6 py-4 font-bold text-slate-700">Statut</th>
              <th className="px-6 py-4 font-bold text-slate-700">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="p-10 text-center animate-pulse text-slate-400">Chargement...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-slate-500">Aucune transaction enregistrée.</td></tr>
            ) : (
              items.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-indigo-600">
                    {t.reference || 'N/A'}
                  </td>
                  <td className="px-6 py-4 font-black">
                    {formatPrice(t.montant, t.devise)}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {t.modePaiement}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase
                      ${t.statut === 'reussi' ? 'bg-emerald-100 text-emerald-700' : 
                        t.statut === 'en_attente' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                      {t.statut === 'reussi' ? <ShieldCheck className="h-3 w-3"/> : 
                       t.statut === 'en_attente' ? <Clock className="h-3 w-3"/> : <XCircle className="h-3 w-3"/>}
                      {t.statut}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {formatDate(t.date)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
