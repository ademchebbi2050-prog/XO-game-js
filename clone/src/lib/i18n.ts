import fr from "@/messages/fr.json";
import ar from "@/messages/ar.json";

export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "fr" || v === "ar";
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

const MESSAGES: Record<Locale, Record<string, unknown>> = { fr, ar };

export function getMessages(locale: Locale): Record<string, unknown> {
  return MESSAGES[locale] ?? MESSAGES.fr;
}

/** t("orders.title") avec interpolation {name}. SSR + client (via provider). */
export function createT(locale: Locale) {
  const msgs = getMessages(locale);
  return function t(key: string, vars?: Record<string, string | number>): string {
    let cur: unknown = msgs;
    for (const part of key.split(".")) cur = (cur as Record<string, unknown>)?.[part];
    let s = typeof cur === "string" ? cur : key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export function localeFromCookie(cookieHeader: string | null): Locale {
  const m = cookieHeader?.match(/locale=(ar|fr)/);
  return m ? (m[1] as Locale) : DEFAULT_LOCALE;
}
