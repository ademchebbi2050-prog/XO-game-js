import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/tenant";
import { DEFAULT_DELIVERY_FEE_MINOR } from "@/lib/governorates";

// GET: tarif de livraison pour un gouvernorat ?governorate=tunis
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const store = await getStoreBySlug(slug);
  if (!store || store.status !== "published") return Response.json({ error: "STORE_NOT_FOUND" }, { status: 404 });
  const gov = new URL(req.url).searchParams.get("governorate") ?? "";
  const rate = gov
    ? await prisma.deliveryRate.findUnique({
        where: { storeId_governorate: { storeId: store.id, governorate: gov } },
      })
    : null;
  const feeMinor =
    rate?.feeMinor ??
    (store.settings as { defaultDeliveryFeeMinor?: number })?.defaultDeliveryFeeMinor ??
    DEFAULT_DELIVERY_FEE_MINOR;
  return Response.json({ governorate: gov, feeMinor });
}
