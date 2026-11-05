# Rapport final — replica-build du clone Converty (clean-room)

Date : 2026-11-04. Branche : `arena/b7a40c52-xo-game-js`. Dernier commit : voir `git log`.

## Bilan chiffré

- **Écrans** : 19 écrans livrés sur 25 de l'inventaire recon (S01–S25) — storefront complet
  (accueil, catégorie, produit, panier, checkout, confirmation, suivi) + dashboard complet
  (login, inscription, onboarding, tableau de bord, liste/détail/commande manuelle, produits,
  livraison, paramètres). Les 6 écrans restants sont des variantes marketing (galerie de thèmes,
  landing IA, etc.) hors périmètre produit M0–M4.
- **Matrice features.csv** : 55 features — **23 yes / 4 partial / 28 no**.
  Sur les **27 « must »** : 18 yes, 4 partial, 5 non couvertes (thèmes no-code, carte bancaire
  PSP, variantes/bundles, notifications push, modèle de pricing/commission) — toutes listées
  dans le backlog M5 de l'architecture.
- **Jalons** : M0 (socle + isolation) ✅, M1 (tranche COD bout-en-bout) ✅, M2 (catalogue & gestion) ✅,
  M3 (livraison simulée & stats via la vue SQL) ✅, M4 (RLS + multi-boutique + i18n/RTL) ✅.
  M5 = backlog hors périmètre (vrai transporteur, PSP, promos, IA, mobile, Redis).

## Qualité / preuves

- `tsc --noEmit` clean, `next build` OK à chaque commit.
- `node tests/isolation/run.mjs` : **20/20 PASS** — 13 tests d'isolation multi-tenant en HTTP
  (commande/produit de A invisibles depuis B, 404/401 négatifs), 4 preuves RLS en SQL brut
  (fail-closed sans GUC), 2 tests RTL (FR ltr / AR rtl), rejoué plusieurs fois, stable.
- Smoke test COD complet documenté dans `replica/clone-screens/smoke-test.txt`
  (commande → idempotence → stock → rate limit → statuts → expédition simulée → livraison/paiement
  → retour/restock → suivi public masqué → blocage téléphone).
- Design : tokens uniquement (0 hex/px en dur dans les composants), contraste AA 36/36 OK,
  cibles 44px, Lucide, FR/AR avec `dir="rtl"` testé, propriétés logiques CSS.
- Clean-room : aucun code/asset/copy de l'original ; copie 100 % rédigée ici.

## Déviations majeures (documentées dans build-log.md)

1. PGlite (Postgres WASM) en local au lieu de Neon — sandbox sans accès à Neon ; prod = Neon,
   même schéma, même code (adaptateur pg).
2. Prisma en client WASM (`PRISMA_CLIENT_ENGINE_TYPE=client` dans `.env`), aucun binaire Rust.
3. RLS : policies + FORCE activés (preuve via `SET ROLE app`) ; en local PGlite (superuser)
   le RLS est contourné — l'isolation y est appliquée au niveau app (store_id) et prouvée par tests.
4. i18n maison (cookie `locale` + middleware) au lieu de next-intl ; FR/AR RTL jour 1.
5. Transporteurs simulés (`CarrierAdapter`), étiquette d'expédition imprimable générée localement.
6. Images : stockage disque local + traitement sharp (resize 1600, WebP q80, EXIF supprimé) ;
   prod = Cloudflare R2 en ne changeant que `lib/storage.ts`.

## Pour lancer (voir clone/README.md)

Node ≥ 22.18, `Copy-Item .env.example .env`, `npm install`, hosts (`app.localhost`,
`boutique-a/b.localhost`), `npm run db:up`, `npm run db:setup`, `node scripts/enable-rls.mjs`,
`npm run build`, `npx next start -p 3000 -H 0.0.0.0`.
URLs : http://app.localhost:3000/app/login (demo@exemple.tn / demo1234),
http://boutique-a.localhost:3000/ et http://boutique-b.localhost:3000/.

## Suite proposée

`/replica-test` (plan de test F01–F06 + e2e Playwright) puis backlog M5 si souhaité :
PSP en ligne, codes promo, variantes produit, thèmes no-code, notifications push.


---

## M5 — Backlog (livré 2026-11-05)

| Fonctionnalité | Implémentation | Preuve |
|---|---|---|
| **Paiement carte PSP** | SimPSP simulé: `payment_method 'card'`, table `psp_transactions`, hosted-checkout `/pay/<ref>` (Payer/Refuser), webhook `/api/webhooks/psp` signé HMAC (idempotent via `payload`), remboursement `/api/orders/[id]/refund`. En prod: remplacer par Flouci/Paymee/CIB (même contrat webhook). | e2e F07 (7 contrôles) |
| **Variantes produits** | Table `product_variants` (label, sku, `price_delta_minor`, stock propre), sélecteur sur la fiche produit, prix = base + delta, stock décrémenté sur la variante, snapshot `variant_id`/`variant_label` en commande, remise en stock variante à l'annulation/retour, éditeur de variantes (upsert/suppression) dans le dashboard. | e2e F08 (6 contrôles) |
| **Thèmes no-code** | 4 presets (terre/nuit/pastel/olive) + couleurs libres (accent/fond/texte) dans Réglages, stockés dans `stores.settings.theme`, injectés en variables CSS sur `:root` par sous-domaine (SSR) — Tailwind `@theme inline` suit. Aperçu en direct dans le dashboard. | e2e F09 (4 contrôles) |
| **Notifications push** | Abonnements (`push_subscriptions`, endpoint `sim://…` en local, Web Push VAPID en prod) + outbox `push_events`; émission à chaque changement de statut de commande (dans la transaction), page `/app/notifications`. | e2e F10 (3 contrôles) |
| **Commission / pricing** | `stores.settings.commissionBps` (seed 500 = 5 %), stats dashboard: `commissionMinor = floor(CA livré × bps / 10000)`, `netMinor`; cartes Commission/Net au dashboard; champ éditable dans Réglages. | e2e F11 (2 contrôles) |

**Contraintes M5**: client Prisma non regénérable hors-ligne (schema-engine bloqué) → enums patchés dans le client généré (`scripts/patch-prisma-m5.mjs`, postinstall) et nouvelles tables accédées en SQL brut; migration idempotente `scripts/migrate-m5.mjs` (hookée dans `run-all.mjs`); RLS FORCE sur les 4 nouvelles tables (`product_variants`, `psp_transactions`, `push_subscriptions`, `push_events`).

**Tests**: e2e `tests/e2e/run.mjs` F01–F11 = **57/57 PASS**; isolation M4 **20/20 PASS** (RLS inclut désormais 12 tables); `tsc` clean; `next build` OK. 2 bugs trouvés et corrigés par la suite: stock variante (count vs lignes) et rate-limit des re-runs de test (IP/téléphone aléatoires).

**features.csv**: 27 yes / 5 partial / 23 no (était 23/4/28 avant M5).
