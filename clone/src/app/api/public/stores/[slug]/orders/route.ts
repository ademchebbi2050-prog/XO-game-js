import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/tenant";
import { createOrderWithItems } from "@/lib/orders";
import { normalizeTnPhone } from "@/lib/phone";
import { isRateLimited, hitRateLimit, isPhoneBlocked } from "@/lib/rate-limit";
import { DEFAULT_DELIVERY_FEE_MINOR, GOVERNORATES } from "@/lib/governorates";

// POST: commande publique COD.
// Garde-fous: rate limit IP + téléphone (fenêtre fixe), numéro bloqué -> 403,
// téléphone +216 validé, idempotency-key (anti double-submit), stock conditionnel
// en transaction. Jamais d'accès aux données d'une autre boutique (storeId du slug).
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const store = await getStoreBySlug(slug);
  if (!store || store.status !== "published") return Response.json({ error: "STORE_NOT_FOUND" }, { status: 404 });

  // IP réelle derrière Vercel/proxy
  const fwd = req.headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0].trim() : "unknown").slice(0, 45);

  const b = await req.json().catch(() => ({}));
  const phone = normalizeTnPhone(String(b.customerPhone ?? ""));
  if (!phone) return Response.json({ error: "PHONE_INVALID" }, { status: 400 });

  // rate limiting: 5/10min par IP, 3/h par téléphone
  const rules = [
    { prefix: `ip:${ip}`, limit: 5, windowMs: 10 * 60 * 1000 },
    { prefix: `phone:${phone}`, limit: 3, windowMs: 60 * 60 * 1000 },
  ];
  if (await isRateLimited(rules)) {
    return Response.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }
  if (await isPhoneBlocked(phone)) {
    return Response.json({ error: "PHONE_BLOCKED" }, { status: 403 });
  }

  const name = String(b.customerName ?? "").trim();
  const governorate = String(b.governorate ?? "").trim();
  const address = String(b.address ?? "").trim();
  if (!name || !address || !GOVERNORATES.some((g) => g.slug === governorate)) {
    return Response.json({ error: "INVALID_FORM" }, { status: 400 });
  }
  const rawItems = (Array.isArray(b.items) ? b.items : []) as { productId?: unknown; qty?: unknown }[];
  if (!rawItems.length) return Response.json({ error: "EMPTY_ORDER" }, { status: 400 });

  const productIds = rawItems.map((i) => String(i.productId ?? "")).filter(Boolean);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, storeId: store.id, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = [];
  for (const i of rawItems) {
    const p = byId.get(String(i.productId ?? ""));
    const qty = Number(i.qty ?? 1);
    if (!p || !Number.isInteger(qty) || qty <= 0) {
      return Response.json({ error: "ITEM_INVALID" }, { status: 400 });
    }
    items.push({ productId: p.id, name: p.name, priceMinor: p.priceMinor, qty });
  }

  const rate = await prisma.deliveryRate.findUnique({
    where: { storeId_governorate: { storeId: store.id, governorate } },
  });
  const deliveryFeeMinor =
    rate?.feeMinor ??
    (store.settings as { defaultDeliveryFeeMinor?: number })?.defaultDeliveryFeeMinor ??
    DEFAULT_DELIVERY_FEE_MINOR;

  const idempotencyKey = req.headers.get("idempotency-key")?.slice(0, 80) ?? null;

  try {
    const { order, replayed } = await createOrderWithItems({
      storeId: store.id,
      source: "web",
      customerName: name,
      customerPhone: phone,
      governorate,
      address,
      items,
      deliveryFeeMinor,
      idempotencyKey,
    });
    if (!replayed) await hitRateLimit(rules);
    return Response.json({ order: { id: order.id, number: order.number, totalMinor: order.totalMinor, status: order.status } }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ORDER_FAILED";
    if (msg.startsWith("OUT_OF_STOCK")) {
      return Response.json({ error: "OUT_OF_STOCK", product: msg.split(":")[1] }, { status: 409 });
    }
    return Response.json({ error: msg }, { status: 400 });
  }
}
