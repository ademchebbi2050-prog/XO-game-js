// run-all.mjs — TOUT dans un seul terminal, un seul processus:
//   libère les ports 5433/3000 si besoin + base PGlite embarquée + schéma + seed
//   + RLS + build + serveur Next + diagnostic check.
//   Usage:  node scripts/run-all.mjs      (ou double-clic sur start.cmd)
//   Arrêt:  Ctrl+C.
import { spawn, execSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import net from "node:net";
import dns from "node:dns";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const log = (m) => console.log(m);

// spawn ASYNC (jamais execSync après le démarrage de PGlite: execSync bloque la
// boucle d'événements et le serveur socket embarqué ne répondrait plus).
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: true, cwd: root });
    p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error(cmd + " a quitté avec " + c))));
  });
}

// sonde par BIND (ne touche jamais à une connexion existante — PGlite socket est
// mono-connexion, un probe connect/end bloquerait le serveur).
function portFree(port) {
  return new Promise((res) => {
    const t = net.createServer();
    t.once("error", () => res(false));
    t.once("listening", () => t.close(() => res(true)));
    t.listen(port, "127.0.0.1");
  });
}

// Windows: tue automatiquement les processus du clone qui squattent le port
// (next-server / pglite / run-all), sinon donne la commande manuelle.
function killPortWin(port) {
  let out = "";
  try {
    out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", shell: true });
  } catch { return true; } // rien trouvé = port libre
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (/LISTEN/i.test(line) && new RegExp(`:${port}\\s`).test(line)) {
      const parts = line.trim().split(/\s+/);
      if (/^\d+$/.test(parts[parts.length - 1])) pids.add(parts[parts.length - 1]);
    }
  }
  let allClear = true;
  for (const pid of pids) {
    let cmd = "";
    try {
      cmd = execSync(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId=${pid}\\").CommandLine"`,
        { encoding: "utf8", shell: true }
      ).trim();
    } catch { /* ignore */ }
    if (/next-server|pglite|run-all|XO-game-js/i.test(cmd)) {
      log(`🧹 port ${port}: kill du processus ${pid} (${cmd.slice(0, 70)})`);
      try { execSync(`taskkill /PID ${pid} /F`, { shell: true }); } catch { allClear = false; }
    } else {
      log(`⚠️ port ${port} tenu par PID ${pid}: ${cmd.slice(0, 70) || "(inconnu)"}`);
      log(`   tue-le manuellement:  taskkill /PID ${pid} /F`);
      allClear = false;
    }
  }
  return allClear;
}

async function ensurePort(port, label) {
  if (await portFree(port)) return true;
  log(`⚠️  le port ${port} est occupé (${label}) — tentative de libération...`);
  if (process.platform === "win32") {
    killPortWin(port);
    await new Promise((r) => setTimeout(r, 1500));
    if (await portFree(port)) { log(`✅ port ${port} libéré`); return true; }
  }
  log(`❌ libère le port ${port} manuellement :`);
  log(`   netstat -ano | findstr ${port}`);
  log(`   taskkill /PID <pid> /F`);
  log(`   puis relance:  node scripts/run-all.mjs`);
  return false;
}

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

// --- 3. libère les ports, puis démarre PGlite embarqué ---
if (!(await ensurePort(5433, "base PGlite"))) { process.exit(1); }
const socket = await import("@electric-sql/pglite-socket");
const pglite = await import("@electric-sql/pglite");
const dataDir = path.join(os.homedir(), ".pglite-data");
log(`🗄️  démarrage PGlite (dataDir=${dataDir})...`);
const db = await pglite.PGlite.create({ dataDir });
const server = new socket.PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
await server.start();
log("✅ PGlite socket server on 127.0.0.1:5433");

// --- 4. schéma + seed + RLS (idempotents) — ASYNC ---
try {
  for (const s of ["scripts/init-db.mjs", "scripts/seed.mjs", "scripts/enable-rls.mjs"]) {
    await run("node", [s]);
  }
} catch {
  log("❌ la base ne répond pas correctement — relance:  node scripts/run-all.mjs");
  try { server.stop(); } catch {}
  process.exit(1);
}

// --- 5. build si besoin ---
if (!existsSync(".next/BUILD_ID")) {
  log("🔨 npm run build...");
  await run("npm", ["run", "build"]);
}

// --- 6. libère le port 3000 (ancien serveur éventuel) ---
if (!(await ensurePort(3000, "serveur Next")) ) { try { server.stop(); } catch {} process.exit(1); }

// --- 7. serveur Next au premier plan ---
log("");
log("🚀 Dashboard : http://app.localhost:3000/app/login   (demo@exemple.tn / demo1234)");
log("   Boutiques : http://boutique-a.localhost:3000/  et  http://boutique-b.localhost:3000/");
log("   Arrêt : Ctrl+C");
log("");
const next = spawn("npx", ["next", "start", "-p", "3000", "-H", "0.0.0.0"], { stdio: "inherit", shell: true });

// --- 8. attend que le port 3000 réponde, puis diagnostic complet ---
const waitPort = (port, host, ms) => new Promise((res) => {
  const t0 = Date.now();
  const tryOnce = () => {
    const s = net.connect(port, host);
    s.on("connect", () => { s.end(); res(true); });
    s.on("error", () => { s.destroy(); Date.now() - t0 > ms ? res(false) : setTimeout(tryOnce, 500); });
  };
  tryOnce();
});
if (await waitPort(3000, "127.0.0.1", 60000)) {
  try { await run("node", ["scripts/check.mjs"]); } catch { /* détails déjà affichés par check */ }
}

const shutdown = () => { try { next.kill(); } catch {} try { server.stop(); } catch {} process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
next.on("exit", (code) => { try { server.stop(); } catch {} process.exit(code ?? 0); });
