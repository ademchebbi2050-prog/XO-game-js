import { prisma } from "@/lib/db";
import { getPspByRef } from "@/lib/psp";

// GET /api/public/psp/<ref> — statut d'une transaction PSP (page /pay/<ref>)
export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  const tx = await getPspByRef(ref);
  if (!tx) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const orders = await prisma.$queryRawUnsafe<{ id: string; number: string; store_id: string; total_minor: number }[]>(
    "select id, number, store_id, total_minor from orders where id = $1", tx.orderId
  );
  const o = orders[0];
  const store = await prisma.store.findUnique({ where: { id: o.store_id }, select: { name: true, slug: true } });
  return Response.json({
    pspRef: tx.pspRef,
    amountMinor: tx.amountMinor,
    currency: tx.currency,
    status: tx.status,
    authCode: tx.authCode,
    order: o ? { id: o.id, number: o.number } : null,
    storeName: store?.name ?? null,
  });
}
