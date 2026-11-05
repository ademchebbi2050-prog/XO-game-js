import { applyPspEvent, verifyWebhookSignature } from "@/lib/psp";

// POST /api/webhooks/psp — webhook SimPSP (M5).
// Header: x-simpsp-signature = HMAC-SHA256(SIMPSP_WEBHOOK_SECRET, rawBody) en hex.
// Corps: { type: "payment.succeeded"|"payment.failed"|"payment.refunded", ref: "PSP-...", authCode? }
// Réponse 200 { received: true } — idempotent (applyPspEvent dédoublonne via payload).
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-simpsp-signature");
  if (!verifyWebhookSignature(raw, sig)) {
    return Response.json({ error: "BAD_SIGNATURE" }, { status: 401 });
  }
  const b = JSON.parse(raw || "{}");
  const ref = String(b.ref ?? "");
  const type = String(b.type ?? "");
  if (!/^PSP-[A-Z0-9]{10}$/.test(ref)) return Response.json({ error: "BAD_REF" }, { status: 400 });
  if (!["payment.succeeded", "payment.failed", "payment.refunded"].includes(type)) {
    return Response.json({ error: "BAD_TYPE" }, { status: 400 });
  }
  const res = await applyPspEvent({ pspRef: ref, event: type as "payment.succeeded", authCode: typeof b.authCode === "string" ? b.authCode : undefined });
  if (!res) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ received: true, status: res.tx.status });
}
