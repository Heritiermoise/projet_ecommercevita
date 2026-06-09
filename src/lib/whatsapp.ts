export function normalizeWhatsAppNumber(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed.replace(/[^0-9]/g, '')
}

export function buildWhatsAppUrl(number: string, message: string) {
  const n = normalizeWhatsAppNumber(number)
  if (!n) return null
  const text = encodeURIComponent(message)
  return `https://wa.me/${n}?text=${text}`
}
