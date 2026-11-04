// Diagnostic complet en UNE commande :  node scripts/check.mjs
// Vérifie: version Node, base PGlite, compte démo, hash du mot de passe, login HTTP.
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const ADMIN_URL = process.env.ADMIN_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
const HOST = { Host: "app.localhost:3000" };
let problems = 0;
const fail = (msg) => { console.log("❌ " + msg); problems++; };
const ok = (msg) => console.log("✅ " + msg);

// 1. Node
try {
  const v = execSync("node -v").toString().trim();
  const [maj, min] = v.replace(/^v/, "").split(".").map(Number);
  if (maj > 22 || (maj === 22 && min >= 18)) ok(`Node ${v} (>= 22.18 requis)`);
  else fail(`Node ${v} trop vieux — installe Node 22 LTS sur nodejs.org, rouvre PowerShell, relance. Le seed (.ts) plante sinon.`);
} catch { fail("node introuvable dans le PATH"); }

// 2. Base PGlite + compte démo
let pg;
try { pg = (await import("pg")).default; } catch { fail("pg non installé — lance npm install"); }
if (pg) {
  let client;
  try {
    client = new pg.Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 4000 });
    await client.connect();
    ok("PGlite répond sur 127.0.0.1:5433");
    const users = await client.query("select email, password_hash from users");
    if (users.rows.length === 0) {
      fail("table users VIDE — le seed n'a pas tourné. Remède: npm run db:up (fenêtre ouverte) puis npm run db:setup");
    } else {
      const bcrypt = (await import("bcryptjs")).default;
      for (const u of users.rows) {
        const match = await bcrypt.compare("demo1234", u.password_hash);
        console.log(`   compte ${u.email} — mdp demo1234: ${match ? "OK" : "REFUSÉ"}`);
        if (u.email === "demo@exemple.tn" && !match) fail("hash du mot de passe ne correspond pas — remède: npm run db:setup (le seed remet le mdp à jour)");
      }
      if (!users.rows.some((u) => u.email === "demo@exemple.tn")) fail("pas de compte demo@exemple.tn — remède: npm run db:setup");
    }
    const stores = await client.query("select slug from stores order by slug");
    console.log("   boutiques:", stores.rows.map((r) => r.slug).join(", ") || "(aucune)");
    await client.end();
  } catch (e) {
    fail(`PGlite injoignable (${e.message.split("\n")[0]}) — remède: ouvre une fenêtre et lance: npm run db:up ; attends "PGlite socket server on 127.0.0.1:5433"`);
  }
}

// 3. Login HTTP contre le serveur applicatif
try {
  const csrfRes = await fetch(BASE + "/api/auth/csrf", { headers: HOST });
  if (!csrfRes.ok) throw new Error("HTTP " + csrfRes.status);
  const csrf = (await csrfRes.json()).csrfToken;
  const csrfCookie = (csrfRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const res = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST", redirect: "manual",
    headers: { ...HOST, "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken: csrf, email: "demo@exemple.tn", password: "demo1234" }),
  });
  const sessionCookie = (res.headers.getSetCookie?.() ?? []).find((c) => c.includes("session-token"));
  if (res.status === 302 && sessionCookie) ok("login HTTP demo@exemple.tn/demo1234 → session posée (le serveur fonctionne)");
  else fail(`login HTTP -> ${res.status} (pas de session). Regarde le terminal du serveur: la ligne [auth] authorize: ... donne la cause (user introuvable / mdp refusé / ERREUR DB)`);
} catch (e) {
  fail(`serveur app injoignable sur ${BASE} (${e.message.split("\n")[0]}) — remède: dans clone\ lance npm run build puis npx next start -p 3000 -H 0.0.0.0`);
}

console.log(problems === 0
  ? "\n✅ TOUT EST OK — ouvre http://app.localhost:3000/app/login et connecte-toi (demo@exemple.tn / demo1234)"
  : `\n❌ ${problems} problème(s) — suis les remèdes ci-dessus, puis relance: node scripts/check.mjs`);
process.exit(problems === 0 ? 0 : 1);
