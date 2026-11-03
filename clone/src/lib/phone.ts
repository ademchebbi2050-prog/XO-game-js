// Téléphone tunisien: normalisé en E.164 (+216 + 8 chiffres).
export function normalizeTnPhone(input: string): string | null {
  let s = input.replace(/[\s.-]/g, "");
  if (s.startsWith("+216")) s = s.slice(4);
  else if (s.startsWith("216")) s = s.slice(3);
  else if (s.startsWith("00216")) s = s.slice(5);
  if (!/^[0-9]{8}$/.test(s)) return null;
  return "+216" + s;
}

export function isValidTnPhoneE164(phone: string): boolean {
  return /^\+216[0-9]{8}$/.test(phone);
}

/** Lien tel: et wa.me à partir d'un E.164 +216... */
export function telHref(phone: string): string {
  return `tel:${phone}`;
}
export function whatsappHref(phone: string, text?: string): string {
  const num = phone.replace(/^\+/, "");
  const msg = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${num}${msg}`;
}
