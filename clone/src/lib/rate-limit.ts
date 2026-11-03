import { prisma } from "@/lib/db";

// Fenêtre fixe en Postgres (MVP). Clés: "ip:<ip>" / "phone:<+216...>".
// Prod: remplacer par Upstash Redis derrière la même signature.
export interface RateLimitRule {
  key: string;
  limit: number;
  windowMs: number;
}

export const PUBLIC_ORDER_RULES: RateLimitRule[] = [
  { key: "", limit: 5, windowMs: 10 * 60 * 1000 }, // par IP: 5 / 10 min (préfixe ip:)
  { key: "", limit: 3, windowMs: 60 * 60 * 1000 }, // par téléphone: 3 / h (préfixe phone:)
];

/** Renvoie true si la limite est dépassée. */
export async function isRateLimited(rules: { prefix: string; limit: number; windowMs: number }[], now = new Date()): Promise<boolean> {
  for (const rule of rules) {
    const windowStart = new Date(Math.floor(now.getTime() / rule.windowMs) * rule.windowMs);
    const key = rule.prefix;
    const row = await prisma.orderRateLimit.findUnique({
      where: { key_windowStart: { key, windowStart } },
    });
    if (row && row.count >= rule.limit) return true;
  }
  return false;
}

/** Incrémente les compteurs. Appelé APRÈS isRateLimited. */
export async function hitRateLimit(rules: { prefix: string; limit: number; windowMs: number }[], now = new Date()): Promise<void> {
  for (const rule of rules) {
    const windowStart = new Date(Math.floor(now.getTime() / rule.windowMs) * rule.windowMs);
    await prisma.orderRateLimit.upsert({
      where: { key_windowStart: { key: rule.prefix, windowStart } },
      update: { count: { increment: 1 } },
      create: { key: rule.prefix, windowStart, count: 1 },
    });
  }
}

export async function isPhoneBlocked(phone: string): Promise<boolean> {
  const row = await prisma.blockedPhoneNumber.findUnique({ where: { phone } });
  return !!row;
}
