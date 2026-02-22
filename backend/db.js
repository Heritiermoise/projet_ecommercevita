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

const dbUrl = getFirstDefinedEnv(
  ['DATABASE_URL', 'MYSQL_URL', 'MYSQL_PRIVATE_URL', 'MYSQL_PUBLIC_URL', 'URL_MYSQL', 'URL_PUBLIC_MYSQL', 'MYSQLURL'],
  '',
)

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
  const dbHost = getFirstDefinedEnv(['DB_HOST', 'MYSQL_HOST', 'MYSQLHOST'], '')
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
