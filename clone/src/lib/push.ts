// lib/push.ts — M5: notifications push SIMULÉES (pas de service worker en local).
// En prod: VAPID + web-push vers les vrais endpoints navigateur. Ici: on enregistre
// l'abonnement (endpoint sim://device/<uuid>) et chaque événement de commande écrit
// une ligne dans push_events (outbox lisible au dashboard /app/notifications).
import { prisma } from "@/lib/db";

export type PushSubscription = {
  id: string;
  storeId: string;
  userId: string | null;
  endpoint: string;
  createdAt: Date;
};

export type PushEvent = {
  id: string;
  storeId: string;
  subscriptionId: string | null;
  title: string;
  body: string;
  url: string | null;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
};

export async function subscribe(opts: { storeId: string; userId?: string | null; endpoint: string; keys?: unknown }): Promise<PushSubscription> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `insert into push_subscriptions (store_id, user_id, endpoint, keys)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update set store_id = excluded.store_id, user_id = excluded.user_id, keys = excluded.keys
     returning id, store_id, user_id, endpoint, created_at`,
    opts.storeId, opts.userId ?? null, opts.endpoint, JSON.stringify(opts.keys ?? {})
  );
  const r = rows[0];
  return { id: String(r.id), storeId: String(r.store_id), userId: r.user_id ? String(r.user_id) : null, endpoint: String(r.endpoint), createdAt: r.created_at as Date };
}

export async function listSubscriptions(storeId: string): Promise<PushSubscription[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `select id, store_id, user_id, endpoint, created_at from push_subscriptions where store_id = $1 order by created_at desc`, storeId
  );
  return rows.map((r) => ({ id: String(r.id), storeId: String(r.store_id), userId: r.user_id ? String(r.user_id) : null, endpoint: String(r.endpoint), createdAt: r.created_at as Date }));
}

export async function listEvents(storeId: string, limit = 50): Promise<PushEvent[]> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `select id, store_id, subscription_id, title, body, url, status, created_at, sent_at
     from push_events where store_id = $1 order by created_at desc limit $2`, storeId, limit
  );
  return rows.map((r) => ({
    id: String(r.id), storeId: String(r.store_id), subscriptionId: r.subscription_id ? String(r.subscription_id) : null,
    title: String(r.title), body: String(r.body), url: r.url ? String(r.url) : null,
    status: String(r.status), createdAt: r.created_at as Date, sentAt: (r.sent_at as Date | null) ?? null,
  }));
}

/**
 * Émet un événement push vers tous les abonnés de la boutique (simulation:
 * une ligne push_events par abonnement, status 'sent'). Appelé dans la transaction
 * de changement de statut (orders.ts) — store_id GUC déjà posé.
 */
export async function emitPushEvent(opts: {
  storeId: string;
  title: string;
  body: string;
  url?: string;
  tx?: unknown; // transaction Prisma courante (recommandé)
}): Promise<number> {
  const exec = (opts.tx as { $queryRawUnsafe?: (q: string, ...p: unknown[]) => Promise<unknown> } | undefined)?.$queryRawUnsafe
    ? (opts.tx as { $queryRawUnsafe: (q: string, ...p: unknown[]) => Promise<unknown> }).$queryRawUnsafe.bind(opts.tx)
    : prisma.$queryRawUnsafe.bind(prisma);
  const subs = await exec(
    `select id from push_subscriptions where store_id = $1`, opts.storeId
  ) as { id: string }[];
  const targets = subs.length ? subs : [{ id: null as unknown as string }];
  for (const s of targets) {
    await exec(
      `insert into push_events (store_id, subscription_id, title, body, url, status, sent_at)
       values ($1, $2, $3, $4, $5, 'sent', now())`,
      opts.storeId, s.id, opts.title, opts.body, opts.url ?? null
    );
  }
  return targets.length;
}
