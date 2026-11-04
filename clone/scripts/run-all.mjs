// run-all.mjs — TOUT dans un seul terminal, un seul processus:
//   base PGlite (en mémoire-processus) + schéma + seed + RLS + serveur Next.
//   Usage:  node scripts/run-all.mjs      (ou double-clic sur start.cmd)
//   Arrêt:  Ctrl+C.
import { spawn, execSync } from "node:child_process";

// spawn ASYNC (jamais execSync après le démarrage de PGlite: execSync bloque la
// boucle d'événements et le serveur socket embarqué ne répondrait plus).
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: true, cwd: root });
    p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(cmd + " a quitté avec " + c))));
  });
}
import { existsSync, copyFileSync } from "node:fs";
import net from "node:net";
import dns from "node:dns";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const log = (m) => console.log(m);

// --- 0. .env ---
if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  log("✅ .env créé depuis .env.example");
}

// --- 1. dépendances ---
if (!existsSync("node_modules")) {
  log("📦 npm install (quelques minutes)...");
  execSync("npm install", { stdio: "inherit", shell: true });
}

// --- 2. avertissement hosts (non bloquant) ---
const hostsOk = await new Promise((res) =>
  dns.lookup("app.localhost", (err, addr) => res(!err && addr === "127.0.0.1"))
);
if (!hostsOk) {
  log("⚠️  app.localhost ne pointe pas sur 127.0.0.1 : ajoute dans C:\\Windows\\System32\\drivers\\etc\\hosts (admin) :");
  log("    127.0.0.1 app.localhost boutique-a.localhost boutique-b.localhost");
  log("    (sans ça, seul http://localhost:3000 marche pour le dashboard)");
}

// --- 3. base PGlite : réutilise une instance existante, sinon démarre en local ---
// Sonde par BIND (ne touche jamais à une connexion existante — PGlite socket est
// mono-connexion, un probe connect/end bloquerait le serveur).
const portBusy = await new Promise((res) => {
  const t = net.createServer();
  t.once("error", () => res(true));
  t.once("listening", () => t.close(() => res(false)));
  t.listen(5433, "127.0.0.1");
});
let server = null;
if (portBusy) {
  // Port 5433 déjà ouvert: on réutilise la base (c'est notre port dédié).
  // Si c'était un zombie, c'est l'étape seed juste après qui échouera avec le remède.
  log("✅ port 5433 déjà ouvert — base existante réutilisée");
} else {
  const socket = await import("@electric-sql/pglite-socket");
  const pglite = await import("@electric-sql/pglite");
  const dataDir = path.join(os.homedir(), ".pglite-data");
  log(`🗄️  démarrage PGlite (dataDir=${dataDir})...`);
  const db = await pglite.PGlite.create({ dataDir });
  server = new socket.PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
  await server.start();
  log("✅ PGlite socket server on 127.0.0.1:5433");
}

// --- 4. schéma + seed + RLS (idempotents) — ASYNC (execSync bloquerait la boucle d'events) ---
try {
  for (const s of ["scripts/init-db.mjs", "scripts/seed.mjs", "scripts/enable-rls.mjs"]) {
    await run("node", [s]);
  }
} catch {
  log("❌ la base sur 127.0.0.1:5433 ne répond pas (processus zombie ?).");
  log("   Windows:  netstat -ano | findstr 5433   puis   taskkill /PID <pid> /F");
  log("   puis relance:  node scripts/run-all.mjs");
  try { server?.stop(); } catch {}
  process.exit(1);
}

// --- 5. build si besoin ---
if (!existsSync(".next/BUILD_ID")) {
  log("🔨 npm run build...");
  await run("npm", ["run", "build"]);
}

// --- 6. serveur Next au premier plan ---
log("");
log("🚀 Dashboard : http://app.localhost:3000/app/login   (demo@exemple.tn / demo1234)");
log("   Boutiques : http://boutique-a.localhost:3000/  et  http://boutique-b.localhost:3000/");
log("   Arrêt : Ctrl+C");
log("");
const next = spawn("npx", ["next", "start", "-p", "3000", "-H", "0.0.0.0"], { stdio: "inherit", shell: true });
const shutdown = () => { try { next.kill(); } catch {} try { server?.stop(); } catch {} process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
next.on("exit", (code) => { try { server?.stop(); } catch {} process.exit(code ?? 0); });
