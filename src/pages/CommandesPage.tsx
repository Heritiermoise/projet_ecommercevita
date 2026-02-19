import { useEffect, useState } from 'react'
import { apiGet, apiPut } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { CheckCircle, XCircle, Clock, Truck, ShieldCheck, FileText, Share2, PlusCircle } from 'lucide-react'

type Commande = {
  id: number
  utilisateurId: number | null
  reference: string
  montantTotal: string | number
  statutPaiement: 'en_attente' | 'paye' | 'echoue'
  statutLivraison: 'traitement' | 'expedie' | 'livre' | 'annule'
  modePaiement: string | null
  dateCommande: string
}

type CommandeDetail = {
  id: number
  produitId: number
  produitNom: string
  imagePrincipale: string | null
  quantite: number
  prix_unitaire: string | number
}

function formatPrice(price: Commande['montantTotal']) {
  const n = typeof price === 'string' ? Number(price) : price
  if (!Number.isFinite(n)) return String(price)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(n)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export default function CommandesPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Commande[]>([])
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [details, setDetails] = useState<{ [key: number]: CommandeDetail[] }>({})
  const [loadingDetails, setLoadingDetails] = useState<{ [key: number]: boolean }>({})

  const isAdmin = user?.role === 'admin'

  const fetchCommandes = async () => {
    try {
      setLoading(true)
      const data = await apiGet<Commande[]>('/api/commandes')
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const fetchDetails = async (commandeId: number) => {
    if (details[commandeId]) {
      // Toggle off if already loaded
      const newDetails = { ...details }
      delete newDetails[commandeId]
      setDetails(newDetails)
      return
    }

    try {
      setLoadingDetails(prev => ({ ...prev, [commandeId]: true }))
      const data = await apiGet<CommandeDetail[]>(`/api/commandes/${commandeId}/details`)
      setDetails(prev => ({ ...prev, [commandeId]: data }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur chargement détails')
    } finally {
      setLoadingDetails(prev => ({ ...prev, [commandeId]: false }))
    }
  }

  useEffect(() => {
    fetchCommandes()
  }, [])

  const handleUpdateStatus = async (id: number, statutPaiement?: string, statutLivraison?: string) => {
    try {
      setProcessingId(id)
      await apiPut(`/api/commandes/${id}`, { statutPaiement, statutLivraison })
      await fetchCommandes()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur mise à jour')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {isAdmin ? 'Gestion des Commandes (Admin)' : 'Mes Commandes'}
          </h1>
          <p className="mt-1 text-slate-600">
            {isAdmin ? 'Confirmez les paiements reçus via Airtel Money ou Cash.' : 'Suivez vos achats en temps réel.'}
          </p>
        </div>
        {isAdmin && (
          <div className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200 uppercase tracking-wider">
            Espace Administrateur
          </div>
        )}
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
          <div className="font-semibold text-slate-900">Erreur API</div>
          <div className="mt-1 text-slate-600">{error}</div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6">
        {loading && items.length === 0 ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border bg-slate-50 p-6 animate-pulse" />
          ))
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Aucune commande</h3>
            <p className="text-sm text-slate-500">Les commandes apparaîtront ici dès qu'un achat sera effectué.</p>
          </div>
        ) : (
          items.map((c) => (
            <div key={c.id} className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md">
              <div className="p-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xl font-bold text-slate-900">{c.reference}</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-tight
                        ${c.statutPaiement === 'paye' ? 'bg-emerald-100 text-emerald-700' : 
                          c.statutPaiement === 'echoue' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.statutPaiement === 'paye' ? <ShieldCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {c.statutPaiement === 'paye' ? 'Payé' : c.statutPaiement === 'en_attente' ? 'En attente' : 'Échoué'}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-tight
                        ${c.statutLivraison === 'livre' ? 'bg-indigo-100 text-indigo-700' : 
                          c.statutLivraison === 'annule' ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>
                        {c.statutLivraison === 'livre' ? <CheckCircle className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                        {c.statutLivraison}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-slate-600 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-400">Date:</span>
                        {formatDate(c.dateCommande)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-400">Méthode:</span>
                        <span className="font-semibold text-slate-900">{c.modePaiement || 'N/A'}</span>
                      </div>
                      {isAdmin && (
                        <div className="col-span-full mt-1 flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                          <span className="font-bold text-slate-500">ID Client:</span>
                          <span className="font-mono font-bold text-indigo-600">USR-{c.utilisateurId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-4">
                    <div className="text-2xl font-black text-slate-900">{formatPrice(c.montantTotal)}</div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {(c.statutPaiement === 'paye' || isAdmin) && (
                        <>
                          <a
                            href={`${import.meta.env.VITE_API_URL || ''}/api/factures/${c.reference}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                            Facture
                          </a>
                          <a
                            href={`${import.meta.env.VITE_API_URL || ''}/api/factures/${c.reference}?download=true`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <PlusCircle className="h-4 w-4" />
                            PDF
                          </a>
                          <button
                            onClick={() => {
                              const msg = `Bonjour, voici ma facture pour la commande ${c.reference} : ${import.meta.env.VITE_API_URL || window.location.origin}/api/factures/${c.reference}`
                              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <Share2 className="h-4 w-4" />
                            Partager
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => fetchDetails(c.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {loadingDetails[c.id] ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                        ) : (
                          <PlusCircle className={`h-4 w-4 transition-transform ${details[c.id] ? 'rotate-45' : ''}`} />
                        )}
                        {details[c.id] ? 'Masquer' : 'Détails'}
                      </button>

                      {isAdmin && (
                        <>
                          {c.statutPaiement !== 'paye' && (
                            <button
                              disabled={processingId === c.id}
                              onClick={() => handleUpdateStatus(c.id, 'paye')}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Confirmer
                            </button>
                          )}
                          {c.statutLivraison !== 'livre' && c.statutLivraison !== 'annule' && (
                            <button
                              disabled={processingId === c.id}
                              onClick={() => handleUpdateStatus(c.id, undefined, 'livre')}
                              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-50"
                            >
                              <Truck className="h-4 w-4" />
                              Marquer Livré
                            </button>
                          )}
                          {c.statutLivraison !== 'annule' && (
                            <button
                              disabled={processingId === c.id}
                              onClick={() => handleUpdateStatus(c.id, 'echoue', 'annule')}
                              className="inline-flex items-center gap-2 rounded-xl border-2 border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                              Annuler
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {details[c.id] && (
                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Articles commandés</h4>
                    <div className="mt-4 space-y-3">
                      {details[c.id].map((detail) => (
                        <div key={detail.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                          <div className="flex items-center gap-3">
                            {detail.imagePrincipale ? (
                              <img src={detail.imagePrincipale} alt="" className="h-10 w-10 rounded-lg object-cover bg-white border border-slate-200" />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-slate-200" />
                            )}
                            <div>
                              <div className="text-sm font-bold text-slate-900">{detail.produitNom}</div>
                              <div className="text-xs text-slate-500">Prix unitaire: {Number(detail.prix_unitaire).toFixed(2)} $</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-slate-900">x{detail.quantite}</div>
                            <div className="text-xs font-bold text-indigo-600">
                              {(Number(detail.prix_unitaire) * detail.quantite).toFixed(2)} $
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
