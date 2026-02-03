export type ApiError = {
  error: string
  details?: unknown
}

const TOKEN_STORAGE_KEY = 'auth_token'

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(TOKEN_STORAGE_KEY)
    else localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // ignore
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

function buildUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (API_BASE_URL) return `${API_BASE_URL}${path}`
  return path
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = getStoredToken()
  const headers = new Headers(init?.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(buildUrl(path), { ...init, headers })
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path)
  if (!res.ok) {
    const data = (await safeJson(res)) as ApiError | undefined
    throw new Error(data?.error || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = (await safeJson(res)) as ApiError | undefined
    throw new Error(data?.error || `HTTP ${res.status}`)
  }

  return (await res.json()) as T
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch(path, {
    method: 'DELETE',
  })

  if (!res.ok) {
    const data = (await safeJson(res)) as ApiError | undefined
    throw new Error(data?.error || `HTTP ${res.status}`)
  }

  return (await res.json()) as T || {} as T
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = (await safeJson(res)) as ApiError | undefined
    throw new Error(data?.error || `HTTP ${res.status}`)
  }

  return (await res.json()) as T
}

async function safeJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}
