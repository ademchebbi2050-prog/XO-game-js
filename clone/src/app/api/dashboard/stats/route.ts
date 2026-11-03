import { prisma } from "@/lib/db";
import { withStore } from "@/lib/api";

// GET: stats du tableau de bord (range=7d|30d|all)
export async function GET(req: Request) {
  return withStore(req, async ({ store }) => {
    const url = new URL(req.url);
    const range = url.searchParams.get("range") ?? "all";
    const since =
      range === "7d" ? new Date(Date.now() - 7 * 864e5)
      : range === "30d" ? new Date(Date.now() - 30 * 864e5)
      : null;
    const where = { storeId: store.id, ...(since ? { createdAt: { gte: since } } : {}) };

    const orders = await prisma.order.findMany({
      where,
      select: { status: true, totalMinor: true, createdAt: true },
    });
    const total = orders.length;
    const count = (s: string) => orders.filter((o) => o.status === s).length;
    const confirmed = count("confirmed") + count("shipped") + count("delivered");
    const shipped = count("shipped") + count("delivered") + count("returned");
    const delivered = count("delivered");
    const revenue = orders.filter((o) => o.status === "delivered").reduce((s, o) => s + o.totalMinor, 0);

    const recent = await prisma.order.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { items: true },
    });

    // CA par jour sur la période (pour le mini-graphique)
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 30;
    const buckets = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      const d = o.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(d) ?? { revenue: 0, orders: 0 };
      b.orders += 1;
      if (o.status === "delivered") b.revenue += o.totalMinor;
      buckets.set(d, b);
    }
    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10);
      return { date: d, ...(buckets.get(d) ?? { revenue: 0, orders: 0 }) };
    });

    return Response.json({
      stats: {
        ordersTotal: total,
        confirmationRate: total ? confirmed / total : 0,
        deliveryRate: shipped ? delivered / shipped : 0,
        returnRate: shipped ? count("returned") / shipped : 0,
        revenueMinor: revenue,
        counts: {
          new: count("new"),
          to_confirm: count("to_confirm"),
          unreachable: count("unreachable"),
          confirmed: count("confirmed"),
          shipped: count("shipped"),
          delivered,
          returned: count("returned"),
          cancelled: count("cancelled"),
        },
      },
      series,
      recent,
    });
  });
}
