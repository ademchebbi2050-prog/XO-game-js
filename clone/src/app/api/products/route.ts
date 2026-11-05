import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";
import { inputToMinor } from "@/lib/money";
import { listVariants, saveVariants } from "@/lib/variants";

// GET: liste des produits de la boutique active (filtres: q, active)
export async function GET(req: Request) {
  return withStore(req, async ({ store }) => {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const products = await prisma.product.findMany({
      where: {
        storeId: store.id,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true, slug: true } } },
    });
    // M5: variantes actives de chaque produit
    const vmap = await import("@/lib/variants").then((m) => m.listActiveVariantsForProducts(products.map((p) => p.id)));
    return Response.json({ products: products.map((p) => ({ ...p, variants: vmap.get(p.id) ?? [] })) });
  });
}

// POST: crée un produit
export async function POST(req: Request) {
  return withStore(req, async ({ store }) => {
    const b = await req.json().catch(() => ({}));
    const name = String(b.name ?? "").trim();
    const priceMinor = typeof b.priceMinor === "number" ? b.priceMinor : inputToMinor(String(b.price ?? ""));
    if (!name) return bad("NAME_REQUIRED");
    if (priceMinor === null || priceMinor < 0) return bad("PRICE_INVALID");
    const stock = Number(b.stock ?? 0);
    if (!Number.isInteger(stock) || stock < 0) return bad("STOCK_INVALID");
    const barcode = b.barcode ? String(b.barcode).trim() : null;
    if (barcode) {
      const clash = await prisma.product.findFirst({ where: { storeId: store.id, barcode } });
      if (clash) return bad("BARCODE_TAKEN", 409);
    }
    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        name,
        description: String(b.description ?? ""),
        priceMinor,
        costMinor: typeof b.costMinor === "number" ? b.costMinor : null,
        stock,
        barcode,
        imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : null,
        categoryId: typeof b.categoryId === "string" && b.categoryId ? b.categoryId : null,
        isActive: b.isActive !== false,
      },
    });
    // M5: variantes créées avec le produit
    let variants: unknown[] = [];
    if (Array.isArray(b.variants) && b.variants.length) {
      variants = await saveVariants(product.id, b.variants as { label: string }[]);
    }
    return Response.json({ product: { ...product, variants } }, { status: 201 });
  });
}
