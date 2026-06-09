import app from '../backend/index.js'

// Vercel fait passer les requêtes directement à Express
// Express va gérer tous les routes: /api/*, les fichiers statiques, et le fallback SPA
export default app