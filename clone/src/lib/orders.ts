import { prisma } from "@/lib/db";
import { OrderStatus, PaymentMethod, Prisma } from "@/generated/prisma/client";
import { decrementVariantStock, restockVariant } from "@/lib/variants";
import { emitPushEvent } from "@/lib/push";

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

const STATUS_LABEL: Record<string, { fr: string; ar: string }> = {
  new: { fr: "Nouvelle", ar: "جديدة" },
  to_confirm: { fr: "À confirmer", ar: "للتأكيد" },
  unreachable: { fr: "Injoignable", ar: "غير قابل للوصول" },
  confirmed: { fr: "Confirmée", ar: "مؤكدة" },
  shipped: { fr: "Expédiée", ar: "أُرسلت" },
  delivered: { fr: "Livrée", ar: "وُصلت" },
  returned: { fr: "Retournée", ar: "مُرجعة" },
  cancelled: { fr: "Annulée", ar: "ملغاة" },
};

/**
 * Change de statut dans UNE transaction: history + effets de bord.
 * - cancelled | returned => remise en stock (une fois, garde `restocked`) — variante comprise (M5)
 * - delivered => payment_status = 'paid' (COD encaissé)
 * - M5: émet une notification push (simulée) vers les abonnés de la boutique
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
      // M5: remise en stock de la variante si la ligne en avait une
      const variantRows = await tx.$queryRawUnsafe<{ id: string; variant_id: string | null; qty: number }[]>(
        "select id, variant_id, qty from order_items where order_id = $1", order.id
      );
      for (const row of variantRows) {
        if (row.variant_id) {
          await restockVariant(tx, row.variant_id, row.qty);
        }
      }
      for (const item of order.items) {
        if (item.productId && !variantRows.find((v) => v.id === item.id && v.variant_id)) {
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
    // M5: push simulée (dans la même transaction; GUC store_id déjà posé)
    const label = STATUS_LABEL[to]?.fr ?? to;
    await emitPushEvent({
      storeId,
      title: `Commande ${order.number}`,
      body: `Statut : ${label}`,
      url: `/app/orders/${order.id}`,
      tx,
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

export type OrderItemInput = {
  productId: string | null;
  variantId?: string | null;   // M5
  variantLabel?: string | null; // M5 (snapshot)
  name: string;
  priceMinor: number;
  qty: number;
};

/** Crée une commande (web ou manuelle) dans une transaction: stock conditionnel + totaux. */
export async function createOrderWithItems(opts: {
  storeId: string;
  source: "web" | "manual";
  customerName: string;
  customerPhone: string;
  governorate: string;
  address: string;
  items: OrderItemInput[];
  deliveryFeeMinor: number;
  idempotencyKey?: string | null;
  paymentMethod?: PaymentMethod; // M5: 'cod' (défaut) | 'card'
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
    // stock conditionnel (anti-oversell) — M5: variante prioritaire si variantId
    for (const it of items) {
      if (it.variantId && it.productId) {
        const n = await decrementVariantStock(tx, it.variantId, it.productId, storeId, it.qty);
        if (n === 0) throw new Error("OUT_OF_STOCK:" + it.name);
        continue;
      }
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
        paymentMethod: opts.paymentMethod ?? "cod", // M5: 'card' possible (enum patché)
        paymentStatus: "pending",
        status: "new",
        source: opts.source,
        idempotencyKey: idempotencyKey ?? null,
      },
    });
    // M5: lignes de commande en SQL brut (colonnes variant_id/variant_label inconnues du client Prisma)
    for (const it of items) {
      await tx.$executeRawUnsafe(
        `insert into order_items (order_id, product_id, variant_id, variant_label, name_snapshot, price_minor, qty)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        order.id, it.productId, it.variantId ?? null, it.variantLabel ?? null, it.name, it.priceMinor, it.qty
      );
    }
    const withItems = await tx.order.findUnique({ where: { id: order.id }, include: { items: true } });
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, status: "new", note: opts.source === "web" ? "Commande web" : "Commande manuelle" },
    });
    return { order: withItems ?? order, replayed: false };
  });
}

export type CreateOrderInput = Prisma.OrderCreateInput;
