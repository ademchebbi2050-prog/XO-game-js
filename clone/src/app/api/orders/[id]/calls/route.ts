import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";
import { maybeMarkUnreachable } from "@/lib/orders";
import type { CallOutcome } from "@/generated/prisma/client";

const OUTCOMES: CallOutcome[] = ["answered", "no_answer", "busy", "whatsapp"];

// POST: log un appel (bouton Appeler / WhatsApp) + pose `unreachable` après 3 no_answer
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store, user }) => {
    const order = await prisma.order.findFirst({ where: { id, storeId: store.id } });
    if (!order) return bad("NOT_FOUND", 404);
    const b = await req.json().catch(() => ({}));
    const outcome = String(b.outcome ?? "") as CallOutcome;
    if (!OUTCOMES.includes(outcome)) return bad("OUTCOME_INVALID");
    const attempt = await prisma.orderCallAttempt.create({
      data: { orderId: order.id, outcome, note: typeof b.note === "string" ? b.note : null, userId: user.id },
    });
    await maybeMarkUnreachable(order.id, store.id, user.id);
    const refreshed = await prisma.order.findUnique({ where: { id: order.id } });
    return Response.json({ attempt, order: refreshed });
  });
}
