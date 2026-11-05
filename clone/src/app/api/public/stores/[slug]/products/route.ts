import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/tenant";

// GET: catalogue public (produits actifs), filtres: category, q
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const store = await getStoreBySlug(slug);
  if (!store || store.status !== "published") return Response.json({ error: "STORE_NOT_FOUND" }, { status: 404 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.toLowerCase() ?? "";
  const category = url.searchParams.get("category") ?? "";
  const products = await prisma.product.findMany({
    where: {
      storeId: store.id,
      isActive: true,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(category ? { category: { slug: category } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, description: true, priceMinor: true, stock: true, imageUrl: true, category: { select: { name: true, slug: true } } },
  });
  // M5: variantes actives (prix mini = base + delta min, stock agrégé)
  const vmap = await import("@/lib/variants").then((m) => m.listActiveVariantsForProducts(products.map((p) => p.id)));
  return Response.json({
    products: products.map((p) => {
      const vs = vmap.get(p.id) ?? [];
      const hasVariants = vs.length > 0;
      return {
        ...p,
        variants: vs,
        hasVariants,
        displayPriceMinor: hasVariants ? p.priceMinor + Math.min(...vs.map((v) => v.priceDeltaMinor)) : p.priceMinor,
        displayStock: hasVariants ? vs.reduce((s, v) => s + v.stock, 0) : p.stock,
      };
    }),
  });
}
