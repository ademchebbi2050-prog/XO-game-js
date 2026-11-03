import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/tenant";

// GET /api/public/orders/[number]?phone=+216...&slug=boutique-a
// Suivi public: n° de commande + téléphone + slug de boutique. Données client masquées.
export async function GET(req: Request, ctx: { params: Promise<{ number: string }> }) {
  const { number } = await ctx.params;
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone") ?? "";
  const slug = url.searchParams.get("slug") ?? "";
  if (!/^CMD-\d{6}$/.test(number)) return Response.json({ error: "BAD_NUMBER" }, { status: 400 });
  if (!/^\+216[0-9]{8}$/.test(phone)) return Response.json({ error: "BAD_PHONE" }, { status: 400 });

  const store = await getStoreBySlug(slug);
  if (!store) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const order = await prisma.order.findFirst({
    where: { storeId: store.id, number: number.toUpperCase(), customerPhone: phone },
    include: {
      items: { select: { nameSnapshot: true, priceMinor: true, qty: true } },
      statusHistory: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true } },
      carrier: { select: { name: true } },
    },
  });
  if (!order) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  return Response.json({
    order: {
      number: order.number,
      status: order.status,
      trackingNumber: order.trackingNumber,
      carrierName: order.carrier?.name ?? null,
      governorate: order.governorate,
      totalMinor: order.totalMinor,
      deliveryFeeMinor: order.deliveryFeeMinor,
      subtotalMinor: order.subtotalMinor,
      items: order.items,
      history: order.statusHistory,
      createdAt: order.createdAt,
    },
  });
}
