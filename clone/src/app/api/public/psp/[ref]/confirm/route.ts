import { applyPspEvent, getPspByRef } from "@/lib/psp";
import { prisma } from "@/lib/db";

// POST /api/public/psp/<ref>/confirm — action du hosted-checkout SIMULÉ (boutons Payer / Refuser).
// Idempotent (applyPspEvent). Corps: { action: "approve" | "fail" }
export async function POST(req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const action = b.action === "approve" ? "payment.succeeded" : b.action === "fail" ? "payment.failed" : null;
  if (!action) return Response.json({ error: "ACTION_INVALID" }, { status: 400 });
  const existing = await getPspByRef(ref);
  if (!existing) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const res = await applyPspEvent({ pspRef: ref, event: action });
  if (!res) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const order = await prisma.order.findUnique({ where: { id: res.orderId }, select: { id: true, number: true, paymentStatus: true, storeId: true } });
  return Response.json({
    pspRef: res.tx.pspRef,
    status: res.tx.status,
    authCode: res.tx.authCode,
    order: order ? { id: order.id, number: order.number, paymentStatus: order.paymentStatus } : null,
  });
}
