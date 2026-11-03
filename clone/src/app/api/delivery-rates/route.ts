import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";
import { GOVERNORATES } from "@/lib/governorates";
import { inputToMinor } from "@/lib/money";

// GET: tarifs de livraison de la boutique (24 gouvernorats)
export async function GET(req: Request) {
  return withStore(req, async ({ store }) => {
    const rates = await prisma.deliveryRate.findMany({ where: { storeId: store.id } });
    const byGov = new Map(rates.map((r) => [r.governorate, r.feeMinor]));
    return Response.json({
      rates: GOVERNORATES.map((g) => ({ governorate: g.slug, feeMinor: byGov.get(g.slug) ?? null })),
    });
  });
}

// POST: enregistre les tarifs [{governorate, feeMinor}] (upsert)
export async function POST(req: Request) {
  return withStore(req, async ({ store }) => {
    const b = await req.json().catch(() => ({}));
    const list = Array.isArray(b.rates) ? b.rates : [];
    for (const r of list) {
      const gov = String(r.governorate ?? "");
      if (!GOVERNORATES.some((g) => g.slug === gov)) continue;
      const feeMinor = typeof r.feeMinor === "number" ? r.feeMinor : inputToMinor(String(r.fee ?? ""));
      if (feeMinor === null || feeMinor < 0) return bad("FEE_INVALID");
      await prisma.deliveryRate.upsert({
        where: { storeId_governorate: { storeId: store.id, governorate: gov } },
        update: { feeMinor },
        create: { storeId: store.id, governorate: gov, feeMinor },
      });
    }
    return Response.json({ ok: true });
  });
}
