import { prisma } from "@/lib/db";
import { withStore } from "@/lib/api";

// GET: transporteurs disponibles (simulés en dev)
export async function GET(req: Request) {
  return withStore(req, async () => {
    const carriers = await prisma.carrier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    return Response.json({ carriers });
  });
}
