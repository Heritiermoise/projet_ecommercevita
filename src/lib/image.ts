export const PRODUCT_IMAGE_FALLBACK = '/vite.svg'

function isValidImageHost(hostname: string) {
  if (!hostname) return false
  if (hostname === 'localhost') return true
  if (hostname.includes('.')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true
  return false
}

export function normalizeProductImageUrl(value: string | null | undefined): string | null {
  if (!value) return null

  let normalized = String(value).trim()
  if (!normalized) return null

  normalized = normalized.replace(/^['"]+|['"]+$/g, '')
  normalized = normalized.replace(/\\+/g, '/')

  if (!normalized) return null

  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(normalized)) {
    return normalized
  }

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized)
      if (!isValidImageHost(parsed.hostname)) return null
      return parsed.toString()
    } catch {
      return null
    }
  }

  if (normalized.startsWith('//')) return `https:${normalized}`

  if (/^[A-Za-z]:\//.test(normalized)) {
    normalized = normalized.replace(/^[A-Za-z]:\//, '/')
  }

  if (normalized.startsWith('/')) return normalized

  if (normalized.includes('/')) return `/${normalized.replace(/^\/+/, '')}`

  return null
}
