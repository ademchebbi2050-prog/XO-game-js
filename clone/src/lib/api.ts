import { requireStoreFromRequest } from "@/lib/tenant";

// Wrapper pour les routes "owner": session requise + boutique active résolue
// (cookie store_id vérifié appartenir à l'utilisateur). Toute la suite filtre
// par store.id — jamais de requête globale.
export async function withStore(
  req: Request,
  fn: (ctx: { user: { id: string; email: string; name: string }; store: import("@/generated/prisma/client").Store }) => Promise<Response>
): Promise<Response> {
  const res = await requireStoreFromRequest(req);
  if (!res) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!res.store) return Response.json({ error: "NO_STORE" }, { status: 400 });
  return fn(res as { user: { id: string; email: string; name: string }; store: import("@/generated/prisma/client").Store });
}

export function bad(msg: string, status = 400) {
  return Response.json({ error: msg }, { status });
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
