# /replica-test — plan fonctionnel F01–F06 (e2e via HTTP contre le serveur réel)

Cible : `BASE` (défaut `http://127.0.0.1:3000`), hôtes `app.localhost:3000` (dashboard)
et `boutique-a/b.localhost:3000` (storefronts). Exécution : `node tests/e2e/run.mjs`.

> Note : Playwright avec navigateur n'est pas exécutable dans le bac à sable
> (le téléchargement des binaires chromium passe par un CDN hors liste blanche),
> la suite e2e est donc 100 % HTTP (vrai serveur Next + vrai middleware + vraie base
> PGlite + vraies sessions cookie) — voir `bugs.md` B-01.

| ID | Scénario | Vérifications |
|----|----------|---------------|
| F01 | Accueil storefront boutique-a | `GET /` (Host boutique-a) → 200, HTML contient un nom de produit seedé ; `GET /api/public/stores/boutique-a/products` → ≥1 produit actif ; `GET /api/public/stores/boutique-a/delivery-fee?governorate=tunis` → `feeMinor` entier > 0 |
| F02 | Fiche produit | `GET /api/public/stores/boutique-a/products/<id>` → produit ; `GET /shop/product/<id>` (Host boutique-a) → 200 ; catégorie `GET /shop/category/<slug>` → 200 |
| F03 | Checkout COD bout-en-bout | `POST /api/public/stores/boutique-a/orders` payload valide (tél +216…, gouvernorat `tunis`, 1 item) → 200/201 + `order.number` au format `CMD-XXXXXX`, `totalMinor = subtotal + deliveryFee` ; **rejeu idempotent** (même `idempotency-key`) → même numéro ; tél invalide → 400 `PHONE_INVALID` ; items vides → 400 `EMPTY_ORDER` ; gouvernorat invalide → 400 |
| F04 | Suivi public commande | `GET /api/public/orders/<number>?phone=…&slug=boutique-a` → commande + `statusHistory` contient `new` ; mauvais téléphone → 404 ; `GET /shop/confirm?number=…&phone=…` → 200 ; `GET /shop/order/<number>?phone=…` → 200 |
| F05 | Dashboard commerçant | login nextauth `demo@exemple.tn`/`demo1234` (CSRF + callback) → cookie de session ; `GET /api/auth/session` → email ; `GET /api/stores` → contient `boutique-a` ; cookie `store_id` posé ; `GET /api/orders?q=CMD-…` → contient la commande F03 ; `POST /api/orders/<id>/status` `new→to_confirm` → 200 ; transition invalide `new→delivered` → 409 ; `GET /app` (Host app) → 200 |
| F06 | Isolation multi-boutique | la commande F03 **n'apparaît pas** dans `GET /api/public/stores/boutique-b/orders`-style (suivi avec `slug=boutique-b` → 404) ; le catalogue public de boutique-b ne contient pas le produit de boutique-a ; `GET /api/orders` (session boutique-a) ne liste que des commandes de boutique-a ; accès API dashboard sans session → 401 |

Livrables : `tests/e2e/run.mjs` (runner), `tests/e2e/last-run.txt` (sortie),
`bugs.md` (anomalies trouvées + contournements).
