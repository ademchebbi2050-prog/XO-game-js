// tests/e2e/run.mjs — suite e2e F01–F06 (HTTP réel: serveur Next + middleware + PGlite).
// Usage: node tests/e2e/run.mjs   (BASE host:port = 127.0.0.1:3000 par défaut)
// Note: on passe par node:http car fetch (undici) ignore l'en-tête Host (interdit),
// et le routage multi-hôte du middleware dépend précisément de Host.
import http from "node:http";
import { writeFileSync } from "node:fs";

const HOSTPORT = (process.env.BASE || "127.0.0.1:3000").replace(/^https?:\/\//, "");
const [DEF_HOST, DEF_PORT] = HOSTPORT.split(":");
const APP_HOST = "app.localhost:3000";
const SHOP_A = "boutique-a.localhost:3000";
const SHOP_B = "boutique-b.localhost:3000";

const results = [];
let current = "";
function scenario(name) { current = name; console.log(`\n=== ${name} ===`); }
function check(label, ok, extra = "") {
  results.push({ scenario: current, label, ok, extra });
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
}

function jar() {
  const m = new Map();
  return {
    store(res) {
      const set = res.headers["set-cookie"] ?? [];
      for (const c of set) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        m.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
    },
    header() { return [...m.entries()].map(([k, v]) => `${k}=${v}`).join("; "); },
    get(name) { return m.get(name); },
    set(name, v) { m.set(name, v); },
  };
}

// requête HTTP avec vrai en-tête Host (node:http l'autorise, contrairement à fetch)
function req(path, { host = APP_HOST, method = "GET", body, headers = {}, cookies, maxRedirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        host: DEF_HOST, port: Number(DEF_PORT), path, method,
        headers: {
          Host: host,
          ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}),
          ...(cookies ? { cookie: cookies.header() } : {}),
          ...headers,
        },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", async () => {
          if (cookies) cookies.store(res);
          if (maxRedirects > 0 && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const loc = res.headers.location.startsWith("http")
              ? new URL(res.headers.location).pathname + new URL(res.headers.location).search
              : res.headers.location;
            const again = await req(loc, { host, method: "GET", cookies, maxRedirects: maxRedirects - 1 });
            return resolve({ ...again, redirects: (res.statusCode) });
          }
          let json = null;
          try { json = JSON.parse(text); } catch {}
          resolve({ status: res.statusCode, text, json, headers: res.headers });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

async function login(email, password) {
  const cookies = jar();
  const csrf = await req("/api/auth/csrf", { cookies });
  const token = csrf.json?.csrfToken;
  const form = new URLSearchParams({ csrfToken: token, email, password, callbackUrl: "/app", json: "true" });
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        host: DEF_HOST, port: Number(DEF_PORT), path: "/api/auth/callback/credentials", method: "POST",
        headers: {
          Host: APP_HOST,
          "content-type": "application/x-www-form-urlencoded",
          "content-length": Buffer.byteLength(form.toString()),
          cookie: cookies.header(),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => { cookies.store(res); resolve({ cookies, status: res.statusCode }); });
      }
    );
    r.on("error", reject);
    r.write(form.toString());
    r.end();
  });
}

// ---------------- F01 ----------------
scenario("F01 — Accueil storefront boutique-a");
let products = [];
{
  const home = await req("/", { host: SHOP_A, maxRedirects: 3 });
  check("GET / (Host boutique-a) -> 200", home.status === 200, `status=${home.status}`);
  const list = await req("/api/public/stores/boutique-a/products", { host: SHOP_A });
  products = list.json?.products ?? [];
  check("catalogue public boutique-a -> >=1 produit actif", list.status === 200 && products.length >= 1, `${products.length} produit(s)`);
  const storeInfo = await req("/api/public/stores/boutique-a", { host: SHOP_A });
  const storeName = storeInfo.json?.store?.name ?? "";
  check("la page d'accueil affiche le nom de la boutique (SSR)", !!storeName && home.text.includes(storeName), storeName);
  const fee = await req("/api/public/stores/boutique-a/delivery-fee?governorate=tunis", { host: SHOP_A });
  check("delivery-fee tunis -> feeMinor entier > 0", fee.status === 200 && Number.isInteger(fee.json?.feeMinor) && fee.json.feeMinor > 0, `feeMinor=${fee.json?.feeMinor}`);
}

// ---------------- F02 ----------------
scenario("F02 — Fiche produit & catégorie");
{
  const p = products[0];
  const detail = await req(`/api/public/stores/boutique-a/products/${p.id}`, { host: SHOP_A });
  check("GET product detail API -> 200 + bon id", detail.status === 200 && detail.json?.product?.id === p.id, `status=${detail.status}`);
  const page = await req(`/shop/product/${p.id}`, { host: SHOP_A, maxRedirects: 3 });
  check("GET /shop/product/<id> -> 200", page.status === 200, `status=${page.status}`);
  const catSlug = p.category?.slug ?? "divers";
  const cat = await req(`/shop/category/${catSlug}`, { host: SHOP_A, maxRedirects: 3 });
  check("GET /shop/category/<slug> -> 200", cat.status === 200, `status=${cat.status}`);
}

// ---------------- F03 ----------------
scenario("F03 — Checkout COD bout-en-bout");
let order = null;
{
  const p = products[0];
  // réapprovisionnement si le stock démo est insuffisant (consommé par les runs précédents)
  if ((p.stock ?? 0) < 2) {
    const s = await login("demo@exemple.tn", "demo1234");
    const stores = await req("/api/stores", { cookies: s.cookies });
    s.cookies.set("store_id", stores.json.stores.find((x) => x.slug === "boutique-a")?.id);
    const patch = await req(`/api/products/${p.id}`, { method: "PATCH", body: { stock: 10 }, cookies: s.cookies });
    check("réapprovisionnement stock produit (PATCH /api/products/<id>) -> 200", patch.status === 200, `status=${patch.status} err=${patch.json?.error}`);
    p.stock = 10;
  }
  const payload = {
    customerName: "Test E2E",
    customerPhone: "+21698765432",
    governorate: "tunis",
    address: "12 rue de Test, Tunis",
    items: [{ productId: p.id, qty: 2 }],
  };
  const idem = "e2e-" + Date.now();
  const hdr = { "idempotency-key": idem };
  const r1 = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: payload, headers: hdr });
  order = r1.json?.order ?? null;
  check("POST commande valide -> 200/201 + number CMD-XXXXXX", (r1.status === 200 || r1.status === 201) && order && /^CMD-\d{6}$/.test(order.number), `status=${r1.status} number=${order?.number}`);
  const r2 = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: payload, headers: hdr });
  check("rejeu idempotent (même clé) -> même numéro, pas de doublon", (r2.status === 200 || r2.status === 201) && r2.json?.order?.number === order?.number, `status=${r2.status} number=${r2.json?.order?.number}`);
  const track = await req(`/api/public/orders/${order.number}?phone=${encodeURIComponent(payload.customerPhone)}&slug=boutique-a`, { host: SHOP_A });
  const o = track.json?.order ?? {};
  check("totalMinor = subtotalMinor + deliveryFeeMinor (via suivi)", o.totalMinor === o.subtotalMinor + o.deliveryFeeMinor, `${o.totalMinor} = ${o.subtotalMinor} + ${o.deliveryFeeMinor}`);
  check("sous-total = prix unitaire x qty", o.subtotalMinor === p.priceMinor * 2, `${o.subtotalMinor} vs ${p.priceMinor}*2`);
  const badPhone = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: { ...payload, customerPhone: "123" } });
  check("téléphone invalide -> 400 PHONE_INVALID", badPhone.status === 400 && badPhone.json?.error === "PHONE_INVALID", `status=${badPhone.status}`);
  const empty = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: { ...payload, items: [] } });
  check("panier vide -> 400 EMPTY_ORDER", empty.status === 400 && empty.json?.error === "EMPTY_ORDER", `status=${empty.status}`);
  const badGov = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: { ...payload, governorate: "atlantis" } });
  check("gouvernorat invalide -> 400 INVALID_FORM", badGov.status === 400, `status=${badGov.status} err=${badGov.json?.error}`);
  const oos = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: { ...payload, items: [{ productId: p.id, qty: 9999 }] } });
  check("commande > stock -> 409 OUT_OF_STOCK", oos.status === 409 && oos.json?.error === "OUT_OF_STOCK", `status=${oos.status} err=${oos.json?.error}`);
}

// ---------------- F04 ----------------
scenario("F04 — Suivi public de la commande");
{
  const phone = "+21698765432";
  const track = await req(`/api/public/orders/${order.number}?phone=${encodeURIComponent(phone)}&slug=boutique-a`, { host: SHOP_A });
  const history = track.json?.order?.history ?? track.json?.order?.statusHistory ?? [];
  check("GET /api/public/orders/<number> -> 200 + history contient 'new'", track.status === 200 && history.some((h) => h.status === "new"), `status=${track.status}`);
  const wrongPhone = await req(`/api/public/orders/${order.number}?phone=%2B21600000000&slug=boutique-a`, { host: SHOP_A });
  check("mauvais téléphone -> 404", wrongPhone.status === 404, `status=${wrongPhone.status}`);
  const conf = await req(`/shop/confirm?number=${order.number}&phone=${encodeURIComponent(phone)}`, { host: SHOP_A, maxRedirects: 3 });
  check("GET /shop/confirm -> 200", conf.status === 200, `status=${conf.status}`);
  const ord = await req(`/shop/order/${order.number}?phone=${encodeURIComponent(phone)}`, { host: SHOP_A, maxRedirects: 3 });
  check("GET /shop/order/<number> -> 200", ord.status === 200, `status=${ord.status}`);
}

// ---------------- F05 ----------------
scenario("F05 — Dashboard commerçant (login + commandes + transition)");
let session = null, storeId = null;
{
  const { cookies, status } = await login("demo@exemple.tn", "demo1234");
  session = cookies;
  check("login credentials -> 302 + cookie session", status === 302 && !!(cookies.get("next-auth.session-token") || cookies.get("authjs.session-token")), `status=${status}`);
  const sess = await req("/api/auth/session", { cookies });
  check("GET /api/auth/session -> demo@exemple.tn", sess.status === 200 && sess.json?.user?.email === "demo@exemple.tn", sess.json?.user?.email ?? "");
  const stores = await req("/api/stores", { cookies });
  const mine = (stores.json?.stores ?? []).map((s) => s.slug);
  check("GET /api/stores -> contient boutique-a", stores.status === 200 && mine.includes("boutique-a"), mine.join(","));
  storeId = stores.json.stores.find((s) => s.slug === "boutique-a")?.id;
  cookies.set("store_id", storeId);
  const list = await req(`/api/orders?q=${order.number}`, { cookies });
  const found = (list.json?.orders ?? []).some((x) => x.number === order.number);
  check("GET /api/orders?q=<numéro> -> commande F03 retrouvée", list.status === 200 && found, `status=${list.status}`);
  const tr = await req(`/api/orders/${order.id}/status`, { method: "POST", body: { status: "to_confirm", note: "e2e" }, cookies });
  check("POST status new->to_confirm -> 200", tr.status === 200 && tr.json?.order?.status === "to_confirm", `status=${tr.status} err=${tr.json?.error}`);
  const bad = await req(`/api/orders/${order.id}/status`, { method: "POST", body: { status: "delivered" }, cookies });
  check("transition invalide to_confirm->delivered -> 409", bad.status === 409, `status=${bad.status} err=${bad.json?.error}`);
  const app = await req("/app", { cookies, maxRedirects: 3 });
  check("GET /app (Host app, session) -> 200 après redirect", app.status === 200, `status=${app.status}`);
  const noAuth = await req("/api/orders");
  check("GET /api/orders sans session -> 401", noAuth.status === 401, `status=${noAuth.status}`);
}

// ---------------- F06 ----------------
scenario("F06 — Isolation multi-boutique");
{
  const phone = "+21698765432";
  const cross = await req(`/api/public/orders/${order.number}?phone=${encodeURIComponent(phone)}&slug=boutique-b`, { host: SHOP_B });
  check("commande boutique-a invisible via slug=boutique-b -> 404", cross.status === 404, `status=${cross.status}`);
  const prodB = await req("/api/public/stores/boutique-b/products", { host: SHOP_B });
  const leak = (prodB.json?.products ?? []).some((x) => products.some((a) => a.id === x.id));
  check("catalogue boutique-b ne contient aucun produit de boutique-a", prodB.status === 200 && !leak);
  const myOrders = await req("/api/orders?limit=100", { cookies: session });
  const foreign = (myOrders.json?.orders ?? []).filter((x) => x.storeId && x.storeId !== storeId);
  check("GET /api/orders (session boutique-a) -> 0 commande étrangère", myOrders.status === 200 && foreign.length === 0, `${(myOrders.json?.orders ?? []).length} commande(s), étrangères=${foreign.length}`);
  const s = await login("demo@exemple.tn", "demo1234");
  const stores = await req("/api/stores", { cookies: s.cookies });
  const bId = stores.json.stores.find((x) => x.slug === "boutique-b")?.id;
  if (bId) {
    s.cookies.set("store_id", bId);
    const listB = await req("/api/orders?limit=100", { cookies: s.cookies });
    const leakNum = (listB.json?.orders ?? []).some((x) => x.number === order.number);
    check("session store_id=boutique-b ne voit pas la commande de boutique-a", !leakNum, `commandes boutique-b=${(listB.json?.orders ?? []).length}`);
  } else {
    check("boutique-b appartient au compte demo (sinon test sauté)", false, "boutique-b absent de /api/stores");
  }
}

// ---------------- récap ----------------
const failed = results.filter((r) => !r.ok);
console.log(`\n================ RÉCAP ================`);
console.log(`${results.length - failed.length}/${results.length} vérifications OK`);
if (failed.length) {
  console.log("ÉCHECS:");
  for (const f of failed) console.log(`  ❌ [${f.scenario}] ${f.label} ${f.extra}`);
}
const report = [
  `# Dernière exécution e2e — ${new Date().toISOString()}`,
  ``,
  `BASE=${HOSTPORT}`,
  `${results.length - failed.length}/${results.length} OK`,
  ``,
  ...results.map((r) => `- [${r.ok ? "PASS" : "FAIL"}] ${r.scenario} :: ${r.label}${r.extra ? " — " + r.extra : ""}`),
  ``,
].join("\n");
writeFileSync(new URL("./last-run.txt", import.meta.url), report);
console.log("rapport écrit dans tests/e2e/last-run.txt");
process.exit(failed.length ? 1 : 0);
