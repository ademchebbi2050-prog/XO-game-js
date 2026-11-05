import { withStore } from "@/lib/api";
import { listEvents } from "@/lib/push";

// GET /api/push/events — outbox des notifications push (M5, simulées)
export async function GET(req: Request) {
  return withStore(req, async ({ store }) => {
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const events = await listEvents(store.id, limit);
    return Response.json({ events });
  });
}
