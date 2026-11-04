// Test de connexion en une commande contre le serveur local:
//   node scripts/test-login.mjs
// Affiche le statut HTTP du callback credentials + le verdict.
const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const HOST = { Host: "app.localhost:3000" };

const csrfRes = await fetch(BASE + "/api/auth/csrf", { headers: HOST });
const csrf = (await csrfRes.json()).csrfToken;
const csrfCookie = (csrfRes.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

const res = await fetch(BASE + "/api/auth/callback/credentials", {
  method: "POST",
  redirect: "manual",
  headers: { ...HOST, "Content-Type": "application/x-www-form-urlencoded", Cookie: csrfCookie },
  body: new URLSearchParams({
    csrfToken: csrf,
    email: "demo@exemple.tn",
    password: "demo1234",
  }),
});
const setCookie = (res.headers.getSetCookie?.() ?? []).find((c) => c.includes("session-token"));
console.log("callback credentials ->", res.status, res.headers.get("location") ?? "");
console.log(setCookie ? "SUCCÈS : cookie de session posé (connecté)" : "ÉCHEC : pas de cookie de session");
if (!setCookie) {
  console.log("Regarde le terminal du serveur : la ligne [auth] authorize: ... indique la cause");
  console.log("(user introuvable => npm run db:setup ; mot de passe refusé => re-seed ; ERREUR DB => npm run db:up)");
}

// Bonus: vérifie la session
const s = await fetch(BASE + "/api/auth/session", {
  headers: { ...HOST, Cookie: setCookie?.split(";")[0] ?? "" },
});
console.log("session ->", (await s.json())?.user?.email ?? "null");
