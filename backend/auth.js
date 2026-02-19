import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

dotenv.config()

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  throw new Error('Missing required env var: JWT_SECRET')
}

export function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '7d' })
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  let token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

  // Support token in query for direct links (e.g. PDF reports)
  if (!token && req.query.token) {
    token = req.query.token
  }

  if (!token) {
    return res.status(401).json({ error: 'Non authentifié' })
  }

  try {
    const decoded = jwt.verify(token, jwtSecret)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalide' })
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    const user = req.user
    if (!user) return res.status(401).json({ error: 'Non authentifié' })
    if (user.role !== role) return res.status(403).json({ error: 'Accès interdit' })
    next()
  }
}
