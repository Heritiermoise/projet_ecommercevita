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
