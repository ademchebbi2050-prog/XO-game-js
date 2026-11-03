import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";
import { applyStatusChange } from "@/lib/orders";
import "@/lib/carriers/simulated"; // enregistre l'adapter simulé
import { getCarrier } from "@/lib/carriers";

// POST: expédie la commande via un transporteur (adapter simulé en dev)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store, user }) => {
    const order = await prisma.order.findFirst({
      where: { id, storeId: store.id },
      include: { items: true },
    });
    if (!order) return bad("NOT_FOUND", 404);
    const b = await req.json().catch(() => ({}));
    const carrier = await prisma.carrier.findFirst({
      where: { id: String(b.carrierId ?? ""), isActive: true },
    });
    if (!carrier) return bad("CARRIER_INVALID");

    const adapter = getCarrier(carrier.code) ?? getCarrier("sim");
    if (!adapter) return bad("NO_ADAPTER", 500);
    const shipment = await adapter.createShipment({
      id: order.id,
      number: order.number,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.address,
      governorate: order.governorate,
      totalMinor: order.totalMinor,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { carrierId: carrier.id, trackingNumber: shipment.trackingNumber },
    });
    const updated = await applyStatusChange({
      orderId: order.id,
      storeId: store.id,
      to: "shipped",
      note: `Expédiée via ${carrier.name} (${shipment.trackingNumber})`,
      userId: user.id,
    });
    return Response.json({ order: updated, trackingNumber: shipment.trackingNumber });
  });
}
