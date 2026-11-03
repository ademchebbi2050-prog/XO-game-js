import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { Store } from "@/generated/prisma/client";
import { RESERVED_SLUGS, hostLabel } from "@/lib/hosts";

export { RESERVED_SLUGS, hostLabel };

/** Boutique publique: slug passé par le middleware via l'en-tête x-store-slug. */
export async function getStoreFromSlugHeader(slug: string | null) {
  if (!slug || RESERVED_SLUGS.has(slug)) return null;
  return prisma.store.findUnique({ where: { slug } });
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  if (RESERVED_SLUGS.has(slug)) return null;
  return prisma.store.findUnique({ where: { slug } });
}

/**
 * Store du commerçant connecté. Le cookie store_id choisit la boutique active
 * (multi-boutique); il doit appartenir à l'utilisateur, sinon on prend sa
 * première boutique. CHAQUE requête métier filtre ensuite par store.id.
 */
export async function requireUserStore(storeIdCookie?: string | null): Promise<{ user: { id: string; email: string; name: string }; store: Store } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const stores = await prisma.store.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (stores.length === 0) return { user, store: null as never }; // géré par l'appelant (onboarding)
  const active =
    (storeIdCookie && stores.find((s) => s.id === storeIdCookie)) || stores[0];
  return { user, store: active };
}

/** Version route handler: lit le cookie store_id depuis la requête. */
export async function requireStoreFromRequest(req: Request): Promise<{ user: { id: string; email: string; name: string }; store: Store } | { user: { id: string; email: string; name: string }; store: null } | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/store_id=([^;]+)/);
  return requireUserStore(m ? decodeURIComponent(m[1]) : null);
}
