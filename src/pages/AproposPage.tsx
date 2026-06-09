export default function AproposPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">À propos du projet</h1>
        <p className="mt-2 text-slate-600">
          Cette plateforme e-commerce est une application full-stack pensée pour une gestion moderne des ventes,
          du catalogue et des opérations clients, avec un déploiement unifié Front + API sur Vercel.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border p-4">
            <h2 className="text-lg font-semibold text-slate-900">Architecture technique</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700">
              <li>Front-end: React + TypeScript + Vite + Tailwind CSS</li>
              <li>Back-end: Node.js + Express (API REST)</li>
              <li>Base de données: MySQL / MariaDB</li>
              <li>Authentification: JWT avec rôles client/admin</li>
              <li>Déploiement: Vercel (SPA + fonctions serverless)</li>
            </ul>
          </section>

          <section className="rounded-2xl border p-4">
            <h2 className="text-lg font-semibold text-slate-900">Fonctionnalités métier</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700">
              <li>Catalogue produits avec catégories, stock, marque, images</li>
              <li>Panier client, checkout, commandes et historique</li>
              <li>Paiements multi-modes (Airtel, Maisha Pay, WhatsApp, livraison)</li>
              <li>Tableau de bord administrateur et suivi des ventes</li>
              <li>Notifications, avis clients, adresses de livraison</li>
            </ul>
          </section>

          <section className="rounded-2xl border p-4 md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">Gestion des images et fiabilité</h2>
            <p className="mt-3 text-sm text-slate-700">
              Le système accepte les images via URL web, chemins publics du projet (`/media/...`) et import local
              depuis le disque. Les images locales sont converties dans un format exploitable en ligne afin de rester
              visibles après déploiement. Une normalisation automatique et un fallback visuel garantissent un affichage
              propre, même quand une source image devient invalide.
            </p>
          </section>

          <section className="rounded-2xl border p-4 md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">Objectif du projet</h2>
            <p className="mt-3 text-sm text-slate-700">
              Fournir une base e-commerce professionnelle, évolutive et exploitable en production, avec une expérience
              fluide pour le client et des outils complets pour l’administration commerciale et opérationnelle.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
