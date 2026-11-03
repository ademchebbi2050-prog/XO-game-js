import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";

export async function GET(req: Request) {
  return withStore(req, async ({ store }) => {
    const categories = await prisma.category.findMany({
      where: { storeId: store.id },
      orderBy: { name: "asc" },
    });
    return Response.json({ categories });
  });
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "cat";
}

export async function POST(req: Request) {
  return withStore(req, async ({ store }) => {
    const b = await req.json().catch(() => ({}));
    const name = String(b.name ?? "").trim();
    if (!name) return bad("NAME_REQUIRED");
    const slug = slugify(String(b.slug ?? name));
    const clash = await prisma.category.findFirst({ where: { storeId: store.id, slug } });
    if (clash) return bad("SLUG_TAKEN", 409);
    const category = await prisma.category.create({ data: { storeId: store.id, name, slug } });
    return Response.json({ category }, { status: 201 });
  });
}
