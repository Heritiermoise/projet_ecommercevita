import { useMemo, useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import {
  Bell,
  ChevronDown,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  PlusCircle,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react"
import { useAuth } from "../auth/AuthContext"
import { buildWhatsAppUrl } from "../lib/whatsapp"

type NavItem = {
  label: string
  to: string
  icon?: React.ReactNode
}

const productsGroupLabel = "Catalogue"

function classNames(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ")
}

export default function Header() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)

  const handleMobileNavClick = () => {
    setMobileOpen(false)
  }

  const [notificationCount] = useState(0)
  const supportNumber = import.meta.env.VITE_SUPPORT_WHATSAPP_NUMBER as string | undefined
  const whatsappUrl = supportNumber
    ? buildWhatsAppUrl(supportNumber, "Bonjour, j'ai une question concernant la boutique.")
    : null

  const navItems: NavItem[] = useMemo(() => {
    const base = [{ label: "Accueil", to: "/", icon: <Home className="h-4 w-4" /> }]
    if (user?.role === "admin") {
      base.push({ label: "Tableau de bord", to: "/admin", icon: <LayoutDashboard className="h-4 w-4" /> })
      base.push(
        { label: "Categories", to: "/categories-gestion", icon: <Settings className="h-4 w-4" /> },
        { label: "Historique prix", to: "/historique-prix", icon: <TrendingUp className="h-4 w-4" /> },
        { label: "Visites", to: "/visites", icon: <Users className="h-4 w-4" /> }
      )
    }
    if (!user) {
      base.push(
        { label: "Connexion", to: "/connexion", icon: <User className="h-4 w-4" /> },
        { label: "Inscription", to: "/inscription", icon: <PlusCircle className="h-4 w-4" /> }
      )
    }
    return base
  }, [user])

  const productsItems: NavItem[] = useMemo(() => {
    const base: NavItem[] = [
      { label: "Tous les produits", to: "/produits", icon: <Package className="h-4 w-4" /> }
    ]
    
    if (user?.role === "admin") {
      base.push(
        { label: "Ajout produit", to: "/produits/ajout", icon: <PlusCircle className="h-4 w-4" /> },
        { label: "Bannieres", to: "/bannieres", icon: <Tag className="h-4 w-4" /> },
        { label: "Categories", to: "/categories", icon: <Settings className="h-4 w-4" /> },
        { label: "Historique prix", to: "/historique-prix", icon: <TrendingUp className="h-4 w-4" /> },
        { label: "Visites", to: "/visites", icon: <Users className="h-4 w-4" /> }
      )
    } else if (user) {
      base.push(
        { label: "Panier", to: "/panier", icon: <ShoppingCart className="h-4 w-4" /> },
        { label: "Avis clients", to: "/avis", icon: <Star className="h-4 w-4" /> },
        { label: "Mes Adresses", to: "/adresses", icon: <Home className="h-4 w-4" /> }
      )
    }

    if (user) {
      base.push(
        { label: "Commandes", to: "/commandes", icon: <ShoppingBag className="h-4 w-4" /> },
        { label: "Notifications", to: "/notifications", icon: <Bell className="h-4 w-4" /> }
      )
    }

    return base
  }, [user])

  const isProductsSection = useMemo(
    () =>
      location.pathname.startsWith("/produits") ||
      location.pathname.startsWith("/panier") ||
      location.pathname.startsWith("/commandes") ||
      location.pathname.startsWith("/notifications"),
    [location.pathname],
  )

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white shadow-sm">
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="hidden sm:block">Ecommerce</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  classNames(
                    "rounded-xl px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}

            <div className="relative group">
              <button
                type="button"
                className={classNames(
                  "inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium transition",
                  isProductsSection
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {productsGroupLabel}
                <ChevronDown className="h-4 w-4 opacity-70 transition group-hover:opacity-100" />
              </button>

              <div className="invisible absolute left-0 top-full z-50 mt-2 w-64 origin-top-left rounded-2xl border bg-white p-2 shadow-xl opacity-0 transition-all duration-150 ease-out group-hover:visible group-hover:opacity-100 group-hover:translate-y-0">
                <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Menu</div>
                <div className="grid gap-1">
                  {productsItems.map((sub) => (
                    <NavLink
                      key={sub.to}
                      to={sub.to}
                      className={({ isActive }) =>
                        classNames(
                          "rounded-xl px-3 py-2 text-sm transition",
                          isActive
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                        )
                      }
                    >
                      {sub.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={logout}
              className="hidden h-10 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 md:inline-flex"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          )}

          {user?.role !== "admin" && (
            <Link
              to="/panier"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ShoppingCart className="h-5 w-5" />
            </Link>
          )}

          <Link
            to="/notifications"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1 text-[11px] font-semibold text-white">
                {notificationCount}
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className={classNames(
          "fixed inset-0 z-[60] md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          className={classNames(
            "absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />

        <div
          className={classNames(
            "absolute right-4 top-20 flex w-[calc(100%-2rem)] max-w-sm flex-col rounded-[2rem] border bg-white shadow-2xl transition-all duration-300 ease-out",
            mobileOpen ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95",
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <User className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">{user?.nom || "Bienvenue"}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{user?.role || "Visiteur"}</span>
              </div>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 transition"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 flex-1">
            <div className="grid gap-1">
              <div className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Menu Principal</div>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={handleMobileNavClick}
                  className={({ isActive }) =>
                    classNames(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                      isActive
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}

              <button
                type="button"
                className={classNames(
                  "mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition",
                  isProductsSection ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setMobileProductsOpen((v) => !v)}
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4" />
                  <span>{productsGroupLabel}</span>
                </div>
                <ChevronDown className={classNames("h-4 w-4 transition-transform duration-300", mobileProductsOpen ? "rotate-180" : "rotate-0")} />
              </button>

              <div className={classNames("grid gap-1 overflow-hidden transition-all duration-300", mobileProductsOpen ? "mt-1 opacity-100" : "h-0 opacity-0")}>
                {productsItems.map((sub) => (
                  <NavLink
                    key={sub.to}
                    to={sub.to}
                    onClick={handleMobileNavClick}
                    className={({ isActive }) =>
                      classNames(
                        "flex items-center gap-3 rounded-2xl px-10 py-3 text-sm font-medium transition",
                        isActive ? "text-indigo-600 bg-indigo-50/50" : "text-slate-500 hover:bg-slate-50",
                      )
                    }
                  >
                    <div className={classNames("h-1.5 w-1.5 rounded-full", location.pathname === sub.to ? "bg-indigo-600" : "bg-slate-300")} />
                    {sub.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto border-t p-4 pb-6">
            <div className="grid grid-cols-2 gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={logout}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-900 transition hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" /> Quitter
                </button>
              ) : (
                <Link to="/connexion" onClick={handleMobileNavClick} className="flex h-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800">
                  Connexion
                </Link>
              )}
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-600">
                  <MessageCircle className="h-4 w-4" /> Support
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

