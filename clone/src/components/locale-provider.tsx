"use client";

import { createContext, useContext, useMemo } from "react";
import { createT, getMessages, dirOf, type Locale } from "@/lib/i18n";

type Ctx = { locale: Locale; t: (key: string, vars?: Record<string, string | number>) => string };
const LocaleCtx = createContext<Ctx>({ locale: "fr", t: (k) => k });

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => ({ locale, t: createT(locale) }), [locale]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  return useContext(LocaleCtx);
}

/** Expose aussi les messages brutes pour les composants serveur légers. */
export function messagesFor(locale: Locale) {
  return getMessages(locale);
}

export { dirOf };
