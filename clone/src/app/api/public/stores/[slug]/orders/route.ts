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
  const rawItems = (Array.isArray(b.items) ? b.items : []) as { productId?: unknown; qty?: unknown; variantId?: unknown }[];
  if (!rawItems.length) return Response.json({ error: "EMPTY_ORDER" }, { status: 400 });

  // M5: moyen de paiement (cod par défaut, 'card' = PSP simulé)
  const paymentMethod = b.paymentMethod === "card" ? "card" : "cod";

  const productIds = rawItems.map((i) => String(i.productId ?? "")).filter(Boolean);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, storeId: store.id, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  // M5: variantes actives des produits commandés (prix = base + delta, stock sur la variante)
  const variantIds = rawItems.map((i) => String(i.variantId ?? "")).filter(Boolean);
  const variants = new Map<string, { id: string; product_id: string; label: string; price_delta_minor: number; stock: number }>();
  if (variantIds.length) {
    const vrows = await prisma.$queryRawUnsafe<{ id: string; product_id: string; label: string; price_delta_minor: number; stock: number }[]>(
      `select id, product_id, label, price_delta_minor, stock from product_variants
       where id = any($1::uuid[]) and is_active = true`, variantIds as unknown as string[]
    );
    for (const v of vrows) variants.set(v.id, v);
  }
  const items = [];
  for (const i of rawItems) {
    const p = byId.get(String(i.productId ?? ""));
    const qty = Number(i.qty ?? 1);
    if (!p || !Number.isInteger(qty) || qty <= 0) {
      return Response.json({ error: "ITEM_INVALID" }, { status: 400 });
    }
    // M5: variante?
    const vid = String(i.variantId ?? "");
    const v = vid ? variants.get(vid) : undefined;
    if (vid && (!v || v.product_id !== p.id)) {
      return Response.json({ error: "VARIANT_INVALID" }, { status: 400 });
    }
    items.push({
      productId: p.id,
      variantId: v?.id ?? null,
      variantLabel: v?.label ?? null,
      name: v ? `${p.name} — ${v.label}` : p.name,
      priceMinor: p.priceMinor + (v ? Number(v.price_delta_minor) : 0),
      qty,
    });
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
      paymentMethod, // M5
    });
    if (!replayed) await hitRateLimit(rules);
    // M5: paiement carte -> transaction PSP 'pending' + URL du hosted-checkout simulé
    let payment: { pspRef: string; payUrl: string; amountMinor: number } | null = null;
    if (paymentMethod === "card" && !replayed) {
      const { createPspTransaction } = await import("@/lib/psp");
      const tx = await createPspTransaction({ orderId: order.id, amountMinor: order.totalMinor });
      payment = { pspRef: tx.pspRef, payUrl: `/pay/${tx.pspRef}`, amountMinor: tx.amountMinor };
    } else if (paymentMethod === "card") {
      const { getPspByRef } = await import("@/lib/psp");
      const rows = await prisma.$queryRawUnsafe<{ psp_ref: string; amount_minor: number }[]>(
        "select psp_ref, amount_minor from psp_transactions where order_id = $1 order by created_at desc limit 1", order.id
      );
      if (rows[0]) payment = { pspRef: rows[0].psp_ref, payUrl: `/pay/${rows[0].psp_ref}`, amountMinor: Number(rows[0].amount_minor) };
    }
    return Response.json({
      order: { id: order.id, number: order.number, totalMinor: order.totalMinor, status: order.status, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus },
      payment,
    }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ORDER_FAILED";
    if (msg.startsWith("OUT_OF_STOCK")) {
      return Response.json({ error: "OUT_OF_STOCK", product: msg.split(":")[1] }, { status: 409 });
    }
    return Response.json({ error: msg }, { status: 400 });
  }
}
