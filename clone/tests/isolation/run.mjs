// Suite de tests d'isolation multi-tenant (M0/M1/M2, re-jouable avec RLS en M4).
// À lancer contre un serveur en cours:  BASE=http://127.0.0.1:3000 node tests/isolation/run.mjs
// Compte seed: demo@exemple.tn / demo1234. Boutiques: boutique-a, boutique-b.
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const APP = { Host: "app.localhost:3000" };
const A = { Host: "boutique-a.localhost:3000" };
const B = { Host: "boutique-b.localhost:3000" };

let cookie = "";
let failures = 0;

function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`);
  if (!cond) failures++;
}

async function req(hostHeaders, path, opts = {}) {
  const merged = { ...hostHeaders, ...(opts.headers ?? {}) };
  const cookies = [merged.Cookie, cookie].filter(Boolean).join("; ");
  if (cookies) merged.Cookie = cookies;
  const res = await fetch(BASE + path, { ...opts, headers: merged, redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text };
}

// --- login ---
{
  const csrfRes = await fetch(BASE + "/api/auth/csrf", { headers: APP });
  const csrf = (await csrfRes.json()).csrfToken;
  const csrfCookie = (csrfRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const res = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    headers: { ...APP, "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken: csrf, email: "demo@exemple.tn", password: "demo1234" }),
    redirect: "manual",
  });
  const sc = (res.headers.getSetCookie?.() ?? []).find((c) => c.includes("session-token"))?.split(";")[0] ?? "";
  check("login demo", res.status === 302 && sc.includes("session-token"), `status=${res.status}`);
  cookie = sc;
}

const storesRes = await req(APP, "/api/stores");
const stores = storesRes.json?.stores ?? [];
const [storeA, storeB] = stores;
check("2 boutiques seedées", stores.length >= 2, stores.map((s) => s.slug).join(","));

const withStore = (id) => ({ Cookie: `${cookie}; store_id=${id}` });
const CA = withStore(storeA.id);
const CB = withStore(storeB.id);

// --- créer une commande sur A via l'API publique ---
const prodA = await req(A, "/api/public/stores/boutique-a/products");
const productA = prodA.json.products[0];
const key = "iso-" + randomUUID();
const phone = "+21691" + String(Math.floor(100000 + Math.random() * 899999));
const orderBody = {
  customerName: "Test Isolation",
  customerPhone: phone,
  governorate: "tunis",
  address: "1 rue du test",
  items: [{ productId: productA.id, qty: 1 }],
};
const created = await req(A, "/api/public/stores/boutique-a/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": key, "X-Forwarded-For": `10.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}` },
  body: JSON.stringify(orderBody),
});
check("commande créée sur A", created.status === 201, created.json?.order?.number);
const orderA = created.json.order;

// --- tests négatifs ---
const ordersB = await req(APP, "/api/orders", { headers: CB });
const leaked = (ordersB.json?.orders ?? []).some((o) => o.number === orderA.number);
check("commande de A invisible depuis le dashboard de B", !leaked);

const detailB = await req(APP, `/api/orders/${orderA.id}`, { headers: CB });
check("GET /api/orders/{idA} avec store_id=B -> 404", detailB.status === 404, `status=${detailB.status}`);

const patchB = await req(APP, `/api/orders/${orderA.id}/status`, {
  method: "POST", headers: { ...CB, "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }),
});
check("changement de statut de A avec store_id=B -> 404", patchB.status === 404, `status=${patchB.status}`);

const prodB = await req(APP, `/api/products/${productA.id}`, { headers: CB });
check("GET /api/products/{idA} avec store_id=B -> 404", prodB.status === 404, `status=${prodB.status}`);

const listB = await req(APP, "/api/products", { headers: CB });
check("produit de A absent de la liste de B", !(listB.json?.products ?? []).some((p) => p.id === productA.id));

const pubB = await req(B, "/api/public/stores/boutique-b/products");
check("produits publics de A invisibles sur l'hôte B", !(pubB.json?.products ?? []).some((p) => p.id === productA.id));

const trackB = await req(B, `/api/public/orders/${orderA.number}?phone=${encodeURIComponent(phone)}&slug=boutique-b`);
check("suivi public de la commande A sur boutique-b -> 404", trackB.status === 404, `status=${trackB.status}`);

const noAuth = await fetch(BASE + "/api/orders", { headers: APP });
check("sans session -> 401", noAuth.status === 401, `status=${noAuth.status}`);

const foreignStore = await req(APP, "/api/orders", { headers: withStore(randomUUID()) });
check("store_id d'une boutique non possédée -> 400/401", [400, 401].includes(foreignStore.status), `status=${foreignStore.status}`);

// la commande de A reste bien visible depuis A (pas de faux positif)
const ordersA = await req(APP, "/api/orders", { headers: CA });
check("commande de A visible depuis A", (ordersA.json?.orders ?? []).some((o) => o.number === orderA.number));

// --- preuve RLS au niveau DB (fail-closed) ---
// PGlite socket n'accepte qu'un client à la fois: on retente jusqu'à ce que le
// pool de l'app (max:1, idleTimeout 5s) libère la connexion.
{
  const { default: pg } = await import("pg");
  // PGlite est mono-utilisateur: tout login retombe sur postgres (superuser,
  // qui contourne le RLS). Pour prouver l'application des policies, on fait
  // SET ROLE app (rôle non-superuser créé par enable-rls.mjs) — en prod Neon,
  // le rôle applicatif est réellement non-superuser.
  const url = process.env.ADMIN_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
  let client = null;
  for (let attempt = 0; attempt < 20 && !client; attempt++) {
    try {
      const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3000 });
      await c.connect();
      await c.query("select 1");
      await c.query("set role app");
      client = c;
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  check("connexion DB de test obtenue (pool app libéré, role=app)", !!client);
  if (!client) { console.log(`\n${failures + 1} ÉCHEC(S)`); process.exit(1); }
  const rls = await client.query("select relname from pg_class where relrowsecurity order by 1");
  check("RLS activé sur tables sensibles", rls.rows.length >= 7, rls.rows.map((r) => r.relname).join(","));

  const noGuc = await client.query("select count(*)::int as c from orders");
  check("sans GUC app.store_id -> 0 ligne (fail-closed)", noGuc.rows[0].c === 0, `c=${noGuc.rows[0].c}`);

  await client.query("select set_config('app.store_id', $1, false)", [storeB.id]);
  const asB = await client.query("select count(*)::int as c from orders where store_id = $1::uuid", [storeA.id]);
  check("avec GUC store_id=B -> commandes de A invisibles en SQL brut", asB.rows[0].c === 0);

  await client.query("select set_config('app.store_id', $1, false)", [storeA.id]);
  const asA = await client.query("select count(*)::int as c from orders where store_id = $1::uuid", [storeA.id]);
  check("avec GUC store_id=A -> commandes de A visibles en SQL brut", asA.rows[0].c >= 1);
  // IMPORTANT: PGlite socket partage UNE session entre clients socket; on remet
  // le rôle/GUC à zéro pour ne pas faire fuiter l'état RLS vers l'app.
  await client.query("reset role");
  await client.query("select set_config('app.store_id','',false), set_config('app.current_user_id','',false)");
  await client.end();
}

// --- RTL / i18n ---
{
  const frHome = await fetch(BASE + "/", { headers: { ...A } });
  const frHtml = await frHome.text();
  check("storefront FR -> dir=\"ltr\"", frHtml.includes('dir="ltr"'));
  const arHome = await fetch(BASE + "/", { headers: { ...A, Cookie: "locale=ar" } });
  const arHtml = await arHome.text();
  check("storefront AR -> lang=\"ar\" dir=\"rtl\"", arHtml.includes('lang="ar"') && arHtml.includes('dir="rtl"'));
}

console.log(failures === 0 ? "\nTOUS LES TESTS D'ISOLATION PASSENT" : `\n${failures} ÉCHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
