// lib/variants.ts — M5: variantes de produits (SQL brut, cf. lib/psp.ts).
// Stock par variante; le stock du produit reste le stock "par défaut" quand le
// produit n'a aucune variante active.
import { prisma } from "@/lib/db";

export type Variant = {
  id: string;
  productId: string;
  label: string;
  sku: string | null;
  priceDeltaMinor: number;
  stock: number;
  isActive: boolean;
};

const rowToVariant = (r: Record<string, unknown>): Variant => ({
  id: String(r.id),
  productId: String(r.product_id),
  label: String(r.label),
  sku: r.sku ? String(r.sku) : null,
  priceDeltaMinor: Number(r.price_delta_minor),
  stock: Number(r.stock),
  isActive: Boolean(r.is_active),
});

const SELECT = `select id, product_id, label, sku, price_delta_minor, stock, is_active from product_variants`;

export async function listVariants(productId: string): Promise<Variant[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`${SELECT} where product_id = $1 order by created_at`, productId);
  return rows.map(rowToVariant);
}

export async function listActiveVariantsForProducts(productIds: string[]): Promise<Map<string, Variant[]>> {
  const map = new Map<string, Variant[]>();
  if (!productIds.length) return map;
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `${SELECT} where product_id = any($1::uuid[]) and is_active = true order by product_id, created_at`,
    productIds as unknown as string[]
  );
  for (const r of rows) {
    const v = rowToVariant(r);
    const arr = map.get(v.productId) ?? [];
    arr.push(v);
    map.set(v.productId, arr);
  }
  return map;
}

/** Upsert d'un lot de variantes (édition produit dashboard). */
export async function saveVariants(productId: string, variants: { id?: string; label: string; sku?: string | null; priceDeltaMinor?: number; stock?: number; isActive?: boolean }[]): Promise<Variant[]> {
  return prisma.$transaction(async (tx) => {
    const keep: string[] = [];
    for (const v of variants) {
      const label = String(v.label ?? "").trim();
      if (!label) continue;
      if (v.id) {
        await tx.$executeRawUnsafe(
          `update product_variants set label=$2, sku=$3, price_delta_minor=$4, stock=$5, is_active=$6 where id=$1 and product_id=$7`,
          v.id, label, v.sku ?? null, Math.trunc(v.priceDeltaMinor ?? 0), Math.max(0, Math.trunc(v.stock ?? 0)), v.isActive ?? true, productId
        );
        keep.push(v.id);
      } else {
        const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
          `insert into product_variants (product_id, label, sku, price_delta_minor, stock, is_active)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (product_id, label) do update set sku=excluded.sku, price_delta_minor=excluded.price_delta_minor, stock=excluded.stock, is_active=excluded.is_active
           returning id, product_id, label, sku, price_delta_minor, stock, is_active`,
          productId, label, v.sku ?? null, Math.trunc(v.priceDeltaMinor ?? 0), Math.max(0, Math.trunc(v.stock ?? 0)), v.isActive ?? true
        );
        keep.push(String(rows[0].id));
      }
    }
    // supprime les variantes non conservées
    await tx.$executeRawUnsafe(
      `delete from product_variants where product_id = $1 and not (id = any($2::uuid[]))`,
      productId, keep.length ? (keep as unknown as string[]) : (["00000000-0000-0000-0000-000000000000"] as unknown as string[])
    );
    const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`${SELECT} where product_id = $1 order by created_at`, productId);
    return rows.map(rowToVariant);
  });
}

/** Décrémente le stock d'une variante (commande), renvoie le nb de lignes touchées (0 = stock insuffisant). */
export async function decrementVariantStock(tx: unknown, variantId: string, productId: string, storeId: string, qty: number): Promise<number> {
  const t = tx as { $queryRawUnsafe: (q: string, ...p: unknown[]) => Promise<unknown> };
  // $queryRaw (pas $executeRaw): on a besoin des LIGNES retournées, pas du count
  const res = (await t.$queryRawUnsafe(
    `update product_variants set stock = stock - $3
     where id = $1 and product_id = $2 and stock >= $3
     returning stock`,
    variantId, productId, qty
  )) as { stock: number }[];
  return res.length;
}

/** Remet en stock une variante (annulation/retour). */
export async function restockVariant(tx: unknown, variantId: string, qty: number): Promise<void> {
  const t = tx as { $executeRawUnsafe: (q: string, ...p: unknown[]) => Promise<unknown> };
  await t.$executeRawUnsafe(`update product_variants set stock = stock + $2 where id = $1`, variantId, qty);
}
