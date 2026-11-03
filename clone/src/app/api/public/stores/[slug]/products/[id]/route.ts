import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/tenant";

// GET: détail produit public (actif, de cette boutique)
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await ctx.params;
  const store = await getStoreBySlug(slug);
  if (!store || store.status !== "published") return Response.json({ error: "STORE_NOT_FOUND" }, { status: 404 });
  const product = await prisma.product.findFirst({
    where: { id, storeId: store.id, isActive: true },
    select: { id: true, name: true, description: true, priceMinor: true, stock: true, imageUrl: true, category: { select: { name: true, slug: true } } },
  });
  if (!product) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ product });
}
