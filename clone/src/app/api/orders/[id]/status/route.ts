import { withStore, bad } from "@/lib/api";
import { applyStatusChange } from "@/lib/orders";
import type { OrderStatus } from "@/generated/prisma/client";

const VALID: OrderStatus[] = ["new", "to_confirm", "unreachable", "confirmed", "shipped", "delivered", "returned", "cancelled"];

// POST: transition de statut (règles + remise en stock en transaction)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store, user }) => {
    const b = await req.json().catch(() => ({}));
    const to = String(b.status ?? "") as OrderStatus;
    if (!VALID.includes(to)) return bad("STATUS_INVALID");
    try {
      const order = await applyStatusChange({
        orderId: id,
        storeId: store.id,
        to,
        note: typeof b.note === "string" ? b.note : undefined,
        userId: user.id,
      });
      return Response.json({ order });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "STATUS_FAILED";
      if (msg === "ORDER_NOT_FOUND") return bad("NOT_FOUND", 404);
      if (msg === "INVALID_TRANSITION") return bad("INVALID_TRANSITION", 409);
      return bad(msg, 400);
    }
  });
}
