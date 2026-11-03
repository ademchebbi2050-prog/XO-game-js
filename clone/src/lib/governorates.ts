// 24 gouvernorats de Tunisie, slugs + libellés fr/ar.
export const DEFAULT_DELIVERY_FEE_MINOR = 7000; // 7,000 TND par défaut

export interface Governorate {
  slug: string;
  fr: string;
  ar: string;
}

export const GOVERNORATES: Governorate[] = [
  { slug: "tunis", fr: "Tunis", ar: "تونس" },
  { slug: "ariana", fr: "Ariana", ar: "أريانة" },
  { slug: "ben-arous", fr: "Ben Arous", ar: "بن عروس" },
  { slug: "manouba", fr: "Manouba", ar: "منوبة" },
  { slug: "nabeul", fr: "Nabeul", ar: "نابل" },
  { slug: "zaghouan", fr: "Zaghouan", ar: "زغوان" },
  { slug: "bizerte", fr: "Bizerte", ar: "بنزرت" },
  { slug: "beja", fr: "Béja", ar: "باجة" },
  { slug: "jendouba", fr: "Jendouba", ar: "جندوبة" },
  { slug: "kef", fr: "Le Kef", ar: "الكاف" },
  { slug: "siliana", fr: "Siliana", ar: "سليانة" },
  { slug: "kasserine", fr: "Kasserine", ar: "القصرين" },
  { slug: "sidi-bouzid", fr: "Sidi Bouzid", ar: "سيدي بوزيد" },
  { slug: "sousse", fr: "Sousse", ar: "سوسة" },
  { slug: "monastir", fr: "Monastir", ar: "المنستير" },
  { slug: "mahdia", fr: "Mahdia", ar: "المهدية" },
  { slug: "sfax", fr: "Sfax", ar: "صفاقس" },
  { slug: "kairouan", fr: "Kairouan", ar: "القيروان" },
  { slug: "gabes", fr: "Gabès", ar: "قابس" },
  { slug: "medenine", fr: "Médenine", ar: "مدنين" },
  { slug: "tataouine", fr: "Tataouine", ar: "تطاوين" },
  { slug: "gafsa", fr: "Gafsa", ar: "قفصة" },
  { slug: "tozeur", fr: "Tozeur", ar: "توزر" },
  { slug: "kebili", fr: "Kébili", ar: "قبلي" },
];

export function governorateLabel(slug: string, locale: "fr" | "ar"): string {
  return GOVERNORATES.find((g) => g.slug === slug)?.[locale] ?? slug;
}
