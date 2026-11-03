// Helpers host SANS import Prisma: utilisables par le middleware (edge),
// qui ne doit jamais embarquer la DB.

// Slugs de sous-domaine réservés: jamais utilisables comme boutique.
export const RESERVED_SLUGS = new Set([
  "app", "www", "api", "static", "blog", "mail", "cdn", "shop", "admin", "support",
]);

/** Premier label de l'hôte (sans port). */
export function hostLabel(host: string | null): string {
  if (!host) return "";
  return host.split(":")[0].split(".")[0].toLowerCase();
}
