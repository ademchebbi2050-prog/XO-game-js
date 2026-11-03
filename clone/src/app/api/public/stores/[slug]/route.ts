import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/tenant";

// GET: infos publiques de la boutique (publiée uniquement) + catégories
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const store = await getStoreBySlug(slug);
  if (!store || store.status !== "published") {
    return Response.json({ error: "STORE_NOT_FOUND" }, { status: 404 });
  }
  const categories = await prisma.category.findMany({
    where: { storeId: store.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  return Response.json({
    store: {
      name: store.name,
      slug: store.slug,
      currency: store.currency,
      defaultLocale: store.defaultLocale,
    },
    categories,
  });
}
