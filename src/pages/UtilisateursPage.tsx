import { useEffect, useState } from 'react'
import { apiGet, apiPut, apiDelete } from '../lib/api'
import { User, Shield, Trash2, Mail, Phone, Calendar, Search } from 'lucide-react'

type Utilisateur = {
  id: number
  email: string
  nom: string | null
  prenom: string | null
  telephone: string | null
  role: 'client' | 'admin'
  dateInscription: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export default function UtilisateursPage() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const data = await apiGet<Utilisateur[]>('/api/admin/utilisateurs')
      setUtilisateurs(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleToggleRole = async (user: Utilisateur) => {
    const newRole = user.role === 'admin' ? 'client' : 'admin'
    if (!confirm(`Changer le rôle de ${user.email} en ${newRole} ?`)) return

    try {
      await apiPut(`/api/admin/utilisateurs/${user.id}/role`, { role: newRole })
      await fetchUsers()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur mise à jour rôle')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible.')) return
    try {
      await apiDelete(`/api/admin/utilisateurs/${id}`)
      await fetchUsers()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur suppression')
    }
  }

  const filtered = utilisateurs.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.nom?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.prenom?.toLowerCase() || '').includes(search.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestion des Utilisateurs</h1>
          <p className="mt-1 text-slate-600">Consultez et gérez les rôles de vos clients et administrateurs.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border-slate-200 pl-10 text-sm focus:border-indigo-500 focus:ring-indigo-500 sm:w-64"
          />
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100">
          {error}
        </div>
      )}

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-900">Utilisateur</th>
                <th className="px-6 py-4 font-semibold text-slate-900">Rôle</th>
                <th className="px-6 py-4 font-semibold text-slate-900">Contact</th>
                <th className="px-6 py-4 font-semibold text-slate-900">Date Inscription</th>
                <th className="px-6 py-4 font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8 h-16 bg-slate-50/50"></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold">
                          {u.prenom?.[0] || u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {u.prenom} {u.nom}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-tight
                        ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {u.role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600 flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {u.telephone || <span className="text-slate-400 italic text-xs">Non renseigné</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {formatDate(u.dateInscription)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleRole(u)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          title="Changer le rôle"
                        >
                          <Shield className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Supprimer l'utilisateur"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
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
