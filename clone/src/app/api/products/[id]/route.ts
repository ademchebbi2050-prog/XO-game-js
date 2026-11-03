import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";

async function getOwnedProduct(storeId: string, id: string) {
  return prisma.product.findFirst({ where: { id, storeId } });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store }) => {
    const product = await getOwnedProduct(store.id, id);
    if (!product) return bad("NOT_FOUND", 404);
    return Response.json({ product });
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store }) => {
    const product = await getOwnedProduct(store.id, id);
    if (!product) return bad("NOT_FOUND", 404);
    const b = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
    if (typeof b.description === "string") data.description = b.description;
    if (typeof b.priceMinor === "number") data.priceMinor = b.priceMinor;
    if (typeof b.costMinor === "number" || b.costMinor === null) data.costMinor = b.costMinor;
    if (typeof b.stock === "number") data.stock = b.stock;
    if (typeof b.barcode === "string" || b.barcode === null) data.barcode = b.barcode || null;
    if (typeof b.imageUrl === "string" || b.imageUrl === null) data.imageUrl = b.imageUrl || null;
    if (typeof b.categoryId === "string" || b.categoryId === null) data.categoryId = b.categoryId || null;
    if (typeof b.isActive === "boolean") data.isActive = b.isActive;
    const updated = await prisma.product.update({ where: { id: product.id }, data });
    return Response.json({ product: updated });
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store }) => {
    const product = await getOwnedProduct(store.id, id);
    if (!product) return bad("NOT_FOUND", 404);
    if (product.imageUrl) {
      const { removeImage } = await import("@/lib/storage");
      await removeImage(product.imageUrl);
    }
    await prisma.product.delete({ where: { id: product.id } });
    return Response.json({ ok: true });
  });
}
