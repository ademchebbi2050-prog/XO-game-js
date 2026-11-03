import type { Locale } from "@/lib/i18n";

export function formatDate(d: Date | string, locale: Locale): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : "fr-TN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-TN" : "fr-TN").format(n);
}

export function formatPercent(part: number, total: number, locale: Locale): string {
  const pct = total === 0 ? 0 : Math.round((part / total) * 100);
  return `${formatNumber(pct, locale)} %`;
}
