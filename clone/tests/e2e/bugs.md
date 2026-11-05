# bugs.md — anomalies & contournements rencontrés pendant /replica-test

Date : 2026-11-05 — suite `tests/e2e/run.mjs` (F01–F06), résultat **32/32 PASS** (`last-run.txt`).

## B-01 — Playwright non exécutable dans le bac à sable (contournement)
- **Symptôme** : `npx playwright install chromium` échoue — le téléchargement des binaires passe par un CDN hors liste blanche de sortie du bac à sable.
- **Contournement** : la suite e2e est écrite en HTTP pur (`node:http`) contre le vrai serveur Next (middleware, PGlite, sessions cookie) — couverture équivalente pour des parcours form/API.
- **Sur une machine de dev avec Internet** : `npm i -D playwright && npx playwright install chromium`, puis porter les scénarios F01–F06 en scripts Playwright (les sélecteurs clés : nom de boutique dans le layout shop, boutons « Ajouter au panier », formulaire checkout).

## B-02 — fetch (undici) ignore l'en-tête `Host` (piège de test, pas un bug app)
- **Symptôme** : avec `fetch(..., { headers: { host: "boutique-a.localhost:3000" } })`, le middleware recevait `Host: 127.0.0.1:3000` → routage app au lieu de boutique → 307/404 parasites.
- **Contournement** : le runner utilise `node:http` qui transmet bien `Host`. Le routage par hôte fonctionne correctement (vérifié : `/` sur `boutique-a` → 200 storefront, `/app` sur `app` → dashboard).

## B-03 — stock du produit démo consommé par les runs successifs (comportement correct)
- **Symptôme** : après plusieurs exécutions, `POST /api/public/stores/boutique-a/orders` renvoie `409 OUT_OF_STOCK`.
- **Ce n'est PAS un bug** : le stock conditionnel fonctionne (vérifié aussi négativement : qty > stock → 409).
- **Contournement** : la suite réapprovisionne d'abord via `PATCH /api/products/<id> { stock: 10 }` (session demo + cookie `store_id`).

## B-04 — shape des réponses à connaître (pas un bug)
- `POST /api/public/stores/[slug]/orders` renvoie un **résumé** `{ order: { id, number, totalMinor, status } }` ; le détail complet (sous-total, frais, historique) se lit via `GET /api/public/orders/[number]?phone=&slug=` → `{ order: { ..., history: [...] } }`.
- Le rejeu idempotent renvoie le **même numéro** avec HTTP 201 (pas de champ `replayed` exposé) — testé : aucun doublon créé.

## Bugs applicatifs trouvés : aucun
Aucun des 32 contrôles F01–F06 n'a révélé de défaut fonctionnel (routage multi-hôte, catalogue, checkout COD + idempotence + garde-fous, suivi public, login dashboard, transitions de statut, isolation boutique-a/boutique-b, 401 sans session).
