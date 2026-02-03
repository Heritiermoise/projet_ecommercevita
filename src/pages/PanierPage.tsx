import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  getCartItems,
  removeFromCart,
  setQuantity,
  clearCart,
  type CartItem,
} from '../lib/cart'
import { buildWhatsAppUrl } from '../lib/whatsapp'

function formatAmount(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function PanierPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<CartItem[]>(() => getCartItems())

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'cart_v1') setItems(getCartItems())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const totals = useMemo(() => {
    const sousTotal = items.reduce((sum, i) => sum + i.prix * i.quantite, 0)
    return { items, sousTotal, total: sousTotal }
  }, [items])
  const supportNumber = import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER as string | undefined
  const whatsappUrl = supportNumber
    ? buildWhatsAppUrl(
        supportNumber,
        `Bonjour, j'ai besoin d'aide pour mon panier (${items.length} article(s)).`,
      )
    : null

  if (user?.role === 'admin') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Mode administrateur</h1>
          <p className="mt-1 text-slate-600">
            Les administrateurs ne peuvent pas utiliser le panier. Utilise la section Commandes.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              to="/commandes"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Voir les commandes
            </Link>
            <Link
              to="/produits"
              className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Retour produits
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Panier</h1>
          <p className="mt-1 text-slate-600">Ton panier (stocké localement).</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/paiement"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Payer
          </Link>
          <button
            type="button"
            onClick={() => {
              clearCart()
              setItems(getCartItems())
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Vider
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-4">
          {items.length === 0 ? (
            <div className="rounded-3xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
              Ton panier est vide. <Link className="font-semibold text-slate-900 hover:underline" to="/produits">Explorer les produits</Link>
            </div>
          ) : (
            items.map((i) => (
              <div key={i.productId} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-100">
                      {i.imagePrincipale ? (
                        <img className="h-full w-full object-cover" src={i.imagePrincipale} alt={i.nom} />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{i.nom}</div>
                      <div className="text-sm text-slate-600">
                        {i.categorieNom ?? 'Sans catégorie'}{i.marque ? ` • ${i.marque}` : ''}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-slate-600">Qté</span>
                        <input
                          className="h-10 w-20 rounded-xl border bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                          value={String(i.quantite)}
                          onChange={(e) => {
                            const next = Number(e.target.value)
                            if (!Number.isFinite(next)) return
                            setQuantity(i.productId, next)
                            setItems(getCartItems())
                          }}
                          inputMode="numeric"
                        />
                        <button
                          type="button"
                          className="text-sm font-semibold text-rose-700 hover:underline"
                          onClick={() => {
                            removeFromCart(i.productId)
                            setItems(getCartItems())
                          }}
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatAmount(i.prix * i.quantite)}
                    </div>
                    <div className="text-xs text-slate-500">{formatAmount(i.prix)} / unité</div>
                  </div>
                </div>
              </div>
            ))
          )}

          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Discuter sur WhatsApp
            </a>
          ) : null}
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Résumé</div>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Articles</span>
              <span className="text-slate-900">{items.length}</span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900">{formatAmount(totals.total)}</span>
            </div>
          </div>
          <Link
            to="/paiement"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Continuer vers paiement
          </Link>
        </div>
      </div>
    </div>
  )
}
