import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";
import { createOrderWithItems } from "@/lib/orders";
import { normalizeTnPhone } from "@/lib/phone";
import { DEFAULT_DELIVERY_FEE_MINOR } from "@/lib/governorates";
import type { OrderStatus } from "@/generated/prisma/client";

// GET: liste des commandes (filtres: status, q=recherche client/tél/n°, page, limit)
export async function GET(req: Request) {
  return withStore(req, async ({ store }) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as OrderStatus | null;
    const q = url.searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
    const where = {
      storeId: store.id,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { customerName: { contains: q, mode: "insensitive" as const } },
              { customerPhone: { contains: q } },
              { number: { contains: q.toUpperCase(), mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { items: true, carrier: true, _count: { select: { callAttempts: true } } },
      }),
    ]);
    return Response.json({ orders, total, page, limit });
  });
}

// POST: commande manuelle (créée par le commerçant)
export async function POST(req: Request) {
  return withStore(req, async ({ store, user }) => {
    const b = await req.json().catch(() => ({}));
    const customerPhone = normalizeTnPhone(String(b.customerPhone ?? ""));
    if (!customerPhone) return bad("PHONE_INVALID");
    if (!String(b.customerName ?? "").trim()) return bad("NAME_REQUIRED");
    if (!String(b.governorate ?? "").trim()) return bad("GOVERNORATE_REQUIRED");
    if (!String(b.address ?? "").trim()) return bad("ADDRESS_REQUIRED");
    const items = (Array.isArray(b.items) ? b.items : []) as { productId?: unknown; qty?: unknown }[];
    if (!items.length) return bad("EMPTY_ORDER");

    const productIds = items.map((i) => String(i.productId ?? "")).filter(Boolean);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId: store.id },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const normItems = items.map((i) => {
      const p = byId.get(String(i.productId ?? ""));
      const qty = Number(i.qty ?? 1);
      if (!p || !Number.isInteger(qty) || qty <= 0) throw new Error("ITEM_INVALID");
      return { productId: p.id, name: p.name, priceMinor: p.priceMinor, qty };
    });

    const rate = await prisma.deliveryRate.findUnique({
      where: { storeId_governorate: { storeId: store.id, governorate: String(b.governorate) } },
    });
    const fee = rate?.feeMinor ?? (store.settings as { defaultDeliveryFeeMinor?: number })?.defaultDeliveryFeeMinor ?? DEFAULT_DELIVERY_FEE_MINOR;

    try {
      const { order } = await createOrderWithItems({
        storeId: store.id,
        source: "manual",
        customerName: String(b.customerName).trim(),
        customerPhone,
        governorate: String(b.governorate),
        address: String(b.address).trim(),
        items: normItems,
        deliveryFeeMinor: fee,
      });
      await prisma.orderStatusHistory.create({
        data: { orderId: order.id, status: "new", note: `Créée par ${user.name}`, changedById: user.id },
      }).catch(() => {});
      return Response.json({ order }, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ORDER_FAILED";
      if (msg.startsWith("OUT_OF_STOCK")) return bad(msg, 409);
      return bad(msg, 400);
    }
  });
}
