import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";

// PATCH: réglages de la boutique active (vérifie que id == boutique du cookie)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return withStore(req, async ({ store }) => {
    if (store.id !== id) return bad("FORBIDDEN", 403);
    const b = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
    if (b.status === "draft" || b.status === "published") data.status = b.status;
    // M5: merge superficiel des settings (theme, commissionBps, defaultDeliveryFeeMinor...)
    if (typeof b.settings === "object" && b.settings) {
      const cur = (store.settings ?? {}) as Record<string, unknown>;
      data.settings = { ...cur, ...(b.settings as Record<string, unknown>) };
    }
    const updated = await prisma.store.update({ where: { id: store.id }, data });
    return Response.json({ store: updated });
  });
}
