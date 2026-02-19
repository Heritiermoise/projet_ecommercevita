import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import NotificationsPage from './pages/NotificationsPage'
import AccueilPage from './pages/AccueilPage'
import AjoutProduitPage from './pages/AjoutProduitPage'
import CommandesPage from './pages/CommandesPage'
import ConnexionPage from './pages/ConnexionPage'
import PanierPage from './pages/PanierPage'
import ProduitsPage from './pages/ProduitsPage'
import InscriptionPage from './pages/InscriptionPage'
import PaiementPage from './pages/PaiementPage'
import BannieresPage from './pages/BannieresPage'
import AvisPage from './pages/AvisPage'
import AdressesPage from './pages/AdressesPage'
import HistoriquePrixPage from './pages/HistoriquePrixPage'
import VisitesPage from './pages/VisitesPage'
import CategoriesPage from './pages/CategoriesPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import HistoriquePaiementsPage from './pages/HistoriquePaiementsPage'
import UtilisateursPage from './pages/UtilisateursPage'
import VentesPage from './pages/VentesPage'
import { RequireAdmin, RequireAuth, RequireClient } from './auth/Require'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<AccueilPage />} />
        <Route path="/connexion" element={<ConnexionPage />} />
        <Route path="/inscription" element={<InscriptionPage />} />

        <Route path="/produits" element={<ProduitsPage />} />
        <Route path="/avis" element={<AvisPage />} />
        <Route
          path="/produits/ajout"
          element={
            <RequireAdmin>
              <AjoutProduitPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/produits/modifier/:id"
          element={
            <RequireAdmin>
              <AjoutProduitPage />
            </RequireAdmin>
          }
        />

        <Route
          path="/panier"
          element={
            <RequireClient>
              <PanierPage />
            </RequireClient>
          }
        />

        <Route
          path="/adresses"
          element={
            <RequireClient>
              <AdressesPage />
            </RequireClient>
          }
        />

        <Route
          path="/paiement"
          element={
            <RequireClient>
              <PaiementPage />
            </RequireClient>
          }
        />
        <Route
          path="/commandes"
          element={
            <RequireAuth>
              <CommandesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/bannieres"
          element={
            <RequireAdmin>
              <BannieresPage />
            </RequireAdmin>
          }
        />

        <Route
          path="/historique-prix"
          element={
            <RequireAdmin>
              <HistoriquePrixPage />
            </RequireAdmin>
          }
        />

        <Route
          path="/visites"
          element={
            <RequireAdmin>
              <VisitesPage />
            </RequireAdmin>
          }
        />

        <Route
          path="/categories-gestion"
          element={
            <RequireAdmin>
              <CategoriesPage />
            </RequireAdmin>
          }
        />

        <Route
          path="/admin/transactions"
          element={
            <RequireAdmin>
              <HistoriquePaiementsPage />
            </RequireAdmin>
          }
        />

        <Route
          path="/admin/utilisateurs"
          element={
            <RequireAdmin>
              <UtilisateursPage />
            </RequireAdmin>
          }
        />

        <Route
          path="/admin/ventes"
          element={
            <RequireAdmin>
              <VentesPage />
            </RequireAdmin>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
