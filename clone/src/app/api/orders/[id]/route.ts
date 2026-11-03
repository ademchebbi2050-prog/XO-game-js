import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";
import { normalizeTnPhone } from "@/lib/phone";

async function ownedOrder(storeId: string, id: string) {
  return prisma.order.findFirst({
    where: { id, storeId },
    include: { items: true, statusHistory: { orderBy: { createdAt: "desc" } }, callAttempts: { orderBy: { at: "desc" } }, carrier: true },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store }) => {
    const order = await ownedOrder(store.id, id);
    if (!order) return bad("NOT_FOUND", 404);
    return Response.json({ order });
  });
}

// PATCH: édite les infos client/adresse (pas les articles en M1)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store }) => {
    const order = await ownedOrder(store.id, id);
    if (!order) return bad("NOT_FOUND", 404);
    const b = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof b.customerName === "string" && b.customerName.trim()) data.customerName = b.customerName.trim();
    if (typeof b.address === "string" && b.address.trim()) data.address = b.address.trim();
    if (typeof b.governorate === "string" && b.governorate.trim()) data.governorate = b.governorate.trim();
    if (typeof b.customerPhone === "string" && b.customerPhone.trim()) {
      const p = normalizeTnPhone(b.customerPhone);
      if (!p) return bad("PHONE_INVALID");
      data.customerPhone = p;
    }
    const updated = await prisma.order.update({ where: { id: order.id }, data });
    return Response.json({ order: updated });
  });
}
