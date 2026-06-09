export type CartItem = {
  productId: number
  nom: string
  prix: number
  quantite: number
  imagePrincipale?: string | null
  marque?: string | null
  categorieNom?: string | null
}

type CartState = {
  items: CartItem[]
}

const CART_KEY = 'cart_v1'

function readState(): CartState {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return { items: [] }
    const parsed = JSON.parse(raw) as CartState
    if (!parsed?.items || !Array.isArray(parsed.items)) return { items: [] }
    return { items: parsed.items }
  } catch {
    return { items: [] }
  }
}

function writeState(state: CartState) {
  localStorage.setItem(CART_KEY, JSON.stringify(state))
}

export function getCartItems(): CartItem[] {
  return readState().items
}

export function clearCart() {
  writeState({ items: [] })
}

export function addToCart(item: Omit<CartItem, 'quantite'>, quantite = 1) {
  const qty = Math.max(1, Math.floor(quantite))
  const state = readState()

  const existing = state.items.find((i) => i.productId === item.productId)
  if (existing) {
    existing.quantite += qty
  } else {
    state.items.push({ ...item, quantite: qty })
  }

  writeState(state)
}

export function setQuantity(productId: number, quantite: number) {
  const qty = Math.max(1, Math.floor(quantite))
  const state = readState()
  const existing = state.items.find((i) => i.productId === productId)
  if (!existing) return
  existing.quantite = qty
  writeState(state)
}

export function removeFromCart(productId: number) {
  const state = readState()
  state.items = state.items.filter((i) => i.productId !== productId)
  writeState(state)
}

export function getCartTotals() {
  const items = getCartItems()
  const sousTotal = items.reduce((sum, i) => sum + i.prix * i.quantite, 0)
  return {
    items,
    sousTotal,
    total: sousTotal,
  }
}
