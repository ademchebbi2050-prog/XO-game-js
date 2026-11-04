import { prisma } from "@/lib/db";
import { OrderStatus, Prisma } from "@/generated/prisma/client";

// Transitions valides (architecture §3). Jamais de changement de statut en direct.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["to_confirm", "unreachable", "cancelled"],
  to_confirm: ["confirmed", "unreachable", "cancelled"],
  unreachable: ["to_confirm", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: [],
  returned: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Numéro lisible: CMD-000123 (séquence Postgres globale). */
export async function nextOrderNumber(): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<{ nextval: string }[]>(
    "SELECT nextval('order_number_seq')::text AS nextval"
  );
  return "CMD-" + rows[0].nextval.padStart(6, "0");
}

/**
 * Change de statut dans UNE transaction: history + effets de bord.
 * - cancelled | returned => remise en stock (une fois, garde `restocked`)
 * - delivered => payment_status = 'paid' (COD encaissé)
 */
export async function applyStatusChange(opts: {
  orderId: string;
  storeId: string;
  to: OrderStatus;
  note?: string;
  userId?: string;
}) {
  const { orderId, storeId, to, note, userId } = opts;
  return prisma.$transaction(async (tx) => {
    // RLS: GUC posé dans LA transaction (is_local=true, remis à zéro au commit).
    await tx.$executeRawUnsafe("select set_config('app.store_id', $1, true)", storeId);
    const order = await tx.order.findFirst({ where: { id: orderId, storeId }, include: { items: true } });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (!canTransition(order.status, to)) throw new Error("INVALID_TRANSITION");

    if ((to === "cancelled" || to === "returned") && !order.restocked) {
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.qty } },
          });
        }
      }
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: to,
        restocked: to === "cancelled" || to === "returned" ? true : order.restocked,
        paymentStatus: to === "delivered" ? "paid" : order.paymentStatus,
      },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, status: to, note: note ?? null, changedById: userId ?? null },
    });
    return updated;
  });
}

/** Pose `unreachable` si >= 3 appels sans réponse. */
export async function maybeMarkUnreachable(orderId: string, storeId: string, userId?: string) {
  const noAnswers = await prisma.orderCallAttempt.count({
    where: { orderId, outcome: "no_answer" },
  });
  if (noAnswers >= 3) {
    const order = await prisma.order.findFirst({ where: { id: orderId, storeId } });
    if (order && (order.status === "new" || order.status === "to_confirm")) {
      await applyStatusChange({ orderId, storeId, to: "unreachable", note: "3 appels sans réponse", userId });
    }
  }
}

/** Crée une commande (web ou manuelle) dans une transaction: stock conditionnel + totaux. */
export async function createOrderWithItems(opts: {
  storeId: string;
  source: "web" | "manual";
  customerName: string;
  customerPhone: string;
  governorate: string;
  address: string;
  items: { productId: string | null; name: string; priceMinor: number; qty: number }[];
  deliveryFeeMinor: number;
  idempotencyKey?: string | null;
}) {
  const { storeId, items, deliveryFeeMinor, idempotencyKey } = opts;
  if (!items.length) throw new Error("EMPTY_ORDER");

  return prisma.$transaction(async (tx) => {
    // RLS: GUC posé dans LA transaction (is_local=true, remis à zéro au commit).
    await tx.$executeRawUnsafe("select set_config('app.store_id', $1, true)", storeId);
    if (idempotencyKey) {
      const existing = await tx.order.findUnique({ where: { idempotencyKey } });
      if (existing) return { order: existing, replayed: true };
    }
    // stock conditionnel (anti-oversell)
    for (const it of items) {
      if (!it.productId) continue;
      const res = await tx.product.updateMany({
        where: { id: it.productId, storeId, stock: { gte: it.qty } },
        data: { stock: { decrement: it.qty } },
      });
      if (res.count === 0) throw new Error("OUT_OF_STOCK:" + it.name);
    }
    const subtotal = items.reduce((s, it) => s + it.priceMinor * it.qty, 0);
    const total = subtotal + deliveryFeeMinor;
    const number = await (async () => {
      const rows = await tx.$queryRawUnsafe<{ nextval: string }[]>(
        "SELECT nextval('order_number_seq')::text AS nextval"
      );
      return "CMD-" + rows[0].nextval.padStart(6, "0");
    })();
    const order = await tx.order.create({
      data: {
        storeId,
        number,
        customerName: opts.customerName,
        customerPhone: opts.customerPhone,
        governorate: opts.governorate,
        address: opts.address,
        subtotalMinor: subtotal,
        deliveryFeeMinor,
        discountMinor: 0,
        totalMinor: total,
        paymentMethod: "cod",
        paymentStatus: "pending",
        status: "new",
        source: opts.source,
        idempotencyKey: idempotencyKey ?? null,
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            nameSnapshot: it.name,
            priceMinor: it.priceMinor,
            qty: it.qty,
          })),
        },
      },
      include: { items: true },
    });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, status: "new", note: opts.source === "web" ? "Commande web" : "Commande manuelle" },
    });
    return { order, replayed: false };
  });
}

export type CreateOrderInput = Prisma.OrderCreateInput;
