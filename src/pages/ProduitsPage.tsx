import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiDelete, apiGet } from '../lib/api'
import { addToCart } from '../lib/cart'
import { Pencil, Trash2 } from 'lucide-react'

type Categorie = {
  id: number
  nom: string
  description: string | null
  statut: 0 | 1
}

type Produit = {
  id: number
  categorieId: number | null
  categorieNom: string | null
  nom: string
  description: string | null
  prix: string | number
  stockQuantite: number
  marque: string | null
  imagePrincipale: string | null
  dateAjout: string
}

function formatPrice(price: Produit['prix']) {
  const n = typeof price === 'string' ? Number(price) : price
  if (!Number.isFinite(n)) return String(price)
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(n)
}

export default function ProduitsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Categorie[]>([])
  const [products, setProducts] = useState<Produit[]>([])
  const [categorieId, setCategorieId] = useState<string>('')
  const [q, setQ] = useState('')
  const [minPrix, setMinPrix] = useState('')
  const [maxPrix, setMaxPrix] = useState('')
  const [sort, setSort] = useState<'recent' | 'prixAsc' | 'prixDesc'>('recent')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        const [cats, prods] = await Promise.all([
          apiGet<Categorie[]>('/api/categories'),
          apiGet<Produit[]>(
            categorieId ? `/api/produits?categorieId=${encodeURIComponent(categorieId)}` : '/api/produits',
          ),
        ])

        if (cancelled) return
        setCategories(cats)
        setProducts(prods)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Erreur inconnue')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [categorieId])

  const stats = useMemo(() => {
    const lowStock = products.filter((p) => p.stockQuantite <= 5).length
    return { count: products.length, lowStock }
  }, [products])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    const min = minPrix.trim() ? Number(minPrix) : null
    const max = maxPrix.trim() ? Number(maxPrix) : null

    let list = products

    if (query) {
      list = list.filter((p) => {
        const hay = `${p.nom} ${p.marque ?? ''} ${p.categorieNom ?? ''}`.toLowerCase()
        return hay.includes(query)
      })
    }

    if (min != null && Number.isFinite(min)) {
      list = list.filter((p) => Number(p.prix) >= min)
    }

    if (max != null && Number.isFinite(max)) {
      list = list.filter((p) => Number(p.prix) <= max)
    }

    if (sort === 'prixAsc') {
      list = [...list].sort((a, b) => Number(a.prix) - Number(b.prix))
    } else if (sort === 'prixDesc') {
      list = [...list].sort((a, b) => Number(b.prix) - Number(a.prix))
    }

    return list
  }, [products, q, minPrix, maxPrix, sort])

  const [quantities, setQuantities] = useState<Record<number, number>>({})

  const onAddToCart = (p: Produit) => {
    if (!user) {
      navigate('/connexion', { state: { from: { pathname: '/produits' } } })
      return
    }

    if (user.role === 'admin') return

    const price = Number(p.prix)
    const qty = quantities[p.id] || 1
    
    addToCart(
      {
        productId: p.id,
        nom: p.nom,
        prix: Number.isFinite(price) ? price : 0,
        imagePrincipale: p.imagePrincipale,
        marque: p.marque,
        categorieNom: p.categorieNom,
      },
      qty,
    )
    navigate('/panier')
  }

  const onDeleteProduct = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return
    try {
      await apiDelete(`/api/produits/${id}`)
      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur suppression')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Produits
          </h1>
          <p className="mt-1 text-slate-600">
            Catalogue chargé depuis la base de données.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700">
              {filtered.length} produit(s)
            </span>
            <span className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700">
              {stats.lowStock} stock faible (≤ 5)
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-slate-700">Recherche</span>
            <input
              className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              placeholder="Nom, marque, catégorie…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="categorie">
              Catégorie
            </label>
            <select
              id="categorie"
              value={categorieId}
              onChange={(e) => setCategorieId(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
            >
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="sort">
              Trier
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-11 rounded-xl border bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
            >
              <option value="recent">Récents</option>
              <option value="prixAsc">Prix ↑</option>
              <option value="prixDesc">Prix ↓</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="h-11 w-28 rounded-xl border bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              placeholder="Min"
              value={minPrix}
              onChange={(e) => setMinPrix(e.target.value)}
              inputMode="numeric"
            />
            <input
              className="h-11 w-28 rounded-xl border bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
              placeholder="Max"
              value={maxPrix}
              onChange={(e) => setMaxPrix(e.target.value)}
              inputMode="numeric"
            />
          </div>

          {user?.role === 'admin' ? (
            <Link
              to="/produits/ajout"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Ajouter un produit
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-slate-700 shadow-sm">
          <div className="font-semibold text-slate-900">Erreur API</div>
          <div className="mt-1 text-slate-600">{error}</div>
          <div className="mt-3 text-slate-600">
            Vérifie que l’API tourne (`npm run dev:api`) et que ta base MySQL est bien configurée.
          </div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="h-36 w-full animate-pulse rounded-xl bg-slate-100" />
                <div className="mt-4 grid gap-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))
          : filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="h-36 w-full overflow-hidden rounded-xl bg-slate-100">
                  {p.imagePrincipale ? (
                    <img
                      className="h-full w-full object-cover"
                      src={p.imagePrincipale}
                      alt={p.nom}
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
                  )}
                </div>

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{p.nom}</div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      {p.categorieNom ?? 'Sans catégorie'}
                      {p.marque ? ` • ${p.marque}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-slate-900">
                    {formatPrice(p.prix)}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Stock</span>
                  <span
                    className={
                      p.stockQuantite <= 5
                        ? 'font-semibold text-amber-700'
                        : 'font-semibold text-emerald-700'
                    }
                  >
                    {p.stockQuantite}
                  </span>
                </div>

                {(!user || user.role !== 'admin') && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="flex flex-1 items-center justify-between rounded-xl border border-slate-200 p-1">
                      <button
                        onClick={() => setQuantities(q => ({ ...q, [p.id]: Math.max(1, (q[p.id] || 1) - 1) }))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={quantities[p.id] || 1}
                        onChange={(e) => setQuantities(q => ({ ...q, [p.id]: parseInt(e.target.value) || 1 }))}
                        className="w-10 border-none bg-transparent p-0 text-center text-sm font-bold text-slate-900 focus:ring-0"
                      />
                      <button
                        onClick={() => setQuantities(q => ({ ...q, [p.id]: (q[p.id] || 1) + 1 }))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                    <button
                      disabled={!user}
                      onClick={() => onAddToCart(p)}
                      className="flex-[2] rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {user ? 'Ajouter' : 'Se connecter'}
                    </button>
                  </div>
                )}

                {user?.role === 'admin' && (
                  <div className="mt-4 space-y-2">
                    <div className="text-center text-xs font-medium text-slate-500 italic">
                      Mode administration
                    </div>
                    <div className="flex gap-2">
                    <Link
                      to={`/produits/modifier/${p.id}`}
                      className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </Link>
                    <button
                      onClick={() => onDeleteProduct(p.id)}
                      className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
                  </div>
                )}
              </div>
            ))}
      </div>

      {!loading && !error && filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          Aucun produit pour le moment.
        </div>
      ) : null}
    </div>
  )
}
