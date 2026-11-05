import { withStore } from "@/lib/api";
import { subscribe, listSubscriptions } from "@/lib/push";

// POST /api/push/subscribe — enregistre un abonnement push (M5, simulé en local:
// endpoint "sim://device/<uuid>"; en prod: vrai endpoint Web Push + clés VAPID).
export async function POST(req: Request) {
  return withStore(req, async ({ store, user }) => {
    const b = await req.json().catch(() => ({}));
    const endpoint = String(b.endpoint ?? "").trim();
    if (!endpoint || endpoint.length > 500) return Response.json({ error: "ENDPOINT_INVALID" }, { status: 400 });
    const sub = await subscribe({ storeId: store.id, userId: user.id, endpoint, keys: b.keys ?? {} });
    return Response.json({ subscription: sub });
  });
}

// GET /api/push/subscribe — abonnements actifs de la boutique
export async function GET(req: Request) {
  return withStore(req, async ({ store }) => {
    const subs = await listSubscriptions(store.id);
    return Response.json({ subscriptions: subs });
  });
}
