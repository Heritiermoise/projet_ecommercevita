import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import net from 'node:net'

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

function isRailwayRuntime() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT
      || process.env.RAILWAY_PROJECT_ID
      || process.env.RAILWAY_SERVICE_ID,
  )
}

function pickPublicHostFallback() {
  const candidates = [
    'MYSQL_PUBLIC_HOST',
    'DB_PUBLIC_HOST',
    'MYSQLHOST',
    'MYSQL_HOST',
    'RAILWAY_TCP_PROXY_DOMAIN',
    'RAILWAY_PRIVATE_DOMAIN',
    'DB_HOST',
  ]

  for (const key of candidates) {
    const value = process.env[key]
    if (!value) continue
    const trimmed = String(value).trim()
    if (!trimmed || isRailwayInternal(trimmed)) continue
    return trimmed
  }

  return ''
}

function pickPublicPortFallback() {
  return getFirstDefinedEnv(
    ['MYSQL_PUBLIC_PORT', 'DB_PUBLIC_PORT', 'MYSQLPORT', 'MYSQL_PORT', 'DB_PORT'],
    '',
  )
}

function normalizeDatabaseUrl(rawUrl) {
  if (!rawUrl) return ''

  try {
    const url = new URL(rawUrl)
    if (isRailwayInternal(url.hostname) && isRailwayRuntime()) {
      return rawUrl
    }
    if (!isRailwayInternal(url.hostname)) return rawUrl

    const fallbackHost = pickPublicHostFallback()
    if (!fallbackHost) return ''

    url.hostname = fallbackHost
    const fallbackPort = pickPublicPortFallback()
    if (fallbackPort) url.port = String(fallbackPort)
    return url.toString()
  } catch {
    return rawUrl
  }
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
    if (!value) continue
    if (!isRailwayInternal(value) || isRailwayRuntime()) return value
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
let legacyTriggerCleanupPromise = null

function isLocalHost(value) {
  const host = String(value || '').trim().toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

function canReachTcpPort(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let done = false

    const finalize = (result) => {
      if (done) return
      done = true
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finalize(true))
    socket.once('timeout', () => finalize(false))
    socket.once('error', () => finalize(false))

    socket.connect(Number(port), host)
  })
}

async function resolveLocalDbPort(host, explicitPort) {
  if (explicitPort) return Number(explicitPort)
  if (!isLocalHost(host)) return 3306

  const preferredPorts = [3306, 3307]
  for (const port of preferredPorts) {
    const reachable = await canReachTcpPort(host, port)
    if (reachable) {
      if (port !== 3306) {
        console.warn(`[DATABASE] Auto-detected local MySQL port ${port} (DB_PORT not set).`)
      }
      return port
    }
  }

  return 3306
}

const dbUrlRaw = pickDatabaseUrl()
const dbUrl = normalizeDatabaseUrl(dbUrlRaw)

async function createPool() {
  if (dbUrl) {
    console.log('[DATABASE] Connecting via Connection String...')
    if (dbUrl.startsWith('postgres://')) {
      console.error('[DATABASE] ERROR: You are using a PostgreSQL URL with a MySQL driver!')
      console.error('If you moved to Supabase Postgres, you must adapt the backend or use a MySQL compatible DB.')
    }
    return mysql.createPool({
      uri: dbUrl,
      ...baseConfig,
    })
  }

  if (dbUrlRaw && isRailwayInternal(dbUrlRaw)) {
    console.warn('[DATABASE] Ignoring Railway private URL (railway.internal) because it is not resolvable from this runtime.')
    console.warn('[DATABASE] Set MYSQL_PUBLIC_URL / URL_PUBLIC_MYSQL or MYSQL_PUBLIC_HOST + MYSQL_PUBLIC_PORT in your environment.')
  }

  const dbHostRaw = getFirstDefinedEnv(['DB_HOST', 'MYSQL_HOST', 'MYSQLHOST'], '')
  let dbHost = isRailwayInternal(dbHostRaw)
    ? (isRailwayRuntime() ? dbHostRaw : (pickPublicHostFallback() || dbHostRaw))
    : dbHostRaw

  if (isRailwayRuntime() && isLocalHost(dbHost)) {
    const preferredRailwayHost = getFirstDefinedEnv(['MYSQLHOST', 'MYSQL_HOST', 'DB_PUBLIC_HOST', 'MYSQL_PUBLIC_HOST'], '')
    if (preferredRailwayHost && !isLocalHost(preferredRailwayHost)) {
      console.warn(`[DATABASE] Replacing local host ${dbHost} with Railway host ${preferredRailwayHost}.`)
      dbHost = preferredRailwayHost
    }
  }
  const dbPortRaw = getFirstDefinedEnv(['DB_PORT', 'MYSQL_PORT', 'MYSQLPORT'], '')
  const dbPort = await resolveLocalDbPort(dbHost, dbPortRaw)
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

  if (isRailwayRuntime() && isLocalHost(dbHost)) {
    throw new Error(
      'Railway runtime detected but DB host is local (127.0.0.1/localhost). Set MYSQL_URL or MYSQLHOST/MYSQLPORT from Railway MySQL service variables.',
    )
  }

  return mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ...baseConfig,
  })
}

pool = await createPool()

async function removeLegacyPaymentTrigger() {
  if (legacyTriggerCleanupPromise) {
    return legacyTriggerCleanupPromise
  }

  legacyTriggerCleanupPromise = (async () => {
    try {
      await pool.query('DROP TRIGGER IF EXISTS trg_ai_commandes_nettoyage_panier')
      console.log('[DATABASE] Legacy cart-cleanup trigger removed or already absent.')
    } catch (error) {
      console.warn('[DATABASE] Unable to remove legacy trigger trg_ai_commandes_nettoyage_panier:', error?.message || error)
    }
  })()

  return legacyTriggerCleanupPromise
}

await removeLegacyPaymentTrigger()

const TRANSIENT_DB_ERRORS = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
])

function isTransientDbError(error) {
  const code = error?.code ? String(error.code).toUpperCase() : ''
  return TRANSIENT_DB_ERRORS.has(code)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const originalQuery = pool.query.bind(pool)
pool.query = async function queryWithRetry(sql, values, options = {}) {
  const maxRetries = Number(options.maxRetries ?? process.env.DB_QUERY_RETRIES ?? 2)
  const baseDelayMs = Number(options.baseDelayMs ?? process.env.DB_QUERY_RETRY_DELAY_MS ?? 400)

  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await originalQuery(sql, values)
    } catch (error) {
      lastError = error
      if (!isTransientDbError(error) || attempt >= maxRetries) {
        throw error
      }
      const backoff = baseDelayMs * (attempt + 1)
      console.warn(
        `[DATABASE] Query retry ${attempt + 1}/${maxRetries} after transient error (${error.code || 'UNKNOWN'}). Waiting ${backoff}ms.`,
      )
      await sleep(backoff)
    }
  }

  throw lastError
}

export async function testDbConnection() {
  await pool.query('SELECT 1 AS ok')
  return true
}

async function warmupPool() {
  try {
    await testDbConnection()
    console.log('[DATABASE] Pool ready')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[DATABASE] Initial ping failed: ${message}`)
  }
}

warmupPool()

export { pool }
