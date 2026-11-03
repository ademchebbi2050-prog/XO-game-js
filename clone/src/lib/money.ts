// Argent = entiers de millimes TND (unité mineure), jamais de float.
export const CURRENCY = "TND";

export function formatMoney(minor: number, locale: "fr" | "ar"): string {
  const loc = locale === "ar" ? "ar-TN" : "fr-TN";
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(minor / 1000);
}

/** "79000" -> "79" (pour les champs de saisie en TND entiers/décimaux). */
export function minorToInput(minor: number): string {
  return (minor / 1000).toString();
}

/** "79" / "79,5" / "79.900" -> millimes, ou null si invalide. */
export function inputToMinor(input: string): number | null {
  const s = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 1000);
}
