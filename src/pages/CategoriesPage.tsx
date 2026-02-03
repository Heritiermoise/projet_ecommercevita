import { useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api'
import { Pencil, Trash2, X } from 'lucide-react'

type Categorie = {
  id: number
  nom: string
  description: string | null
  statut: 0 | 1
}

export default function CategoriesPage() {
  const [items, setItems] = useState<Categorie[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form states
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await apiGet<Categorie[]>('/api/categories')
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!nom.trim()) return setError('Le nom est requis.')

    setSaving(true)
    try {
      if (editingId) {
        await apiPut(`/api/categories/${editingId}`, {
          nom: nom.trim(),
          description: description.trim() || null,
        })
        setSuccess('Catégorie modifiée.')
      } else {
        await apiPost('/api/categories', {
          nom: nom.trim(),
          description: description.trim() || null,
        })
        setSuccess('Catégorie ajoutée.')
      }
      setNom('')
      setDescription('')
      setEditingId(null)
      loadCategories()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: number) {
    if (!confirm('Supprimer cette catégorie ?')) return
    try {
      await apiDelete(`/api/categories/${id}`)
      loadCategories()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur suppression')
    }
  }

  function onEdit(cat: Categorie) {
    setEditingId(cat.id)
    setNom(cat.nom)
    setDescription(cat.description || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setNom('')
    setDescription('')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
        Gestion des catégories
      </h1>
      <p className="mt-1 text-slate-600">
        Seuls les administrateurs peuvent gérer les catégories.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Formulaire */}
        <div className="lg:col-span-1">
          <div className="rounded-3xl border bg-white p-6 shadow-sm sticky top-24">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Modifier' : 'Nouvelle'} catégorie
              </h2>
              {editingId && (
                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            
            {error ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                {success}
              </div>
            ) : null}

            <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Nom</span>
                <input
                  className="h-10 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Électronique..."
                  required
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Description</span>
                <textarea
                  className="min-h-24 rounded-xl border bg-white px-3 py-2 outline-none transition focus:border-slate-400"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Détails de la catégorie..."
                />
              </label>

              <button
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Sauvegarde...' : editingId ? 'Mettre à jour' : 'Ajouter la catégorie'}
              </button>
            </form>
          </div>
        </div>

        {/* Liste */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-900">ID</th>
                    <th className="px-6 py-4 font-semibold text-slate-900">Nom</th>
                    <th className="px-6 py-4 font-semibold text-slate-900">Description</th>
                    <th className="px-6 py-4 font-semibold text-slate-900 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-600">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={4} className="px-6 py-4 animate-pulse bg-slate-50/10">
                          <div className="h-4 bg-slate-100 rounded w-full"></div>
                        </td>
                      </tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        Aucune catégorie trouvée.
                      </td>
                    </tr>
                  ) : (
                    items.map((cat) => (
                      <tr key={cat.id} className={`hover:bg-slate-50/50 transition ${editingId === cat.id ? 'bg-slate-50' : ''}`}>
                        <td className="px-6 py-4 text-slate-900 font-medium">#{cat.id}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{cat.nom}</td>
                        <td className="px-6 py-4 truncate max-w-[200px]">{cat.description || '-'}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button 
                            onClick={() => onEdit(cat)}
                            className="p-2 text-slate-400 hover:text-indigo-600 transition"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => onDelete(cat.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 transition"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
