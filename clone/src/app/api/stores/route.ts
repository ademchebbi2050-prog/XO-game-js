import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { RESERVED_SLUGS } from "@/lib/tenant";
import { isLocale } from "@/lib/i18n";

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// GET: mes boutiques
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const stores = await prisma.store.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, status: true, defaultLocale: true, currency: true, settings: true }, // M5: settings (theme, commissionBps)
  });
  return Response.json({ stores });
}

// POST: crée une boutique (onboarding)
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  const slug = String(b.slug ?? "").trim().toLowerCase();
  const locale = isLocale(String(b.locale)) ? String(b.locale) : "fr";
  if (!name) return Response.json({ error: "NAME_REQUIRED" }, { status: 400 });
  if (!SLUG_RE.test(slug)) return Response.json({ error: "SLUG_INVALID" }, { status: 400 });
  if (RESERVED_SLUGS.has(slug)) return Response.json({ error: "SLUG_RESERVED" }, { status: 409 });
  const taken = await prisma.store.findUnique({ where: { slug } });
  if (taken) return Response.json({ error: "SLUG_TAKEN" }, { status: 409 });

  const store = await prisma.store.create({
    data: { ownerId: user.id, name, slug, defaultLocale: locale, status: "draft", settings: { codEnabled: true, defaultDeliveryFeeMinor: 7000 } },
  });
  return Response.json({ store }, { status: 201 });
}
