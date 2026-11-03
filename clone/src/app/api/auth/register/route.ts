import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { normalizeTnPhone, isValidTnPhoneE164 } from "@/lib/phone";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").toLowerCase().trim();
  const password = String(b.password ?? "");
  const name = String(b.name ?? "").trim();
  const phoneRaw = String(b.phone ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: "EMAIL_INVALID" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "PASSWORD_TOO_SHORT" }, { status: 400 });
  if (!name) return Response.json({ error: "NAME_REQUIRED" }, { status: 400 });
  const phone = phoneRaw ? normalizeTnPhone(phoneRaw) : null;
  if (phoneRaw && !phone) return Response.json({ error: "PHONE_INVALID" }, { status: 400 });
  if (phone && !isValidTnPhoneE164(phone)) return Response.json({ error: "PHONE_INVALID" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return Response.json({ error: "EMAIL_TAKEN" }, { status: 409 });

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), name, phone },
  });
  return Response.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
}
