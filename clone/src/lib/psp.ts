// lib/psp.ts — M5: PSP carte bancaire SIMULÉ ("SimPSP"), même pattern que les
// transporteurs simulés (src/lib/carriers). Aucune vraie banque : la page /pay/<ref>
// joue le hosted-checkout du PSP, et le webhook /api/webhooks/psp rejoue les
// événements avec une signature HMAC (vérifiée, idempotente).
// Tables: psp_transactions (replica/schema.sql, migration M5) — accès SQL brut
// (le client Prisma généré ne connaît pas ces tables, regénération hors-ligne impossible).
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

export type PspTx = {
  id: string;
  orderId: string;
  pspRef: string;
  amountMinor: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  authCode: string | null;
  createdAt: Date;
};

const rowToTx = (r: Record<string, unknown>): PspTx => ({
  id: String(r.id),
  orderId: String(r.order_id),
  pspRef: String(r.psp_ref),
  amountMinor: Number(r.amount_minor),
  currency: String(r.currency),
  status: r.status as PspTx["status"],
  authCode: r.auth_code ? String(r.auth_code) : null,
  createdAt: r.created_at as Date,
});

/** Crée une transaction 'pending' pour une commande carte. */
export async function createPspTransaction(opts: {
  orderId: string;
  amountMinor: number;
  currency?: string;
}): Promise<PspTx> {
  const pspRef = "PSP-" + createHmac("sha256", process.env.SIMPSP_SECRET ?? "simpsp-dev")
    .update(opts.orderId + Date.now() + Math.random())
    .digest("hex").slice(0, 10).toUpperCase();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `insert into psp_transactions (order_id, psp_ref, amount_minor, currency, status)
     values ($1, $2, $3, $4, 'pending')
     returning id, order_id, psp_ref, amount_minor, currency, status, auth_code, created_at`,
    opts.orderId, pspRef, opts.amountMinor, opts.currency ?? "TND"
  );
  return rowToTx(rows[0]);
}

export async function getPspByRef(pspRef: string): Promise<PspTx | null> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `select id, order_id, psp_ref, amount_minor, currency, status, auth_code, created_at
     from psp_transactions where psp_ref = $1`, pspRef
  );
  return rows[0] ? rowToTx(rows[0]) : null;
}

/**
 * Applique un événement PSP (bouton page /pay OU webhook) — IDEMPOTENT:
 * rejoue le même événement => même état, pas d'erreur.
 * Renvoie la transaction à jour + l'order_id pour mise à jour du paiement.
 */
export async function applyPspEvent(opts: {
  pspRef: string;
  event: "payment.succeeded" | "payment.failed" | "payment.refunded";
  authCode?: string;
}): Promise<{ tx: PspTx; orderId: string } | null> {
  const { pspRef, event, authCode } = opts;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `select id, order_id, psp_ref, amount_minor, currency, status, auth_code, created_at, payload
       from psp_transactions where psp_ref = $1 for update`, pspRef
    );
    if (!rows[0]) return null;
    const txRow = rows[0];
    const payload = (txRow.payload as Record<string, unknown>) ?? {};
    if (payload[event]) {
      // déjà appliqué (idempotence webhook)
      const cur = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `select id, order_id, psp_ref, amount_minor, currency, status, auth_code, created_at
         from psp_transactions where psp_ref = $1`, pspRef
      );
      return { tx: rowToTx(cur[0]), orderId: String(txRow.order_id) };
    }
    const newStatus = event === "payment.succeeded" ? "paid" : event === "payment.failed" ? "failed" : "refunded";
    // pending -> paid|failed ; paid -> refunded ; failed est terminal (sauf refund impossible)
    if (txRow.status === "refunded") {
      const cur = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `select id, order_id, psp_ref, amount_minor, currency, status, auth_code, created_at
         from psp_transactions where psp_ref = $1`, pspRef
      );
      return { tx: rowToTx(cur[0]), orderId: String(txRow.order_id) };
    }
    const newPayload = { ...payload, [event]: new Date().toISOString() };
    const upd = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `update psp_transactions
       set status = $2, auth_code = coalesce($3, auth_code), payload = $4, updated_at = now()
       where psp_ref = $1
       returning id, order_id, psp_ref, amount_minor, currency, status, auth_code, created_at`,
      pspRef, newStatus, authCode ?? (event === "payment.succeeded" ? "SIM" + Math.floor(Math.random() * 1e6).toString().padStart(6, "0") : null),
      JSON.stringify(newPayload)
    );
    // met à jour le statut de paiement de la commande (enum payment_status M5: + 'failed')
    const payStatus = newStatus === "paid" ? "paid" : newStatus === "failed" ? "failed" : "refunded";
    await tx.$executeRawUnsafe(
      `update orders set payment_status = $2::payment_status, updated_at = now() where id = $1`,
      String(txRow.order_id), payStatus
    );
    return { tx: rowToTx(upd[0]), orderId: String(txRow.order_id) };
  });
}

/** Vérifie la signature du webhook SimPSP: header x-simpsp-signature = hex HMAC-SHA256(secret, rawBody). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.SIMPSP_WEBHOOK_SECRET ?? "simpsp-webhook-dev";
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
