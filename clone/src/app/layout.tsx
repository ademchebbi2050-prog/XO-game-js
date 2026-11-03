import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { dirOf, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Boutik — vendez en ligne, payé à la livraison",
  description: "Créez votre boutique en ligne et gérez vos commandes avec paiement à la livraison.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const fromHeader = headerStore.get("x-locale");
  const fromCookie = cookieStore.get("locale")?.value;
  const locale: Locale = isLocale(fromHeader) ? fromHeader : isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;

  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body className="min-h-dvh bg-bg text-text antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
