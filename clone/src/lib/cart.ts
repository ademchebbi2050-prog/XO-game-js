"use client";

// Panier côté client (localStorage, scoping par boutique). Soumis ensuite
// à POST /api/public/stores/[slug]/orders.
export interface CartItem {
  productId: string;
  variantId?: string | null;   // M5: variante choisie
  name: string;
  priceMinor: number;
  qty: number;
  imageUrl?: string | null;
}

export function getCart(slug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(`cart:${slug}`) ?? "[]");
  } catch {
    return [];
  }
}

export function setCart(slug: string, items: CartItem[]) {
  localStorage.setItem(`cart:${slug}`, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cart-changed"));
}

const keyOf = (c: CartItem) => `${c.productId}::${c.variantId ?? ""}`; // M5: clé = produit + variante
export function addToCart(slug: string, item: CartItem) {
  const cart = getCart(slug);
  const i = cart.findIndex((c) => keyOf(c) === keyOf(item));
  if (i >= 0) cart[i] = { ...cart[i], qty: cart[i].qty + item.qty };
  else cart.push(item);
  setCart(slug, cart);
}

export function setQty(slug: string, productId: string, qty: number, variantId?: string | null) {
  const cart = getCart(slug).map((c) => (c.productId === productId && (c.variantId ?? null) === (variantId ?? null) ? { ...c, qty } : c)).filter((c) => c.qty > 0);
  setCart(slug, cart);
}

export function removeFromCart(slug: string, productId: string, variantId?: string | null) {
  setCart(slug, getCart(slug).filter((c) => !(c.productId === productId && (c.variantId ?? null) === (variantId ?? null))));
}
