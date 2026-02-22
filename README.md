# Projet e-commerce (React + Vite + Tailwind)

Base de projet e-commerce en React/TypeScript avec Tailwind CSS configuré.

## Démarrer

```bash
npm install
npm run dev
```

## API (MySQL)

Le front récupère les données via `/api/*` (proxy Vite). L’API Express est dans [backend/index.js](backend/index.js).

Note: cette API utilise un driver **MySQL/MariaDB** (`mysql2`). Une clé API Supabase (`sb_secret_*`) ne remplace pas des identifiants SQL de connexion.

1) Crée un fichier `.env` à la racine (copie de [.env.example](.env.example))
2) Configure `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
3) Lance l’API:

```bash
npm run dev:api
```

## Déploiement Vercel (Front + Back dans le même repo)

- Le backend Node est exposé par [backend/index.js](backend/index.js) (export par défaut, sans `app.listen`).
- Le routage Vercel est défini dans [vercel.json](vercel.json):
	- `/api/*` vers le backend Node
	- le reste vers `index.html` (SPA React)

### Variables d'environnement à définir sur Vercel

Définis ces variables dans le dashboard Vercel (Project Settings > Environment Variables):

- `JWT_SECRET`
- `CORS_ORIGIN`
- Soit `DATABASE_URL` (recommandé), soit les variables séparées `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_SSL=true` si ton hébergeur DB exige TLS
- `VITE_SUPABASE_URL`: URL de ton projet Supabase
- `VITE_SUPABASE_ANON_KEY`: TA clé anonyme Supabase (Anon Key)

### Variables Railway (MySQL)

Le backend accepte maintenant automatiquement les noms Railway courants:

- URL de connexion: `DATABASE_URL`, `URL_PUBLIC_MYSQL`, `URL_MYSQL`, `MYSQL_URL`, `MYSQL_PRIVATE_URL`
- Variables séparées: `MYSQLHOST`/`MYSQL_HOST`, `MYSQLPORT`/`MYSQL_PORT`, `MYSQLUSER`/`MYSQL_USER`, `MYSQLPASSWORD`/`MYSQL_PASSWORD`, `MYSQLDATABASE`/`MYSQL_DATABASE`

Recommandé sur Railway:

1. Définir seulement `DATABASE_URL` avec ta valeur Railway publique MySQL
2. Définir `DB_SSL=true`
3. Définir `JWT_SECRET` (long et aléatoire)
4. Laisser `start` = `node backend/index.js`

Important sécurité:

- Ne commit jamais de clé secrète (`sb_secret_*`, mots de passe DB, JWT, SMTP) dans Git.
- Si une clé a été partagée publiquement, régénère-la immédiatement.

### Contrainte numéro téléphone unique (important)

Avant le déploiement final, exécute la migration SQL sur ta base distante:

- [backend/sql/001_phone_unique_constraint.sql](backend/sql/001_phone_unique_constraint.sql)

Cette migration ajoute une contrainte d’unicité sur un téléphone normalisé (espaces, `+`, `-`, parenthèses, points ignorés), pour empêcher les doublons même avec des formats différents.

## Images du site (produits et bannières)

- Dossier public recommandé pour les images versionnées: [public/media/README.md](public/media/README.md)
- Tu peux utiliser:
	- URL web (`https://...`)
	- chemin public (`/media/produits/...`, `/media/bannieres/...`)
	- import local depuis le disque (converti pour rester visible en ligne)

### Migration DB pour images importées localement

Pour stocker des images importées localement (format base64), exécute:

- [backend/sql/003_expand_image_columns_for_local_upload.sql](backend/sql/003_expand_image_columns_for_local_upload.sql)

## Paiement (Airtel Money & WhatsApp)

Le projet inclut plusieurs modes de paiement :
1) **Airtel Money** (Push USSD)
2) **Maisha Pay** (Visa/Mastercard/Mobile Money)
3) **WhatsApp Payment** (Génération de commande + redirection messagerie)
4) **Paiement à la livraison**

### WhatsApp Checkout
Le mode WhatsApp permet de créer une commande en base de données, puis de rediriger l'utilisateur vers le service client avec un message professionnel contenant :
- Référence de la commande
- Nom du client
- Liste détaillée des articles
- Total en USD

Configurez le numéro du marchand dans `.env` :
- `VITE_SUPPORT_WHATSAPP_NUMBER=243977342386`

### Airtel Money (Mock)
Par défaut, c'est en mode **mock** (pas d'appel externe). Configure dans `.env`:
- `AIRTEL_MONEY_MODE=mock`

Important: le site **ne demande jamais le code secret/PIN** du client. La confirmation se fait sur le téléphone (OTP/USSD) via Airtel Money.

## Support WhatsApp

Tu peux activer un bouton de support WhatsApp (Header + Footer) via:

- `VITE_SUPPORT_WHATSAPP_NUMBER=243977342386`

Utilise le format international sans `+` pour que `wa.me` fonctionne.

## Build production

```bash
npm run build
npm run preview
```

## Tailwind

- Configuration: [tailwind.config.js](tailwind.config.js)
- PostCSS: [postcss.config.js](postcss.config.js)
- Styles globaux: [src/index.css](src/index.css)

Pour vérifier rapidement que Tailwind fonctionne, le layout de démo est dans [src/App.tsx](src/App.tsx).
# projet_ecommerce
