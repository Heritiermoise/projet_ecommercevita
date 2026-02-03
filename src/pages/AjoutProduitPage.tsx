import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiGet, apiPost, apiPut } from '../lib/api'

type Categorie = {
  id: number
  nom: string
}

type Produit = {
  id: number
  categorieId: number | null
  nom: string
  description: string | null
  prix: number
  stockQuantite: number
  marque: string | null
  imagePrincipale: string | null
}

export default function AjoutProduitPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [categories, setCategories] = useState<Categorie[]>([])

  const [categorieId, setCategorieId] = useState<string>('')
  const [nom, setNom] = useState('')
  const [prix, setPrix] = useState<string>('')
  const [stock, setStock] = useState<string>('0')
  const [marque, setMarque] = useState('')
  const [imagePrincipale, setImagePrincipale] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cats = await apiGet<Categorie[]>('/api/categories')
        if (!cancelled) setCategories(cats)

        if (isEdit && id) {
          const prod = await apiGet<Produit>(`/api/produits/${id}`)
          if (!cancelled) {
            setCategorieId(prod.categorieId ? String(prod.categorieId) : '')
            setNom(prod.nom)
            setPrix(String(prod.prix))
            setStock(String(prod.stockQuantite))
            setMarque(prod.marque || '')
            setImagePrincipale(prod.imagePrincipale || '')
            setDescription(prod.description || '')
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur inconnue')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isEdit, id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const prixN = Number(prix)
    const stockN = Number(stock)
    if (!nom.trim()) return setError('Le nom est obligatoire.')
    if (!Number.isFinite(prixN) || prixN <= 0) return setError('Le prix est invalide.')
    if (!Number.isFinite(stockN) || stockN < 0) return setError('Le stock est invalide.')

    setSaving(true)
    try {
      const payload = {
        categorieId: categorieId ? Number(categorieId) : null,
        nom: nom.trim(),
        description: description.trim() ? description.trim() : null,
        prix: prixN,
        stockQuantite: stockN,
        marque: marque.trim() ? marque.trim() : null,
        imagePrincipale: imagePrincipale.trim() ? imagePrincipale.trim() : null,
      }

      if (isEdit) {
        await apiPut(`/api/produits/${id}`, payload)
        setSuccess('Produit modifié avec succès.')
      } else {
        await apiPost<{ id: number }>('/api/produits', payload)
        setSuccess('Produit créé avec succès.')
        setNom('')
        setPrix('')
        setStock('0')
        setMarque('')
        setImagePrincipale('')
        setDescription('')
        setCategorieId('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {isEdit ? 'Modifier le produit' : 'Ajouter un produit'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Les données sont enregistrées dans la base (table: produits).
            </p>
          </div>
          <Link
            to="/produits"
            className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Retour produits
          </Link>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {success}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Catégorie</span>
              <select
                className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400 focus:bg-slate-50"
                value={categorieId}
                onChange={(e) => setCategorieId(e.target.value)}
              >
                <option value="">Aucune</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Marque</span>
              <input
                className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400 focus:bg-slate-50"
                type="text"
                value={marque}
                onChange={(e) => setMarque(e.target.value)}
                placeholder="Nike, Apple..."
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Nom</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400 focus:bg-slate-50"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="T-shirt premium"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Prix ($)</span>
              <input
                className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400 focus:bg-slate-50"
                type="number"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                placeholder="29"
                step="0.01"
                min="0"
                required
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Stock</span>
              <input
                className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400 focus:bg-slate-50"
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="10"
                min="0"
                required
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Image principale (URL)</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400 focus:bg-slate-50"
              type="url"
              value={imagePrincipale}
              onChange={(e) => setImagePrincipale(e.target.value)}
              placeholder="https://..."
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Description</span>
            <textarea
              className="min-h-28 rounded-xl border bg-white px-3 py-2 outline-none transition focus:border-slate-400 focus:bg-slate-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le produit..."
            />
          </label>

          <button
            disabled={saving}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : isEdit ? 'Sauvegarder les modifications' : 'Enregistrer le produit'}
          </button>
        </form>

        <div className="mt-6 text-xs text-slate-500">
          Note: ton dump SQL contient un trigger qui écrit dans `notifications.type` mais la table `notifications` n’a pas la colonne `type`.
          Si tu ajoutes/updates le stock et que le trigger se déclenche, MySQL peut renvoyer une erreur.
        </div>
      </div>
    </div>
  )
}
