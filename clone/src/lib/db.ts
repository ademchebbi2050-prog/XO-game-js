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
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  // Le compilateur WASM est branché dans le client généré par
  // scripts/patch-prisma-wasm.mjs (config.compilerWasm).
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
