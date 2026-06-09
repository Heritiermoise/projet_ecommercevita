import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { normalizeProductImageUrl, PRODUCT_IMAGE_FALLBACK } from '../lib/image'

const MAX_IMAGE_FILE_SIZE = 2 * 1024 * 1024

type Banniere = {
  id: number
  titre: string
  imageUrl: string
  lienRedirection: string | null
  actif: 0 | 1
}

export default function BannieresPage() {
  const [items, setItems] = useState<Banniere[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [titre, setTitre] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [lienRedirection, setLienRedirection] = useState('')
  const [actif, setActif] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiGet<Banniere[]>('/api/bannieres')
      setItems(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!titre.trim() || !imageUrl.trim()) {
      setError('Titre et image requis.')
      return
    }

    const normalizedImage = normalizeProductImageUrl(imageUrl)
    if (!normalizedImage) {
      setError("Image invalide. Utilise une URL http(s), un chemin '/media/...', ou un import local.")
      return
    }

    try {
      await apiPost<{ id: number }>('/api/bannieres', {
        titre: titre.trim(),
        imageUrl: normalizedImage,
        lienRedirection: lienRedirection.trim() ? lienRedirection.trim() : null,
        actif: actif ? 1 : 0,
      })
      setSuccess('Bannière créée avec succès.')
      setTitre('')
      setImageUrl('')
      setLienRedirection('')
      setActif(true)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    }
  }

  const handleLocalBannerFile = (file: File | null) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Fichier invalide: sélectionne une image de bannière.')
      return
    }

    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setError('Image trop volumineuse. Taille max: 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result.startsWith('data:image/')) {
        setError('Impossible de lire le fichier image sélectionné.')
        return
      }
      setImageUrl(result)
      setError(null)
    }
    reader.onerror = () => setError('Erreur de lecture du fichier image local.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Bannières</h1>
      <p className="mt-1 text-slate-600">Gestion des bannières d’accueil.</p>

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

      <form className="mt-6 grid gap-4 rounded-3xl border bg-white p-6 shadow-sm" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Titre</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Image (URL)</span>
            <input
              className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Importer image bannière depuis le disque</span>
          <input
            className="h-11 rounded-xl border bg-white px-3 py-2 outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
            type="file"
            accept="image/*"
            onChange={(e) => handleLocalBannerFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {normalizeProductImageUrl(imageUrl) ? (
          <div className="grid gap-2 text-sm">
            <span className="font-medium text-slate-700">Aperçu bannière</span>
            <div className="h-32 w-full overflow-hidden rounded-xl border bg-slate-100">
              <img
                className="h-full w-full object-cover"
                src={normalizeProductImageUrl(imageUrl) as string}
                alt="Aperçu bannière"
              />
            </div>
          </div>
        ) : null}

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Lien redirection (optionnel)</span>
          <input
            className="h-11 rounded-xl border bg-white px-3 outline-none transition focus:border-slate-400"
            value={lienRedirection}
            onChange={(e) => setLienRedirection(e.target.value)}
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
          <span>Actif</span>
        </label>

        <button className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
          Créer la bannière
        </button>
      </form>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="h-32 w-full animate-pulse rounded-xl bg-slate-100" />
              <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600 shadow-sm">
            Aucune bannière pour le moment.
          </div>
        ) : (
          items.map((b) => (
            <div key={b.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="h-32 w-full overflow-hidden rounded-xl bg-slate-100">
                <img
                  className="h-full w-full object-cover"
                  src={normalizeProductImageUrl(b.imageUrl) || PRODUCT_IMAGE_FALLBACK}
                  alt={b.titre}
                  onError={(e) => {
                    const img = e.currentTarget
                    if (img.dataset.fallbackApplied === '1') return
                    img.dataset.fallbackApplied = '1'
                    img.src = PRODUCT_IMAGE_FALLBACK
                  }}
                />
              </div>
              <div className="mt-3 font-semibold text-slate-900">{b.titre}</div>
              <div className="text-sm text-slate-600">{b.actif ? 'Actif' : 'Inactif'}</div>
              {b.lienRedirection ? (
                <a className="mt-2 inline-flex text-sm font-semibold text-slate-900 hover:underline" href={b.lienRedirection} target="_blank" rel="noreferrer">
                  Ouvrir le lien
                </a>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
