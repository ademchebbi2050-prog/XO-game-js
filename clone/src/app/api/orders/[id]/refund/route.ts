import { withStore, bad } from "@/lib/api";
import { applyPspEvent } from "@/lib/psp";
import { prisma } from "@/lib/db";

// POST /api/orders/[id]/refund — rembourse une commande payée par carte (M5).
// PSP simulé: webhook payment.refunded. COD: passe juste payment_status en 'refunded'.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store }) => {
    const order = await prisma.order.findFirst({ where: { id, storeId: store.id } });
    if (!order) return bad("NOT_FOUND", 404);
    if (order.paymentStatus !== "paid") return bad("NOT_PAID", 409);
    if (order.paymentMethod === "card") {
      const txs = await prisma.$queryRawUnsafe<{ psp_ref: string }[]>(
        "select psp_ref from psp_transactions where order_id = $1 and status = 'paid' order by created_at desc limit 1", order.id
      );
      if (!txs[0]) return bad("PSP_TX_NOT_FOUND", 404);
      await applyPspEvent({ pspRef: txs[0].psp_ref, event: "payment.refunded" });
    } else {
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "refunded" } });
    }
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    return Response.json({ order: updated });
  });
}
