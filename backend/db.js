import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const useSsl = ['1', 'true', 'yes'].includes(String(process.env.DB_SSL || '').toLowerCase())

const baseConfig = {
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
  namedPlaceholders: true,
  timezone: 'Z',
  ssl: useSsl
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
}

let pool

if (process.env.DATABASE_URL) {
  console.log('[DATABASE] Connecting via DATABASE_URL...')
  // Check if it's a postgres URL while using mysql2
  if (process.env.DATABASE_URL.startsWith('postgres://')) {
    console.error('[DATABASE] ERROR: You are using a PostgreSQL URL with a MySQL driver!')
    console.error('If you moved to Supabase Postgres, you must adapt the backend or use a MySQL compatible DB.')
  }
  pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ...baseConfig,
  })
} else {
  const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME']
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`)
    }
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    ...baseConfig,
  })
}

export { pool }
