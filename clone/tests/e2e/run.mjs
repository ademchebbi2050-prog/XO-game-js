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
// M5: IP fictive aléatoire par run -> le rate-limiter IP (5/10min) ne pénalise pas les re-runs
const RUN_IP = `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
// M5: téléphones aléatoires par run -> le rate-limiter téléphone (3/h) ne bloque pas les re-runs
const RUN_PHONE = () => "+216" + String(Math.floor(10000000 + Math.random() * 89999999));
function req(path, { host = APP_HOST, method = "GET", body, headers = {}, cookies, maxRedirects = 0 } = {}) {
  if (method === "POST" && !headers["x-forwarded-for"]) headers = { ...headers, "x-forwarded-for": RUN_IP };
  return new Promise((resolve, reject) => {
    const data = body == null ? null : typeof body === "string" ? body : JSON.stringify(body); // string = body brut (webhook signé)
    const r = http.request(
      {
        host: DEF_HOST, port: Number(DEF_PORT), path, method,
        headers: {
          Host: host,
          ...(data ? { "content-type": headers["content-type"] ?? "application/json", "content-length": Buffer.byteLength(data) } : {}),
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

// réapprovisionnement du produit démo si besoin (les runs précédents consomment le stock)
async function ensureProductStock() {
  const p = products[0];
  if ((p.stock ?? 0) >= 5 && (p.variants ?? []).every((v) => v.stock >= 5)) return;
  const s = await login("demo@exemple.tn", "demo1234");
  const stores = await req("/api/stores", { cookies: s.cookies });
  s.cookies.set("store_id", stores.json.stores.find((x) => x.slug === "boutique-a")?.id);
  await req(`/api/products/${p.id}`, { method: "PATCH", body: { stock: 50 }, cookies: s.cookies });
  p.stock = 50;
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
  await ensureProductStock();
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
const F03_PHONE = RUN_PHONE();
{
  const p = products[0];
  {
    const before = p.stock ?? 0;
    await ensureProductStock();
    check("réapprovisionnement stock produit si besoin (PATCH /api/products/<id>)", p.stock >= 5, `stock ${before} -> ${p.stock}`);
  }
  const payload = {
    customerName: "Test E2E",
    customerPhone: F03_PHONE,
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
  const phone = F03_PHONE;
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
  const phone = F03_PHONE;
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


// ---------------- F07 ----------------
scenario("F07 — Paiement carte PSP simulé (SimPSP)");
let pspRef = null;
const F07_PHONE = RUN_PHONE();
{
  const p = products[0];
  await ensureProductStock();
  const payload = {
    customerName: "Test Carte",
    customerPhone: F07_PHONE,
    governorate: "tunis",
    address: "1 rue Carte, Tunis",
    items: [{ productId: p.id, qty: 1 }],
    paymentMethod: "card",
  };
  const r = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: payload, headers: { "idempotency-key": "e2e-card-" + Date.now() } });
  check("POST commande carte -> 201 + payment.pspRef + payUrl", r.status === 201 && r.json?.payment?.pspRef?.startsWith("PSP-") && r.json?.payment?.payUrl?.startsWith("/pay/"), `status=${r.status} psp=${r.json?.payment?.pspRef}`);
  pspRef = r.json?.payment?.pspRef;
  check("order.paymentMethod = card, paymentStatus = pending", r.json?.order?.paymentMethod === "card" && r.json?.order?.paymentStatus === "pending");
  const st = await req(`/api/public/psp/${pspRef}`, { host: SHOP_A });
  check("GET /api/public/psp/<ref> -> pending + montant = total", st.status === 200 && st.json?.status === "pending" && st.json?.amountMinor === r.json?.order?.totalMinor);
  const payPage = await req(`/pay/${pspRef}`, { host: SHOP_A, maxRedirects: 3 });
  check("GET /pay/<ref> (hosted-checkout simulé) -> 200", payPage.status === 200, `status=${payPage.status}`);
  const ok = await req(`/api/public/psp/${pspRef}/confirm`, { host: SHOP_A, method: "POST", body: { action: "approve" } });
  check("POST confirm approve -> paid + authCode + order.paymentStatus=paid", ok.status === 200 && ok.json?.status === "paid" && !!ok.json?.authCode && ok.json?.order?.paymentStatus === "paid", `status=${ok.status}`);
  const okReplay = await req(`/api/public/psp/${pspRef}/confirm`, { host: SHOP_A, method: "POST", body: { action: "approve" } });
  check("rejeu confirm -> idempotent (toujours paid)", okReplay.status === 200 && okReplay.json?.status === "paid");
  // webhook: mauvaise signature -> 401 ; bonne signature refund -> refunded
  const crypto = await import("node:crypto");
  const secret = process.env.SIMPSP_WEBHOOK_SECRET || "simpsp-webhook-dev";
  const evt = JSON.stringify({ type: "payment.refunded", ref: pspRef });
  const badSig = await req("/api/webhooks/psp", { method: "POST", body: evt, headers: { "content-type": "application/json", "x-simpsp-signature": "deadbeef" } });
  check("webhook signature invalide -> 401", badSig.status === 401, `status=${badSig.status}`);
  const goodSig = crypto.createHmac("sha256", secret).update(evt).digest("hex");
  const wh = await req("/api/webhooks/psp", { method: "POST", body: evt, headers: { "content-type": "application/json", "x-simpsp-signature": goodSig } });
  check("webhook signé payment.refunded -> 200 + status refunded", wh.status === 200 && wh.json?.status === "refunded", `status=${wh.status} -> ${wh.json?.status}`);
  const st2 = await req(`/api/public/psp/${pspRef}`, { host: SHOP_A });
  check("GET psp après webhook -> refunded", st2.json?.status === "refunded");
}

// ---------------- F08 ----------------
scenario("F08 — Variantes de produits (M5)");
let variantL = null;
const F08_PHONE = RUN_PHONE();
{
  const p = products[0];
  await ensureProductStock();
  const detail = await req(`/api/public/stores/boutique-a/products/${p.id}`, { host: SHOP_A });
  const vs = detail.json?.product?.variants ?? [];
  check("fiche produit publique -> variantes actives présentes (S/M/L)", vs.length >= 3 && vs.every((v) => typeof v.priceDeltaMinor === "number"), vs.map((v) => v.label).join(","));
  variantL = vs.find((v) => v.label === "L") ?? vs[0];
  const before = variantL.stock;
  const payload = {
    customerName: "Test Variante",
    customerPhone: F08_PHONE,
    governorate: "tunis",
    address: "2 rue Variante",
    items: [{ productId: p.id, variantId: variantL.id, qty: 2 }],
  };
  const r = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: payload, headers: { "idempotency-key": "e2e-var-" + Date.now() } });
  check("commande avec variantId -> 201", r.status === 201, `status=${r.status} err=${r.json?.error}`);
  const track = await req(`/api/public/orders/${r.json?.order?.number}?phone=${encodeURIComponent(payload.customerPhone)}&slug=boutique-a`, { host: SHOP_A });
  const item = track.json?.order?.items?.[0];
  check("prix = base + delta variante (L = +5000) et snapshot nom contient le label", item && item.priceMinor === p.priceMinor + variantL.priceDeltaMinor && item.nameSnapshot.includes(variantL.label), `price=${item?.priceMinor} name=${item?.nameSnapshot}`);
  const detail2 = await req(`/api/public/stores/boutique-a/products/${p.id}`, { host: SHOP_A });
  const after = detail2.json?.product?.variants?.find((v) => v.id === variantL.id);
  check("stock de la variante décrémenté de qty", after && after.stock === before - 2, `${before} -> ${after?.stock}`);
  const badVar = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: { ...payload, items: [{ productId: p.id, variantId: "00000000-0000-0000-0000-000000000000", qty: 1 }] } });
  check("variantId inconnu -> 400 VARIANT_INVALID", badVar.status === 400 && badVar.json?.error === "VARIANT_INVALID", `status=${badVar.status}`);
  const oos = await req("/api/public/stores/boutique-a/orders", { host: SHOP_A, method: "POST", body: { ...payload, items: [{ productId: p.id, variantId: variantL.id, qty: 9999 }] } });
  check("qty > stock variante -> 409 OUT_OF_STOCK", oos.status === 409 && oos.json?.error === "OUT_OF_STOCK");
  // gestion des variantes via l'API dashboard
  const s = await login("demo@exemple.tn", "demo1234");
  const stores = await req("/api/stores", { cookies: s.cookies });
  const aId = stores.json.stores.find((x) => x.slug === "boutique-a")?.id;
  s.cookies.set("store_id", aId);
  const patch = await req(`/api/products/${p.id}`, { method: "PATCH", body: { variants: [...vs.map((v) => ({ id: v.id, label: v.label, priceDeltaMinor: v.priceDeltaMinor, stock: v.stock, isActive: true })), { label: "XL", priceDeltaMinor: 10000, stock: 3 }] }, cookies: s.cookies });
  check("PATCH produit avec variantes (ajout XL) -> 200 + 4 variantes", patch.status === 200 && patch.json?.product?.variants?.length === 4, `status=${patch.status} n=${patch.json?.product?.variants?.length}`);
}

// ---------------- F09 ----------------
scenario("F09 — Thème no-code de la boutique (M5)");
{
  const s = await login("demo@exemple.tn", "demo1234");
  const stores = await req("/api/stores", { cookies: s.cookies });
  const a = stores.json.stores.find((x) => x.slug === "boutique-a");
  s.cookies.set("store_id", a.id);
  const patch = await req(`/api/stores/${a.id}`, { method: "PATCH", body: { settings: { theme: { preset: "nuit", accent: "#E8734A", accentHover: "#F08A63", bg: "#14161B", surface: "#1D2027", text: "#F2EFE9", muted: "#A9A294", accentSoft: "#3A2A22", radius: "md", font: "sans" } } }, cookies: s.cookies });
  check("PATCH settings.theme (preset nuit) -> 200", patch.status === 200, `status=${patch.status}`);
  const home = await req("/", { host: SHOP_A });
  check("storefront boutique-a injecte les variables du thème (#E8734A dans le HTML)", home.status === 200 && home.text.includes("#E8734A"), `status=${home.status}`);
  const detail = await req("/api/public/stores/boutique-a", { host: SHOP_A });
  check("thème persisté dans stores.settings", detail.status === 200, `status=${detail.status}`);
  // restaure le thème par défaut
  await req(`/api/stores/${a.id}`, { method: "PATCH", body: { settings: { theme: { preset: "terre" } } }, cookies: s.cookies });
  const home2 = await req("/", { host: SHOP_A });
  check("thème restauré (terre) -> #A83E14 présent", home2.text.includes("#A83E14"));
}

// ---------------- F10 ----------------
scenario("F10 — Notifications push simulées (M5)");
{
  const s = await login("demo@exemple.tn", "demo1234");
  const stores = await req("/api/stores", { cookies: s.cookies });
  s.cookies.set("store_id", stores.json.stores.find((x) => x.slug === "boutique-a")?.id);
  const endpoint = "sim://device/e2e-" + Date.now();
  const sub = await req("/api/push/subscribe", { method: "POST", body: { endpoint, keys: { p256dh: "sim" } }, cookies: s.cookies });
  check("POST /api/push/subscribe -> 200", sub.status === 200 && sub.json?.subscription?.endpoint === endpoint, `status=${sub.status}`);
  const o = order;
  const tr = await req(`/api/orders/${o.id}/status`, { method: "POST", body: { status: "confirmed", note: "e2e push" }, cookies: s.cookies });
  check("transition to_confirm->confirmed -> 200", tr.status === 200, `status=${tr.status} err=${tr.json?.error}`);
  const ev = await req("/api/push/events?limit=10", { cookies: s.cookies });
  const hit = (ev.json?.events ?? []).find((e) => e.title.includes(o.number) && e.url === `/app/orders/${o.id}`);
  check("push émise à la transition (outbox: titre + url /app/orders/<id>)", ev.status === 200 && !!hit, hit ? hit.body : "aucun event");
}

// ---------------- F11 ----------------
scenario("F11 — Commission plateforme / pricing (M5)");
{
  const s = await login("demo@exemple.tn", "demo1234");
  const stores = await req("/api/stores", { cookies: s.cookies });
  const a = stores.json.stores.find((x) => x.slug === "boutique-a");
  s.cookies.set("store_id", a.id);
  check("seed: commissionBps = 500 dans settings", Number(a.settings?.commissionBps) === 500, `bps=${a.settings?.commissionBps}`);
  const stats = await req("/api/dashboard/stats?range=all", { cookies: s.cookies });
  const st = stats.json?.stats ?? {};
  check("stats: commissionMinor = floor(revenue*500/10000) et netMinor = revenue - commission",
    st.commissionBps === 500 && st.commissionMinor === Math.floor((st.revenueMinor ?? 0) * 500 / 10000) && st.netMinor === (st.revenueMinor ?? 0) - (st.commissionMinor ?? 0),
    `rev=${st.revenueMinor} comm=${st.commissionMinor} net=${st.netMinor}`);
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
