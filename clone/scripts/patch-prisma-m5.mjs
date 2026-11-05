// patch-prisma-m5.mjs — post-génération: ajoute les valeurs d'enum M5 au client
// Prisma généré (src/generated/prisma), impossible à regénérer hors-ligne
// (prisma generate télécharge le schema-engine, bloqué dans le bac à sable).
// Le DataMapper du client valide les enums à partir de enums.ts + du schéma
// inline embarqué: on y ajoute 'card' (payment_method) et 'failed' (payment_status),
// valeurs ajoutées côté DB par scripts/migrate-m5.mjs. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const genDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "generated", "prisma");

// 1) enums.ts — objets runtime utilisés par le DataMapper
{
  const p = join(genDir, "enums.ts");
  let s = readFileSync(p, "utf8");
  const before = s;
  s = s.replace("export const PaymentMethod = {\n  cod: 'cod'\n} as const",
                "export const PaymentMethod = {\n  cod: 'cod',\n  card: 'card'\n} as const");
  s = s.replace("export const PaymentStatus = {\n  pending: 'pending',\n  paid: 'paid',",
                "export const PaymentStatus = {\n  pending: 'pending',\n  paid: 'paid',\n  failed: 'failed',");
  if (s !== before) { writeFileSync(p, s); console.log("✅ enums.ts: PaymentMethod+card, PaymentStatus+failed"); }
  else console.log("⏭️ enums.ts déjà à jour");
}

// 2) internal/class.ts — inlineSchema embarquée (2 occurrences)
{
  const p = join(genDir, "internal", "class.ts");
  let s = readFileSync(p, "utf8");
  const before = s;
  s = s.split("enum PaymentMethod {\\n  cod\\n").join("enum PaymentMethod {\\n  cod\\n  card\\n");
  s = s.split("enum PaymentStatus {\\n  pending\\n  paid\\n  refunded\\n").join("enum PaymentStatus {\\n  pending\\n  paid\\n  failed\\n  refunded\\n");
  if (s !== before) { writeFileSync(p, s); console.log("✅ class.ts inlineSchema: enums M5"); }
  else console.log("⏭️ class.ts déjà à jour");
}
