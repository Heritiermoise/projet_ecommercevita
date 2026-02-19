# Projet e-commerce (React + Vite + Tailwind)

Base de projet e-commerce en React/TypeScript avec Tailwind CSS configuré.

## Démarrer

```bash
npm install
npm run dev
```

## API (MySQL)

Le front récupère les données via `/api/*` (proxy Vite). Une petite API Express est dans [server/index.js](server/index.js).

1) Crée un fichier `.env` à la racine (copie de [.env.example](.env.example))
2) Configure `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
3) Lance l’API:

```bash
npm run dev:api
```

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
