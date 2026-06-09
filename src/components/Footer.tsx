import { Link } from 'react-router-dom'
import { Github, Instagram, MessageCircle, Twitter } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { buildWhatsAppUrl } from '../lib/whatsapp'

export default function Footer() {
  const { user } = useAuth()
  const supportNumber = import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER as string | undefined
  const whatsappUrl = supportNumber
    ? buildWhatsAppUrl(supportNumber, "Bonjour, j'ai une question concernant la boutique.")
    : null

  return (
    <footer className="mt-16 border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Ecommerce</div>
            <p className="mt-2 text-sm text-slate-600">
              Starter e-commerce: UI fluide, responsive, prêt à brancher.
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">Navigation</div>
            <ul className="mt-3 grid gap-2 text-sm text-slate-600">
              <li>
                <Link className="hover:text-slate-900" to="/">
                  Accueil
                </Link>
              </li>
              <li>
                <Link className="hover:text-slate-900" to="/produits">
                  Produits
                </Link>
              </li>
              <li>
                <Link className="hover:text-slate-900" to="/apropos">
                  À propos
                </Link>
              </li>
              {user?.role !== 'admin' ? (
                <li>
                  <Link className="hover:text-slate-900" to="/panier">
                    Panier
                  </Link>
                </li>
              ) : null}
              <li>
                <Link className="hover:text-slate-900" to="/avis">
                  Avis
                </Link>
              </li>
              {user?.role !== 'admin' ? (
                <li>
                  <Link className="hover:text-slate-900" to="/adresses">
                    Adresses
                  </Link>
                </li>
              ) : null}
              <li>
                <Link className="hover:text-slate-900" to="/commandes">
                  Commandes
                </Link>
              </li>
              {whatsappUrl ? (
                <li>
                  <a className="hover:text-slate-900" href={whatsappUrl} target="_blank" rel="noreferrer">
                    Support WhatsApp
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">Compte</div>
            <ul className="mt-3 grid gap-2 text-sm text-slate-600">
              {!user ? (
                <li>
                  <Link className="hover:text-slate-900" to="/connexion">
                    Connexion
                  </Link>
                </li>
              ) : null}
              <li>
                <Link className="hover:text-slate-900" to="/notifications">
                  Notifications
                </Link>
              </li>
              {user?.role === 'admin' ? (
                <li>
                  <Link className="hover:text-slate-900" to="/produits/ajout">
                    Ajout produit
                  </Link>
                </li>
              ) : null}
              {user?.role === 'admin' ? (
                <li>
                  <Link className="hover:text-slate-900" to="/bannieres">
                    Bannières
                  </Link>
                </li>
              ) : null}
              {user?.role === 'admin' ? (
                <li>
                  <Link className="hover:text-slate-900" to="/historique-prix">
                    Historique prix
                  </Link>
                </li>
              ) : null}
              {user?.role === 'admin' ? (
                <li>
                  <Link className="hover:text-slate-900" to="/visites">
                    Visites
                  </Link>
                </li>
              ) : null}
              {user?.role === 'admin' ? (
                <li>
                  <Link className="hover:text-slate-900" to="/admin/paniers">
                    Paniers
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">Suivez-nous</div>
            <div className="mt-3 flex items-center gap-2">
              {whatsappUrl ? (
                <a
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </a>
              ) : null}
              <a
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                href="#"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                href="#"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                href="#"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} Ecommerce. Tous droits réservés.</div>
          <div className="flex gap-4">
            <a className="hover:text-slate-900" href="#">
              Conditions
            </a>
            <a className="hover:text-slate-900" href="#">
              Confidentialité
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
