import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/tenant";

// GET /api/public/label/[tracking]?slug=<boutique>
// Étiquette d'expédition imprimable (transporteur simulé en dev).
// Scoping par slug comme le suivi public: jamais de fuite cross-boutique.
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function GET(req: Request, ctx: { params: Promise<{ tracking: string }> }) {
  const { tracking } = await ctx.params;
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  if (!/^SIM-[A-Z0-9-]+$/.test(tracking)) return new Response("BAD_TRACKING", { status: 400 });
  const store = await getStoreBySlug(slug);
  if (!store) return new Response("NOT_FOUND", { status: 404 });

  const order = await prisma.order.findFirst({
    where: { storeId: store.id, trackingNumber: tracking },
    include: { carrier: true },
  });
  if (!order) return new Response("NOT_FOUND", { status: 404 });

  const cod = (order.totalMinor / 1000).toFixed(3) + " TND";
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Étiquette ${esc(order.number)} — ${esc(store.name)}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#111}
  .label{max-width:380px;border:3px solid #111;padding:16px}
  .store{font-size:18px;font-weight:800;text-transform:uppercase}
  .tracking{font-family:ui-monospace,monospace;font-size:22px;font-weight:700;letter-spacing:1px;margin:8px 0}
  .barcode{font-family:ui-monospace,monospace;font-size:28px;letter-spacing:2px}
  .cod{font-size:20px;font-weight:800;background:#111;color:#fff;padding:6px 10px;display:inline-block;margin-top:8px}
  dl{font-size:13px;margin:12px 0 0;display:grid;grid-template-columns:auto 1fr;gap:2px 8px}
  dt{font-weight:700} dd{margin:0}
  .foot{margin-top:12px;font-size:11px;color:#444}
  @media print{body{padding:0}.label{border-width:2px}}
</style></head><body>
<div class="label">
  <div class="store">${esc(store.name)}</div>
  <div>Commande ${esc(order.number)}</div>
  <div class="tracking">${esc(order.trackingNumber ?? "")}</div>
  <div class="barcode">||| || ||| | |||| |</div>
  <div class="cod">COD : ${esc(cod)}</div>
  <dl>
    <dt>Destinataire</dt><dd>${esc(order.customerName)}</dd>
    <dt>Tél.</dt><dd dir="ltr">${esc(order.customerPhone)}</dd>
    <dt>Adresse</dt><dd>${esc(order.address)}</dd>
    <dt>Gouvernorat</dt><dd>${esc(order.governorate)}</dd>
    <dt>Transporteur</dt><dd>${esc(order.carrier?.name ?? "—")}</dd>
  </dl>
  <p class="foot">Paiement à la livraison. Ne pas plier. ${esc(new Date().toISOString().slice(0, 10))}</p>
</div>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
