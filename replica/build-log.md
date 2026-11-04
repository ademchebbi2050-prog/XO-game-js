# Build-log — clone clean-room Converty (M0 + M1 tranche COD)

Date : 2026-11-03. Branche : `arena/b7a40c52-xo-game-js`. Code : `clone/`.
Recon/architecture/design : `replica/recon.md`, `replica/architecture.md` (RÉV.2 validée),
`replica/schema.sql` (RÉV.2, 15 tables + vue), `replica/design/` (tokens, contraste 36 paires 0 échec AA).

## Résultat

- `npx tsc --noEmit` : clean. `npm run build` : OK (toutes les routes compilées, middleware 34,5 kB).
- Serveur prod local : `npx next start -p 3000 -H 0.0.0.0` — smoke test complet OK
  (voir `replica/clone-screens/smoke-test.txt`) : cycle COD de bout en bout
  (commande web -> idempotence -> décrément stock -> rate limit -> confirmation ->
  expédition transporteur simulé -> livraison/paiement -> retour/restock -> suivi public masqué -> blocage téléphone),
  multi-store par sous-domaine avec isolation vérifiée, FR + AR RTL (`lang="ar" dir="rtl"`).

## Stack effectivement livrée

Next.js 15.5.29 (App Router) + TypeScript + Tailwind 4 + Prisma 6.19.3 (client WASM)
+ adaptateur `pg` + PGlite (Postgres WASM) en local via serveur socket, NextAuth v5 (JWT, cookie host-only).

## Écarts / déviations (et pourquoi)

1. **Base de données locale = PGlite, pas Neon.** Le sandbox n'a accès qu'à github/npm/pypi :
   pas de Neon, pas de binaries.prisma.sh. Choix : `@electric-sql/pglite` + `pglite-socket`
   (serveur socket PG sur 127.0.0.1:5433, `scripts/pglite-server.mjs`), schéma appliqué par
   `scripts/init-db.mjs` depuis `replica/schema.sql`. En prod, `DATABASE_URL` pointe vers Neon —
   aucun changement de code (même adaptateur pg).
2. **Prisma sans binaire Rust.** Le client est généré avec `PRISMA_CLIENT_ENGINE_TYPE=client`
   (compilateur de requêtes WASM embarqué dans `@prisma/client/runtime`, aucun téléchargement).
   Les enums du schéma Prisma sont `@@map`és vers les noms minuscules créés par schema.sql.
   Les variables `PRISMA_*_BINARY` factices (`/home/user/.prisma-dummy/`) ne servent QU'AU CLI
   `prisma generate` (hors-ligne) — jamais au build ni au runtime.
   `scripts/patch-prisma-wasm.mjs` (postinstall) rebranche `config.compilerWasm` si régénération
   sans la variable d'env. PGlite étant mono-connexion, le pool pg est bridé à `max: 1` en local.
3. **i18n maison, pas next-intl.** FR/AR dès le jour 1 via cookie `locale` + en-têtes
   `x-locale` (middleware) + `LocaleProvider` ; RTL via `dir="rtl"` et propriétés logiques CSS
   (`.flip-rtl` / `.ltr-island`). 20+ langues : hors tranche M1 (features.csv = "partial").
4. **Middleware edge sans Prisma.** `src/lib/hosts.ts` (sans import DB) fournit `RESERVED_SLUGS`
   et le routage par hôte ; `tenant.ts` les ré-exporte. Le bundle edge casse sinon (URIs node:).
5. **Redirections.** `/` -> `/app` -> `/app/login` (hôte app) ; hôte boutique -> `/shop/*`.
   Garde de session dans `app/(protected)/layout.tsx` (groupe de routes), login/signup publics.
6. **Cookies.** `Secure` piloté par `COOKIE_SECURE=true` (prod HTTPS) ; en local http, cookie
   de session host-only non-Secure. `trustHost: true` requis en local (hôtes *.localhost).
7. **Transporteurs simulés** (`src/lib/carriers/simulated.ts`) : tracking `SIM-######-XXXX`,
   aucune API externe. Presets de prix par gouvernorat (24, TND millimes), pas par pays.
8. **Images produits** : upload local `public/uploads` (pas de resize sharp en M1) ; URL produit = id.
9. **features.csv** : colonne `clone` renseignée honnêtement — 13 yes / 13 partial / 29 no
   (voir fichier). Les lignes "skip" de l'original (marque, thèmes propriétaires, réseau
   transporteurs, modèles IA entraînés) restent exclues clean-room.

## Captures d'écran

Pas de navigateur headless disponible dans le sandbox (egress limité à github/npm/pypi, pas de
binaire Chromium téléchargeable). En remplacement : snapshots HTML rendus par le serveur de prod
+ transcript du smoke test dans `replica/clone-screens/` (15 fichiers .html FR/AR + smoke-test.txt).

## Runbook local

```
node scripts/pglite-server.mjs          # déjà lancé en session (127.0.0.1:5433)
node scripts/init-db.mjs && node scripts/seed.mjs   # demo@exemple.tn / demo1234, boutique-a/boutique-b
npm run build                            # PAS de variables PRISMA_*_BINARY ici
npx next start -p 3000 -H 0.0.0.0
# storefront : Host: boutique-a.localhost:3000   dashboard : Host: app.localhost:3000
```

## Jalon M2 — catalogue & gestion (2026-11-04)

Livré et testé contre le serveur de prod local :

- **Images**: `lib/storage.ts` traite désormais côté serveur avec sharp — orientation EXIF
  appliquée, resize max 1600 px (vérifié: 2400×1800 → webp 1600×1200), recompression WebP q80,
  EXIF/métadonnées supprimés, nom aléatoire. Magic bytes vérifiés (faux PNG rejeté 400).
- **Catégories**: CRUD API + création inline depuis la page Produits (UI FR/AR).
- **Stock**: badges rupture / stock faible (≤5) sur la liste; décrément conditionnel en
  transaction (anti-oversell, testé M1); **remise en stock sur `cancelled` et `returned`**,
  garde `restocked` (testé: stock 18→15 à la commande manuelle, retour à 18 à l'annulation,
  double restock impossible → 409).
- **Commande manuelle + édition**: `POST /api/orders` (source=manual, testé CMD-000011),
  `PATCH /api/orders/[id]` (nom/adresse/gouvernorat/téléphone +216 validé, testé).
- **Timeline**: historique des statuts + appels journalisés sur la fiche commande; boutons
  `tel:` / `wa.me` (WhatsApp) présents.
- **Tests d'isolation** (`tests/isolation/run.mjs`, 13 cas): tous PASS — commande/produit
  de A invisibles depuis B (liste, détail, mutation), suivi public cross-boutique → 404,
  sans session → 401, `store_id` étranger → 401 (**fail-closed corrigé en M2**: auparavant
  repli silencieux sur la première boutique).

## Jalon M3 — livraison simulée & stats (2026-11-04)

- **Étiquette d'expédition**: `GET /api/public/label/[tracking]?slug=<boutique>` renvoie une
  étiquette HTML imprimable (boutique, n° CMD, tracking, « COD : xx.xxx TND », adresse, transporteur),
  scoping par slug (cross-boutique → 404, testé). Lien « Étiquette d'expédition » sur la fiche
  commande (dashboard). Snapshot: `replica/clone-screens/label-expedition-cmd-000013.html`.
- **Suivi transporteur simulé**: `CarrierAdapter.trackingEvents?` + adapter simulé déterministe
  (picked_up → in_transit → out_for_delivery → delivered, filtré sur l'heure actuelle).
  Exposé dans l'API publique de suivi et affiché sur `/order/CMD-xxxxxx` (testé: `shipped` +
  événement `picked_up` visible). Alias `sim-standard`/`sim-express` enregistrés.
- **Stats via la vue SQL**: `/api/dashboard/stats` interroge maintenant `store_order_stats`
  (`$queryRaw`) pour les totaux globaux (CA encaissé = livrées COD, GMV, taux confirmation/
  livraison/retour) + stats filtrées par période (7d/30d/all) + série CA/jour.
  Testé: allTime = 11 commandes, CA 163 000 m, taux livraison 50 %, retour 50 %.
- Re-run `tests/isolation/run.mjs` après M3: 13/13 PASS.
