import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck,
  Bell,
  Boxes,
  ClipboardList,
  LayoutGrid,
  MessageSquareText,
  Package,
  ShoppingCart,
  Tags,
  Truck,
  User,
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'

type Feature = {
  title: string
  description: string
  to: string
  icon: ReactNode
  meta?: string
}

function Card({ feature }: { feature: Feature }) {
  return (
    <Link
      to={feature.to}
      className="group rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm">
          {feature.icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {feature.title}
            </h3>
            {feature.meta ? (
              <span className="shrink-0 rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {feature.meta}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
          <div className="mt-3 text-sm font-semibold text-slate-900">
            Ouvrir <span className="opacity-60 group-hover:opacity-100">→</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function AccueilPage() {
  const [stats, setStats] = useState<{
    produits: number
    categories: number
    commandes: number
    utilisateurs: number
    notificationsNonLues: number
  } | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiGet<{
          produits: number
          categories: number
          commandes: number
          utilisateurs: number
          notificationsNonLues: number
        }>('/api/stats')
        if (!cancelled) setStats(data)
      } catch (e) {
        if (!cancelled) {
          setStatsError(e instanceof Error ? e.message : 'Erreur inconnue')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    apiPost('/api/visites', { mapsur: '/' }).catch(() => {
      // ignore tracking errors
    })
  }, [])

  const features: Feature[] = [
    {
      title: 'Catalogue produits',
      description:
        'Gestion des produits (nom, description, prix, stock, marque, image, date).',
      to: '/produits',
      icon: <Package className="h-5 w-5" aria-hidden="true" />,
      meta: 'table: produits',
    },
    {
      title: 'Catégories',
      description: 'Organisation du catalogue (nom, description, statut).',
      to: '/categories-gestion',
      icon: <Tags className="h-5 w-5" aria-hidden="true" />,
      meta: 'table: categories',
    },
    {
      title: 'Panier',
      description:
        'Paniers utilisateur/visiteur et articles (quantité). Prêt pour le parcours d’achat.',
      to: '/panier',
      icon: <ShoppingCart className="h-5 w-5" aria-hidden="true" />,
      meta: 'tables: paniers, panier_articles',
    },
    {
      title: 'Adresses',
      description: 'Adresses de livraison et facturation pour le client.',
      to: '/adresses',
      icon: <Truck className="h-5 w-5" aria-hidden="true" />,
      meta: 'table: adresses',
    },
    {
      title: 'Commandes',
      description:
        'Références, montant total, paiement et livraison (en_attente/paye/echoue ; traitement/expedie/livre/annule).',
      to: '/commandes',
      icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
      meta: 'tables: commandes, commande_details',
    },
    {
      title: 'Avis clients',
      description:
        'Notes 1–5, commentaire, date de publication. Idéal pour la confiance.',
      to: '/avis',
      icon: <MessageSquareText className="h-5 w-5" aria-hidden="true" />,
      meta: 'table: avis',
    },
    {
      title: 'Notifications',
      description:
        'Centre de notifications (lu/non lu). Peut servir aux alertes stock.',
      to: '/notifications',
      icon: <Bell className="h-5 w-5" aria-hidden="true" />,
      meta: 'table: notifications',
    },
    {
      title: 'Utilisateurs & rôles',
      description:
        'Comptes (client/admin/moderateur), email, mot de passe hashé, infos profil.',
      to: '/connexion',
      icon: <User className="h-5 w-5" aria-hidden="true" />,
      meta: 'table: utilisateurs',
    },
    {
      title: 'Bannières & mise en avant',
      description:
        'Bannières actives avec image et lien de redirection pour promotions.',
      to: '/bannieres',
      icon: <LayoutGrid className="h-5 w-5" aria-hidden="true" />,
      meta: 'table: bannieres',
    },
    {
      title: 'Historique des prix',
      description:
        'Traçabilité des changements de prix (ancien/nouveau + date).',
      to: '/historique-prix',
      icon: <BadgeCheck className="h-5 w-5" aria-hidden="true" />,
      meta: 'table: historique_prix',
    },
    {
      title: 'Suivi & visites',
      description:
        'Journalisation IP + date visite (analytics simple).',
      to: '/visites',
      icon: <Boxes className="h-5 w-5" aria-hidden="true" />,
      meta: 'table: visites',
    },
  ]

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-indigo-300/50 blur-3xl" />
          <div className="absolute -right-40 -top-24 h-96 w-96 rounded-full bg-fuchsia-300/50 blur-3xl" />
          <div className="absolute left-1/3 top-40 h-96 w-96 rounded-full bg-amber-200/50 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Base de données: miniprojet_ecommerce
              </p>

              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                Bienvenue sur notre plateforme
                <span className="block bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
                  e-commerce
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-slate-600">
                Cette interface est pensée pour guider le visiteur: explorer les produits,
                gérer le panier, passer commande, puis suivre les notifications.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/produits"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Explorer le catalogue
                </Link>
                <Link
                  to="/connexion"
                  className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                >
                  Connexion
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Panier</div>
                  <div className="mt-1 text-sm text-slate-600">paniers + articles</div>
                </div>
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Commande</div>
                  <div className="mt-1 text-sm text-slate-600">référence + statuts</div>
                </div>
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">Avis</div>
                  <div className="mt-1 text-sm text-slate-600">notes 1–5</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Données en direct</div>
                {stats ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-5">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">Produits</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{stats.produits}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">Catégories</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{stats.categories}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">Commandes</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{stats.commandes}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">Utilisateurs</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{stats.utilisateurs}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-600">Notif. non lues</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {stats.notificationsNonLues}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-600">
                    {statsError
                      ? `API indisponible: ${statsError}`
                      : 'Chargement des statistiques…'}
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-indigo-200 via-fuchsia-200 to-amber-200 blur-2xl opacity-70" />
              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Parcours visiteur
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      De la découverte à la livraison.
                    </div>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white">
                    <Truck className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>

                <ol className="mt-6 grid gap-3">
                  {[
                    {
                      title: 'Explorer',
                      desc: 'Produits + catégories + bannières',
                    },
                    {
                      title: 'Ajouter au panier',
                      desc: 'Quantité et articles panier',
                    },
                    {
                      title: 'Passer commande',
                      desc: 'Paiement + livraison + détails commande',
                    },
                    {
                      title: 'Suivre',
                      desc: 'Notifications + historique',
                    },
                  ].map((step, idx) => (
                    <li key={idx} className="rounded-2xl border bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {idx + 1}. {step.title}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">{step.desc}</div>
                        </div>
                        <div className="grid h-8 w-8 place-items-center rounded-xl bg-white text-xs font-semibold text-slate-700 shadow-sm">
                          {idx + 1}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Modules du projet (selon la base)
            </h2>
            <p className="mt-1 max-w-2xl text-slate-600">
              Chaque carte correspond à une partie du schéma SQL (tables + relations) et t’emmène vers l’écran associé.
            </p>
          </div>
          <Link
            to="/produits/ajout"
            className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Ajouter un produit
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} feature={feature} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Besoin d’un point de départ ?
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Commence par le catalogue, puis simule un achat via le panier.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                to="/produits"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Aller aux produits
              </Link>
              <Link
                to="/panier"
                className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Ouvrir le panier
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
