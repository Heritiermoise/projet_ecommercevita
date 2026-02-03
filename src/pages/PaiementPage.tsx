import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiPost } from '../lib/api'
import { clearCart, getCartItems, getCartTotals } from '../lib/cart'
import { buildWhatsAppUrl } from '../lib/whatsapp'

type PaiementResponse = {
  status: 'pending' | 'failed' | 'success' | 'pending_pin'
  message: string
  paymentUrl?: string
  whatsappUrl?: string
  reference?: string
  commandeId?: number
  commande?: {
    commandeId: number
    reference: string
    total: number
  }
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function PaiementPage() {
  const navigate = useNavigate()
  const totals = useMemo(() => getCartTotals(), [])
  const [method, setMethod] = useState<'airtel' | 'livraison' | 'maishapay' | 'whatsapp'>('maishapay')
  const [telephone, setTelephone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // États pour le PIN Airtel
  const [showPinForm, setShowPinForm] = useState(false)
  const [pin, setPin] = useState('')
  const [serverRef, setServerRef] = useState('')

  const supportNumber = import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER as string | undefined
  const whatsappUrl = supportNumber
    ? buildWhatsAppUrl(
        supportNumber,
        `Bonjour, j'ai besoin d'aide pour mon paiement (méthode: ${method}, montant: ${formatAmount(totals.total)}).`,
      )
    : null

  const onPay = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (method === 'airtel' && !telephone.trim()) {
      setError('Numéro Airtel requis.')
      return
    }

    setSubmitting(true)
    try {
      const items = getCartItems()
      const res = await apiPost<PaiementResponse>('/api/paiements/initier', {
        method,
        telephone: method === 'airtel' ? telephone.trim() : undefined,
        montant: totals.total,
        devise: 'USD',
        items: items.map((i) => ({
          produitId: i.productId,
          quantite: i.quantite,
          prixUnitaire: i.prix,
        })),
      })

      if (res.status === 'failed') {
        setError(res.message)
        return
      }

      // Gestion spécifique Maisha Pay : Redirection (On reste sur l'app si possible, mais MaishaPay nécessite souvent son portail)
      if (method === 'maishapay' && res.paymentUrl) {
        setSuccess("Commande validée ! Ouverture du portail de paiement sécurisé...")
        clearCart()
        // On simule une validation pro sans quitter brusquement l'application
        setTimeout(() => {
          window.open(res.paymentUrl!, '_blank')
          navigate('/commandes')
        }, 1500)
        return
      }
      // Gestion spécifique WhatsApp
      if (method === 'whatsapp' && res.whatsappUrl) {
        setSuccess("Commande enregistrée avec succès ! Notre équipe vous contacte sur WhatsApp.")
        clearCart()
        setTimeout(() => {
          window.open(res.whatsappUrl!, '_blank')
          navigate('/commandes')
        }, 1500)
        return
      }
      if (res.status === 'pending_pin' && res.reference) {
        setServerRef(res.reference)
        setShowPinForm(true)
        setSuccess(res.message)
        return
      }

      setSuccess(
        `${res.message}${res.reference ? ` Réf: ${res.reference}` : ''}`,
      )
      clearCart()
      // On ne redirige plus automatiquement, on laisse l'utilisateur voir le succès
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur paiement')
    } finally {
      setSubmitting(false)
    }
  }

  const onValidatePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiPost('/api/paiements/valider-pin', { pin, reference: serverRef })
      setSuccess("Paiement validé avec succès !")
      setShowPinForm(false)
      clearCart()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec validation PIN')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {method === 'maishapay' ? 'Paiement Sécurisé Maisha Pay' : 'Finaliser votre commande'}
          </h1>
          <p className="mt-1 text-slate-600">
            {method === 'maishapay' 
              ? 'Payez directement par Carte Bancaire ou Mobile Money via Maisha Pay.' 
              : 'Choisissez votre mode de paiement préféré.'}
          </p>
        </div>
        <Link className="text-sm font-semibold text-slate-900 hover:underline" to="/panier">
          Retour au panier
        </Link>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border bg-white p-6 shadow-sm">
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}

          <div className="mb-6 grid grid-cols-2 gap-2 text-xs font-bold uppercase tracking-tight sm:grid-cols-4 sm:text-sm">
            <button
              type="button"
              disabled={showPinForm || success !== null}
              onClick={() => setMethod('maishapay')}
              className={`flex h-14 flex-col items-center justify-center rounded-xl border transition ${
                method === 'maishapay' ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-600'
              }`}
            >
              <span>Maisha Pay</span>
              <span className="text-[10px] opacity-70">(CB/Mobile)</span>
            </button>
            <button
              type="button"
              disabled={showPinForm || success !== null}
              onClick={() => setMethod('airtel')}
              className={`flex h-14 flex-col items-center justify-center rounded-xl border transition ${
                method === 'airtel' ? 'border-amber-500 bg-amber-500 text-white shadow-lg' : 'bg-white text-slate-600'
              }`}
            >
              <span>Airtel</span>
              <span className="text-[10px] opacity-70">(Direct PUSH)</span>
            </button>
            <button
              type="button"
              disabled={showPinForm || success !== null}
              onClick={() => setMethod('whatsapp')}
              className={`flex h-14 flex-col items-center justify-center rounded-xl border transition ${
                method === 'whatsapp' ? 'border-emerald-600 bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-600'
              }`}
            >
              <span>WhatsApp</span>
              <span className="text-[10px] opacity-70">(Aide Pro)</span>
            </button>
            <button
              type="button"
              disabled={showPinForm || success !== null}
              onClick={() => setMethod('livraison')}
              className={`flex h-14 flex-col items-center justify-center rounded-xl border transition ${
                method === 'livraison' ? 'border-slate-900 bg-slate-100 text-slate-900' : 'bg-white text-slate-600'
              }`}
            >
              <span>Livraison</span>
              <span className="text-[10px] opacity-70">(Manuel)</span>
            </button>
          </div>

          {!showPinForm && !success && (
            <form className="grid gap-4" onSubmit={onPay}>
              {method === 'maishapay' && (
                <div className="rounded-2xl border bg-slate-50 p-6 text-center">
                  <div className="text-indigo-600 text-3xl font-black mb-2">Maisha Pay</div>
                  <div className="text-sm text-slate-600">
                    Vous allez être redirigé vers la passerelle sécurisée de Maisha Pay pour finaliser votre paiement de <span className="font-bold text-slate-900">{formatAmount(totals.total)}</span>.
                  </div>
                </div>
              )}

              {method === 'airtel' && (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Numéro Airtel Money</span>
                  <input
                    className="h-11 rounded-xl border bg-white px-3 outline-none ring-0 transition focus:border-slate-400 focus:bg-slate-50"
                    placeholder="Ex: 097xxxxxxx"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    autoComplete="tel"
                  />
                  <span className="text-xs text-slate-500">
                    Un prompt de confirmation apparaîtra sur votre mobile.
                  </span>
                </label>
              )}

              {method === 'whatsapp' && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.417-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.305 1.652zm6.599-3.835c1.406.832 3.391 1.437 5.248 1.438 5.461 0 9.907-4.444 9.91-9.904.002-2.648-1.03-5.135-2.902-7.01s-4.362-2.903-7.01-2.903c-5.463 0-9.903 4.44-9.905 9.899 0 2.126.659 4.134 1.897 5.8l-1.001 3.656 3.763-.98zm11.381-4.62c-.301-.15-.178-.063-1.093-.523-.915-.461-1.082-.575-1.207-.75-.125-.175-.046-.375.025-.525.071-.15.464-.541.639-.75.175-.209.307-.338.307-.338s-.075-.15-.225-.325c-.15-.175-1.004-2.427-1.378-3.328-.363-.873-.733-.752-1.006-.765-.224-.012-.482-.014-.741-.014s-.679.1-1.035.485c-.357.388-1.363 1.334-1.363 3.251s1.393 3.768 1.589 4.032c.196.265 2.742 4.192 6.642 5.879 2.112.912 2.972 1.027 4.049.868 1.144-.168 2.366-.966 2.697-1.901.33-.935.33-1.737.231-1.901-.099-.165-.363-.263-.664-.413z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-emerald-900">Service WhatsApp</h3>
                  </div>
                  <p className="text-sm text-emerald-800 mb-4">
                    Une fois la commande confirmée, nous vous redirigerons vers notre service client WhatsApp pour finaliser le paiement avec un conseiller.
                  </p>
                  <ul className="grid gap-2 text-xs text-emerald-700 font-medium">
                    <li className="flex items-center gap-2">✅ Order ID généré automatiquement</li>
                    <li className="flex items-center gap-2">✅ Assistance humaine personnalisée</li>
                    <li className="flex items-center gap-2">✅ Reçu et suivi via messagerie</li>
                  </ul>
                </div>
              )}

              {method === 'livraison' && (
                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800">
                  L'admin devra valider manuellement votre commande après réception du paiement physique.
                </div>
              )}

              <button
                disabled={submitting || totals.items.length === 0}
                className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60 transition-transform active:scale-95"
              >
                {submitting ? 'Traitement en cours...' : 
                method === 'maishapay' ? 'Payer avec Maisha Pay' : 
                method === 'airtel' ? 'Payer avec Airtel' : 
                method === 'whatsapp' ? 'Confirmer via WhatsApp' : 'Confirmer la commande'}
              </button>

              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                >
                  Besoin d’aide ? WhatsApp
                </a>
              ) : null}
            </form>
          )}

          {showPinForm && (
            <form className="grid gap-4" onSubmit={onValidatePin}>
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6">
                <h3 className="text-lg font-bold text-amber-900 mb-2">Validation PIN Airtel</h3>
                <p className="text-sm text-amber-800 mb-4">
                  Pour des raisons de sécurité dans cet environnement de test, veuillez saisir votre PIN de transaction (4 chiffres).
                </p>
                
                <label className="grid gap-1 text-sm">
                  <span className="font-bold text-amber-900">Code PIN</span>
                  <input
                    className="h-12 text-center text-3xl tracking-[1em] rounded-xl border-2 border-amber-300 bg-white outline-none focus:border-amber-500 shadow-inner"
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="****"
                    required
                  />
                </label>

                <button
                  disabled={submitting || pin.length < 4}
                  className="mt-6 w-full h-12 rounded-xl bg-amber-600 text-white font-black hover:bg-amber-700 transition active:scale-95"
                >
                  {submitting ? 'Validation...' : 'Valider le Paiement'}
                </button>
              </div>
            </form>
          )}

          {success && (
            <div className="text-center py-8">
              <div className="mx-auto h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Demande Enregistrée !</h2>
              <p className="mt-2 text-slate-600 px-4">{success}</p>
              
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => navigate('/commandes')}
                  className="h-12 px-8 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
                >
                  Voir mes commandes
                </button>
                <Link
                  to="/"
                  className="h-12 px-8 rounded-xl border flex items-center justify-center font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Retour à l'accueil
                </Link>
              </div>
            </div>
          )}
        </div>


        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Résumé</div>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Articles</span>
              <span className="text-slate-900">{totals.items.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span className="text-slate-900">{formatAmount(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

