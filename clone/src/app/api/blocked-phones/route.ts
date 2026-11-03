import { prisma } from "@/lib/db";
import { withStore, bad } from "@/lib/api";
import { normalizeTnPhone } from "@/lib/phone";

// GET: liste des numéros bloqués
export async function GET(req: Request) {
  return withStore(req, async () => {
    const rows = await prisma.blockedPhoneNumber.findMany({ orderBy: { createdAt: "desc" } });
    return Response.json({ blocked: rows });
  });
}

// POST: bloque un numéro
export async function POST(req: Request) {
  return withStore(req, async ({ user }) => {
    const b = await req.json().catch(() => ({}));
    const phone = normalizeTnPhone(String(b.phone ?? ""));
    if (!phone) return bad("PHONE_INVALID");
    await prisma.blockedPhoneNumber.upsert({
      where: { phone },
      update: { reason: String(b.reason ?? "") || null, blockedBy: user.id },
      create: { phone, reason: String(b.reason ?? "") || null, blockedBy: user.id },
    });
    return Response.json({ ok: true, phone });
  });
}

// DELETE: débloque ?phone=+216...
export async function DELETE(req: Request) {
  return withStore(req, async () => {
    const phone = new URL(req.url).searchParams.get("phone");
    if (!phone) return bad("PHONE_REQUIRED");
    await prisma.blockedPhoneNumber.delete({ where: { phone } }).catch(() => {});
    return Response.json({ ok: true });
  });
}
