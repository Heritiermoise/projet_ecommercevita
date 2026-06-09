import app from '../backend/index.js'

// Ce fichier gère toutes les routes non-/api
// (les routes /api/* sont gérées par [...slug].js)
// Les routes SPA comme /inscription sont routées ici par Vercel
// Express servira index.html qui laissera React Router prendre le contrôle
export default app
