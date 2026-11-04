import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Client Prisma 6.19 : compilateur de requêtes WASM embarqué (aucun binaire
// Rust à télécharger) + adapter pg. En dev, DATABASE_URL pointe sur le serveur
// socket PGlite (vrai Postgres WASM, scripts/pglite-server.mjs) ; en prod, Neon.
// Le client généré (provider prisma-client, runtime node) laisse
// config.compilerWasm à undefined : on le fournit ici explicitement depuis le
// WASM embarqué dans @prisma/client/runtime.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // PGlite (serveur socket local) est mono-connexion : max 1, sinon il ferme
  // les connexions concurrentes (P1017). En prod (Neon) lever cette limite.
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    // Idle court: libère la connexion unique (PGlite socket = 1 client à la fois)
    // pour laisser passer les scripts/tests DB (tests/isolation) entre deux requêtes.
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 15_000,
  });
  const adapter = new PrismaPg(pool);
  // Le compilateur WASM est branché dans le client généré par
  // scripts/patch-prisma-wasm.mjs (config.compilerWasm).
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

/**
 * Pose les GUC de contexte tenant (RLS, défense en profondeur — M4).
 * Doit être appelé en début de requête métier: avec userId (session) et/ou
 * storeId (boutique résolue). Sans GUC, current_setting(..., true) renvoie NULL
 * => policies RLS fail-closed. En local PGlite le pool est max:1, donc la
 * session est sérialisée et le GUC posé en début de requête couvre la suite.
 */
export async function setAppContext(userId: string | null, storeId: string | null): Promise<void> {
  await prisma.$executeRawUnsafe(
    "select set_config('app.current_user_id', $1, false), set_config('app.store_id', $2, false)",
    userId ?? "",
    storeId ?? ""
  );
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
