import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

function getFirstDefinedEnv(keys, defaultValue) {
  for (const key of keys) {
    const value = process.env[key]
    if (value !== undefined && String(value).trim() !== '') return value
  }
  return defaultValue
}

function isRailwayInternal(value) {
  return /railway\.internal/i.test(String(value || ''))
}

function pickDatabaseUrl() {
  const publicCandidates = [
    'DATABASE_URL',
    'URL_PUBLIC_MYSQL',
    'MYSQL_PUBLIC_URL',
    'MYSQL_URL',
    'MYSQLURL',
  ]

  for (const key of publicCandidates) {
    const value = process.env[key]
    if (value && !isRailwayInternal(value)) return value
  }

  const anyCandidates = ['DATABASE_URL', 'URL_PUBLIC_MYSQL', 'MYSQL_PUBLIC_URL', 'MYSQL_URL', 'MYSQLURL', 'URL_MYSQL', 'MYSQL_PRIVATE_URL']
  return getFirstDefinedEnv(anyCandidates, '')
}

const useSsl = ['1', 'true', 'yes'].includes(String(getFirstDefinedEnv(['DB_SSL', 'MYSQL_SSL'], 'false')).toLowerCase())

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

const dbUrl = pickDatabaseUrl()

if (dbUrl) {
  console.log('[DATABASE] Connecting via Connection String...')
  // Check if it's a postgres URL while using mysql2
  if (dbUrl.startsWith('postgres://')) {
    console.error('[DATABASE] ERROR: You are using a PostgreSQL URL with a MySQL driver!')
    console.error('If you moved to Supabase Postgres, you must adapt the backend or use a MySQL compatible DB.')
  }
  pool = mysql.createPool({
    uri: dbUrl,
    ...baseConfig,
  })
} else {
  const dbHostRaw = getFirstDefinedEnv(['DB_HOST', 'MYSQL_HOST', 'MYSQLHOST'], '')
  const dbHost = isRailwayInternal(dbHostRaw)
    ? getFirstDefinedEnv(['MYSQL_PUBLIC_HOST', 'DB_PUBLIC_HOST'], dbHostRaw)
    : dbHostRaw
  const dbPort = Number(getFirstDefinedEnv(['DB_PORT', 'MYSQL_PORT', 'MYSQLPORT'], '3306'))
  const dbUser = getFirstDefinedEnv(['DB_USER', 'MYSQL_USER', 'MYSQLUSER'], 'root')
  const dbPassword = getFirstDefinedEnv(['DB_PASSWORD', 'MYSQL_PASSWORD', 'MYSQLPASSWORD', 'MYSQL_ROOT_PASSWORD'], '')
  const dbName = getFirstDefinedEnv(['DB_NAME', 'MYSQL_DATABASE', 'MYSQLDATABASE'], '')

  const requiredEnv = [
    ['DB_HOST/MYSQL_HOST/MYSQLHOST', dbHost],
    ['DB_NAME/MYSQL_DATABASE/MYSQLDATABASE', dbName],
  ]
  for (const key of requiredEnv) {
    if (!key[1]) {
      throw new Error(`Missing required env var(s): ${key[0]}`)
    }
  }

  pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ...baseConfig,
  })
}

export { pool }
