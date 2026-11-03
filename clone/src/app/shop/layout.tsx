import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { StoreProvider } from "@/components/store-provider";
import { LangSwitch } from "@/components/ui";
import { getStoreBySlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Layout boutique publique (<slug>.<domaine>): le slug vient de l'en-tête
// x-store-slug posée par le middleware. Boutique inconnue -> 404.
// Aucune session ici: uniquement des lectures publiques scoping storeId.
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const slug = h.get("x-store-slug") ?? "";
  const store = await getStoreBySlug(slug);
  if (!store || store.status !== "published") notFound();

  return (
    <StoreProvider slug={store.slug} name={store.name}>
      <div className="flex min-h-dvh flex-col bg-bg">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
          <Link href="/shop" className="text-lg font-extrabold text-accent">{store.name}</Link>
          <div className="ms-auto flex items-center gap-3">
            <LangSwitch />
            <Link href="/shop/cart" className="text-sm font-semibold text-text hover:text-accent">{/* panier */}
              🛒
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[680px] flex-1 p-4">{children}</main>
        <footer className="border-t border-border py-4 text-center text-xs text-text-muted">
          {store.name} — {slug}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN?.replace(/^app\./, "") ?? ""}
        </footer>
      </div>
    </StoreProvider>
  );
}
