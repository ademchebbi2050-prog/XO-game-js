// Dev local: vrai Postgres (WASM via PGlite) exposé en protocole wire sur 127.0.0.1:5433.
// Données persistées dans <dossier perso>/.pglite-data (hors repo, ex. C:\Users\<toi>\.pglite-data).
// Aucun accès réseau externe. Prod: Neon eu-central-1, même schéma — aucun changement de code.
// Note: accès par namespace (ns.X), la destructuration de l'import dynamique
// est capricieuse avec ce package sous Node 22.
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const socket = await import("@electric-sql/pglite-socket");
const pglite = await import("@electric-sql/pglite");

const DATA_DIR = join(homedir(), ".pglite-data");
mkdirSync(DATA_DIR, { recursive: true });

const db = await pglite.PGlite.create({ dataDir: DATA_DIR });
const server = new socket.PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
await server.start();
console.log("PGlite socket server on 127.0.0.1:5433 (dataDir=%s, db=postgres)", DATA_DIR);

process.on("SIGTERM", async () => { await server.stop(); process.exit(0); });
process.on("SIGINT", async () => { await server.stop(); process.exit(0); });
