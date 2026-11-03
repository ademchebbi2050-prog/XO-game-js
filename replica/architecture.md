# Architecture: clone clean-room de Converty (converty.shop) — périmètre COD web

Source: `replica/recon.md` + `replica/features.csv` (recon du 2026-11-03).
Périmètre validé par l'utilisateur: plateforme web uniquement (dashboard commerçant + boutique publique), boucle COD complète, Tunisie (TND, +216, gouvernorats), FR/AR avec RTL dès le départ, multi-boutique par sous-domaine avec isolation, confirmation téléphonique manuelle (boutons appel/WhatsApp), transporteurs simulés derrière une interface abstraite. Hors périmètre: IA, pixels marketing, app mobile, vrais transporteurs, éditeur visuel de thèmes, analytics avancés.
Révision 2 (2026-11-03): hôtes séparés app/ vs boutiques, cookie de session scopé à l'hôte dashboard, tests d'isolation en M0/M1 + évaluation RLS, statuts de commande affinés (appels, unreachable, remise en stock), rate limiting + numéros bloqués sur la route publique de commande, stockage d'images et régions précisés.
Date: 2026-11-03

## 1. Stack et justification

| couche | choix | pourquoi |
| --- | --- | --- |
| web | **Next.js 15 (App Router) + TypeScript** | un seul repo, un seul langage; Route Handlers pour l'API + Server Components pour les pages; déploiement en un clic |
| base de données | **PostgreSQL sur Neon**, projet en région **Europe (eu-central-1, Francfort)** | Postgres = relations multi-tenant solides, contraintes, index; Neon serverless gratuit; données hébergées en UE |
| ORM | **Prisma** | schéma déclaratif + migrations; `replica/schema.sql` = migration 0 de référence; typage fort côté TS |
| auth | **Auth.js v5 (credentials email+mot de passe, adapter Prisma)** | sessions DB; **cookie de session host-only sur `app.<domaine>`** (voir §2), jamais sur le domaine parent |
| paiements | **aucun pour le MVP** (COD uniquement) | PSP licencié (Flouci/Paymee/e-Dinar) plus tard, derrière la même interface abstraite que les transporteurs |
| fichiers | **MVP: disque local `public/uploads` derrière `lib/storage.ts`; prod: Cloudflare R2 (compatible S3, région UE)** | interface `upload(file) -> url`; limites et validation en §6 |
| styling | **Tailwind + tokens** (depuis `/replica-design`) | un endroit pour couleurs/typo/espacement, nécessaire au RTL |
| i18n | **next-intl**, locales `fr` et `ar`, `dir="rtl"` pour l'arabe | requis dès le départ |
| rate limiting | **MVP: fenêtre fixe en Postgres (`order_rate_limits`), clés `ip:` et `phone:`**; plus tard Upstash Redis | pas de dépendance externe au démarrage; le schéma reste identique derrière `lib/rate-limit.ts` |
| jobs | **aucun pour le MVP** | confirmation manuelle; cron Vercel plus tard |
| hébergement | **Vercel, région fonctions `fra1` (Francfort)** via `vercel.json` `"regions": ["fra1"]` + Neon eu-central-1 | déploiement git-push; données et calcul en Europe |

Justification en une ligne: **une stack TypeScript full-stack mono-repo (Next.js + Prisma + Postgres/Neon + Auth.js) déployable en un push**, parce que le clone n'a pas besoin de l'architecture de l'original, seulement de ses fonctionnalités — et qu'à zéro utilisateur, chaque brique est managée, gratuite et documentée.

## 2. Hôtes, cookies et sous-domaines

| hôte | rôle |
| --- | --- |
| `app.<domaine>` | **dashboard commerçant** (login, commandes, produits, réglages). Seul hôte à poser un cookie de session. |
| `<slug>.<domaine>` | **boutique publique** d'une store (ex. `paris.<domaine>`). Aucun cookie de session ici. |
| `www.<domaine>` / racine | landing marketing ou redirection vers `app.<domaine>` |

- **Cookie de session**: Auth.js v5, cookie `sessionToken` **host-only** — on ne pose **pas** d'attribut `Domain` (ou explicitement `Domain=app.<domaine>`), donc jamais transmissible à `<slug>.<domaine>` ni au domaine parent. `Secure`, `HttpOnly`, `SameSite=Lax`. La boutique publique est 100 % sans session: elle ne lit que les routes `/api/public/*` scoping `store_id` depuis le slug de l'hôte.
- **Middleware** (`src/middleware.ts`): parse le header `Host` (strip du port), labels réservés (`app`, `www`, `api`, `blog`, `static`...) interdits comme slug de boutique (liste réservée en `lib/tenant.ts`); `app.*` → groupe de routes `(dashboard)` + vérification session; autre premier label → lookup `stores.slug` en DB → réécriture vers `(storefront)` avec `storeId` en header interne; slug inconnu → 404. Jamais de confiance aveugle au header Host côté dashboard (l'autorisation vient de la session, pas de l'hôte).
- **Local (dev)**: `*.localhost` résout vers 127.0.0.1 (RFC 6761, supporté par Chrome/Firefox/Safari) → `app.localhost:3000` et `boutique-a.localhost:3000`, `boutique-b.localhost:3000` pour les tests d'isolation. Aucun service externe requis.
- **Production**: DNS wildcard `*.<domaine>` → Vercel + certificat TLS wildcard géré par Vercel; domaines déclarés dans le projet Vercel: `app.<domaine>` et `*.<domaine>`. Neon: un seul projet, région eu-central-1.

## 3. Schéma de base de données

SQL complet dans `replica/schema.sql` (miroir de `prisma/schema.prisma`). **15 tables + 1 vue**.

```
users ──< stores ──< products ──< order_items >── orders ──< order_status_history
   │          │            (order_items.product_id set null si produit supprimé)  └──< order_call_attempts
   │          └──< categories                                                   orders >── carriers (seed simulés)
   │          └──< delivery_rates
   └──< accounts, sessions, verification_tokens (Auth.js)
   blocked_phone_numbers (standalone)   order_rate_limits (standalone, clés ip:/phone:)
```

- `users(id, email unique, password_hash, name, phone, created_at, updated_at)`
- `stores(id, owner_id -> users, name, slug unique (sous-domaine), currency='TND', default_locale='fr'|'ar', status draft|published, settings jsonb, created_at, updated_at)` — **toute table métier porte `store_id`** (directement ou via `orders`).
- `categories(id, store_id, name, slug, unique(store_id, slug))`
- `products(id, store_id, category_id nullable, name, description, price_minor int (millimes TND), cost_minor int nullable, stock int check >= 0, barcode unique par store, image_url, is_active, ...)`
- `orders(id, store_id, number unique(store_id, number) ex. CMD-000123, customer_name, customer_phone check '^\+216[0-9]{8}$', governorate, address, subtotal_minor, delivery_fee_minor, discount_minor, total_minor, constraint total = subtotal + fee - discount, payment_method 'cod', payment_status, status order_status default 'new', source web|manual, carrier_id nullable, tracking_number, idempotency_key unique nullable, **restocked boolean default false**, created_at, updated_at)`
- `order_items(id, order_id cascade, product_id set null, name_snapshot, price_minor, qty > 0)`
- `order_status_history(id, order_id, status, note, changed_by_id, created_at)` — timeline S08/S24
- `order_call_attempts(id, order_id, outcome answered|no_answer|busy|whatsapp, at, note, user_id)` — suivi des appels de confirmation
- `carriers(id, code unique, name, base_fee_minor, is_active)` — seed: sim-standard, sim-express
- `delivery_rates(id, store_id, governorate, fee_minor, unique(store_id, governorate))`
- `blocked_phone_numbers(phone text primary key check '+216...', reason, blocked_by -> users, created_at)`
- `order_rate_limits(key text, window_start timestamptz, count int, primary key(key, window_start))` — fenêtre fixe (ex. 10 min), clés `ip:<ip>` / `phone:<+216...>`
- Tables Auth.js: `accounts`, `sessions`, `verification_tokens`

### Statuts de commande et transitions (révision 2)

Enum `order_status`: `new`, `to_confirm`, `unreachable`, `confirmed`, `shipped`, `delivered`, `returned`, `cancelled`.

- `new` = commande reçue, **pas encore prise en charge**; `to_confirm` = **en cours d'appel** (le commerçant l'a ouverte / assignée). (Clarification: la distinction reste, elle reflète qui a la main; pas de fusion, la timeline est plus lisible.)
- `unreachable` = **3 appels sans réponse** (`order_call_attempts.outcome='no_answer'`), posée automatiquement par la route `POST /api/orders/[id]/calls`; on peut en sortir (retry → retour à `to_confirm`).
- Transitions valides (validées dans `lib/orders.ts`, jamais en direct): `new → to_confirm → confirmed → shipped → delivered | returned`; `new|to_confirm → unreachable → to_confirm`; `new|to_confirm|unreachable|confirmed → cancelled` (pas après `shipped`).
- **Remise en stock**: transition vers `cancelled` ou `returned` → dans la **même transaction**, pour chaque `order_item` avec `product_id` non null: `UPDATE products SET stock = stock + qty WHERE id = ...`; garde-fou `orders.restocked` (passé à true) pour ne jamais remettre deux fois. `delivered` → `payment_status = 'paid'` (COD encaissé). Tout changement de statut écrit une ligne `order_status_history`.

### Règles d'accès et RLS (évaluation, révision 2)

- **Primaire (M0/M1)**: couche données — `lib/tenant.ts` (`getStoreFromHost()`, `requireUserStore()`); chaque requête Prisma filtre par `store_id`. **Tests d'isolation en M0/M1**: deux boutiques seedées (A, B), tests négatifs automatisés — session du propriétaire A + slug B → 403/404; routes publiques de B inaccessibles depuis le contexte de A; aucune requête ne fuite (requêtes loguées en test, vérification du `store_id` présent dans chaque clause WHERE).
- **Défense en profondeur — RLS Postgres: évalué, recommandé, activé en M4.** Faisable sur Neon: policies `using (store_id = current_setting('app.store_id', true)::uuid)` sur toutes les tables tenantes (fail-closed: si le GUC n'est pas posé, `current_setting(..., true)` renvoie NULL → aucune ligne). L'app pose le GUC via `set_config('app.store_id', ..., true)` **au début de chaque transaction interactive Prisma** (`prisma.$transaction(async tx => ...)`). Les tables sans `store_id` (`order_items`, `order_status_history`, `order_call_attempts`) ont une policy via `exists (select 1 from orders o where o.id = order_id and o.store_id = ...)`. Le DDL des policies est fourni dans `schema.sql` avec les `alter table ... enable row level security` **commentés** (à activer en M4, après re-run des tests d'isolation avec RLS actif). Attention: la clé service Neon **contourne RLS** — elle ne doit jamais être exposée côté client (jamais de `NEXT_PUBLIC_` sur la DB).

## 4. API (Route Handlers Next.js, ~32 routes)

| méthode | path | fait | qui | entrée | sortie | flow |
| --- | --- | --- | --- | --- | --- | --- |
| POST | /api/auth/register | crée le compte | public | email, password, name, phone | user | F01 |
| [...nextauth] | /api/auth/* | login/logout/session — **cookie host-only sur app.<domaine>** | public | credentials | session | F01 |
| GET | /api/stores | liste mes boutiques | session | — | stores[] | F01 |
| POST | /api/stores | crée une boutique (slug réservé vérifié) | session | name, slug, locale | store | F01 |
| PATCH | /api/stores/[id] | réglages (nom, statut publié, fee par défaut) | owner | champs partiels | store | F01 |
| GET/POST | /api/products | liste (filtres/search) / crée (image via lib/storage) | owner | filtres / produit | products | F01/F05 |
| GET/PATCH/DELETE | /api/products/[id] | détail / maj (stock, prix, image) / supprime | owner | — | product | F05 |
| GET/POST | /api/categories | liste / crée | owner | — | categories | F01 |
| PATCH/DELETE | /api/categories/[id] | maj / supprime | owner | — | category | F01 |
| GET | /api/orders?status=&q=&page= | liste (filtres statut, recherche tel/n°) | owner | query | orders + total | F03 |
| POST | /api/orders | commande manuelle | owner | client, items, gouvernorat | order (new) | F03 |
| GET | /api/orders/[id] | détail + historique statuts + appels | owner | — | order + history + calls | F03 |
| PATCH | /api/orders/[id] | édite (client, adresse, articles, remise) | owner | champs partiels | order | F03 |
| POST | /api/orders/[id]/status | transition de statut (règles de §3, remise en stock sur cancelled/returned dans la même transaction) | owner | {status, note} | order + history | F03 |
| POST | /api/orders/[id]/calls | log un appel (bouton appel/WhatsApp); pose `unreachable` après 3 no_answer | owner | {outcome, note} | call + order | F03 |
| POST | /api/orders/[id]/ship | choisit un transporteur via l'adapter (simulé), pose tracking, passe à shipped | owner | {carrierId} | order + tracking | F03 |
| GET | /api/dashboard/stats?range=7d\|30d\|all | nb commandes, taux confirmation, taux livraison/retour, CA (view `store_order_stats`) | owner | query | stats json | F06 |
| GET | /api/carriers | transporteurs (simulés) | owner | — | carriers[] | F03 |
| GET/POST | /api/delivery-rates | lit / règle les tarifs par gouvernorat | owner | {governorate, fee} | rates | F02/F03 |
| GET/POST/DELETE | /api/blocked-phones | liste / bloque / débloque un numéro +216 | owner | {phone, reason} | liste | F02 |
| GET | /api/public/stores/[slug] | infos boutique publique + catégories | public | — | store public + categories | F02 |
| GET | /api/public/stores/[slug]/products?category=&q= | catalogue | public | query | products[] | F02 |
| GET | /api/public/products/[id] | détail (stock restant) | public | — | product | F02 |
| GET | /api/public/stores/[slug]/delivery-fee?governorate= | tarif du gouvernorat | public | query | fee_minor | F02 |
| POST | /api/public/stores/[slug]/orders | **commande COD**; avant création: rate limit `ip:` + `phone:` (fenêtre fixe Postgres, limites ex. 5/10 min par IP, 3/h par tel → 429), numéro bloqué → 403, téléphone +216 validé, idempotency-key, transaction stock conditionnel, status new + history | public | cart, client, gouvernorat, adresse + header Idempotency-Key | order {number} | F02 |
| GET | /api/public/orders/[number]?phone= | suivi (n° + téléphone) | public | query | statut + timeline (données masquées) | F02 |

Webhooks entrants: aucun (MVP). Webhooks sortants: aucun. Jobs: aucun (MVP).
Toutes les routes "owner" passent par `requireUserStore()`; les routes publiques par `getStoreFromHost()` + filtre `storeId`. Jamais d'endpoint de l'original.

## 5. Arborescence du projet

```
clone/
├── prisma/{schema.prisma, migrations/}     # migration 0 = replica/schema.sql
├── replica/                                # recon, architecture, schema.sql, features.csv
├── vercel.json                             # "regions": ["fra1"]
├── src/
│   ├── app/
│   │   ├── (storefront)/                   # rendu sur <slug>.<domaine> (S19–S24)
│   │   │   ├── layout.tsx, page.tsx, category/[slug], product/[slug], cart, checkout, order/[number]
│   │   ├── (dashboard)/                    # rendu sur app.<domaine> (S01–S18)
│   │   │   ├── layout.tsx (session requise), login, signup, onboarding,
│   │   │   │   dashboard, products..., orders..., delivery, settings (incl. numéros bloqués)
│   │   └── api/                            # ~32 routes (tableau §4)
│   ├── components/{ui, storefront, dashboard}
│   ├── lib/
│   │   ├── db.ts  auth.ts  tenant.ts       # tenant = getStoreFromHost + requireUserStore + slugs réservés
│   │   ├── carriers/{carrier.ts (interface), simulated.ts}
│   │   ├── storage.ts                      # interface upload(); impl disque local (MVP) → R2 (prod)
│   │   ├── rate-limit.ts                   # fenêtre fixe Postgres (MVP) → Redis plus tard; clés ip:/phone:
│   │   ├── governorates.ts  phone.ts  money.ts
│   │   ├── orders.ts                       # transitions valides, remise en stock (restocked), numérotation
│   │   └── i18n.ts
│   ├── messages/{fr.json, ar.json}
│   └── middleware.ts                       # host → (dashboard|storefront), locale, protection
├── public/uploads/                         # images (MVP)
└── tests/isolation/                        # M0/M1: 2 boutiques, tests négatifs de fuite (puis re-run avec RLS en M4)
```

## 6. Stockage d'images (précisé, révision 2)

- **Provider**: MVP = disque local `public/uploads` derrière `lib/storage.ts` (`upload(file): Promise<url>`); **prod = Cloudflare R2** (API S3, bucket en région UE `eu-central-1` / `auto` avec contrainte de localisation), branché en ne changeant que l'implémentation de `lib/storage.ts`.
- **Limites**: max **5 Mo** par image, types autorisés **jpeg / png / webp / avif** (vérifiés par les magic bytes côté serveur, pas seulement par l'extension/MIME client), max **8 images par produit**.
- **Traitement serveur**: lecture des métadonnées (sharp), **redimensionnement max 1600 px** côté long, recompression (webp qualité ~80), **EXIF supprimé** (métadonnées GPS = données perso), nom de fichier aléatoire (jamais le nom client).
- **Suppression**: supprimer un produit supprime ses images via `lib/storage.ts` (`remove(url)`).

## 7. Plan de construction en jalons (révision 2: isolation déplacée en M0/M1)

| jalon | contenu | résultat visible |
| --- | --- | --- |
| **M0 — socle + isolation** | Next.js+TS+Prisma+Neon (région eu-central-1), Auth.js (**cookie host-only sur `app.<domaine>`**), next-intl fr/ar + RTL, middleware hôtes (`app.` vs `<slug>.`, slugs réservés), migration 0, `vercel.json` fra1, **2 boutiques seedées (A, B) + suite de tests d'isolation négatifs** (session A + slug B → 403/404; aucune requête sans `store_id`; test host `app.localhost` / `a.localhost` / `b.localhost`) | login OK, tests d'isolation verts, `a.localhost:3000` affiche la boutique A |
| **M1 — tranche verticale** | onboarding (créer boutique + slug), CRUD produit (image via storage, limites §6), accueil/produit/panier/checkout COD, création commande (rate limit ip+tel, liste bloquée, idempotency-key, transaction stock), liste commandes, statuts manuels + appels (`order_call_attempts`, `unreachable`), page stats minimale. **Re-vérification de l'isolation sur la tranche verticale** (commande créée sur A invisible depuis le dashboard de B) | **boucle COD bout-en-bout**: un client commande sur A, le commerçant voit la commande, la confirme, l'expédie (simulé), la marque livrée, le CA s'affiche |
| **M2 — catalogue & gestion** | catégories, fiche produit complète, stock faible/rupture, commande manuelle + édition, timeline statuts/appels, boutons `tel:` / `wa.me`, remise en stock automatique sur annulation/retour (testée: stock avant/après) | workflow F03 complet côté commerçant |
| **M3 — livraison simulée & stats** | tarifs par gouvernorat (checkout calcule les frais), choix transporteur à l'expédition via `CarrierAdapter` simulé (tracking généré), suivi public, stats complètes (taux confirmation, livraison, retour, CA via la vue) | F02+F03+F06 terminés |
| **M4 — i18n/RTL complet, multi-boutique, RLS** | toutes les chaînes fr/ar + test RTL, validation +216, multi-boutique par user + switch, **activation du RLS Postgres (policies de `schema.sql`) + re-run des tests d'isolation avec RLS actif**, préparation domaine prod (wildcard DNS + TLS) | prêt pour `*.domaine` en prod |
| **M5 — backlog (hors périmètre)** | vrai transporteur via l'adapter, PSP en ligne, codes promo, IA, temps réel, app mobile, Redis pour le rate limiting | — |

## 8. Les parties qui mordent

- **Multi-tenant**: résolution d'hôte stricte + `storeId` obligatoire dans chaque requête (primaire, testé dès M0/M1); **RLS en défense en profondeur activé en M4** (policies fail-closed sur `app.store_id`; clé service jamais côté client). Wildcard DNS/TLS à prévoir en prod.
- **Cookies**: session host-only sur `app.<domaine>` (`Secure`, `HttpOnly`, `SameSite=Lax`, pas d'attribut `Domain` parent) — la boutique publique n'a aucune session; CSRF couvert par SameSite=Lax + routes mutantes en POST.
- **Rate limiting route publique**: fenêtre fixe Postgres (`order_rate_limits`, clés `ip:`/`phone:`), limites ex. 5 commandes/10 min par IP et 3/h par téléphone → 429; numéros bloqués (`blocked_phone_numbers`) → 403 avant toute création. Note: derrière un proxy, l'IP réelle vient de `x-forwarded-for` (Vercel) — ne jamais faire confiance à un header client brut.
- **Race conditions**: double-submit → `idempotency_key unique` + transaction; oversell → `stock >= qty` conditionnel en transaction; remise en stock → transaction + garde `restocked`.
- **Téléphone +216**: normalisé E.164 à l'entrée, check DB `^\+216[0-9]{8}$`.
- **Argent TND**: entiers de millimes, jamais de float; contrainte `total = subtotal + fee - discount`.
- **Fuseau horaire**: `timestamptz` UTC en DB, affichage Africa/Tunis (UTC+1, pas de DST).
- **Images**: magic bytes, 5 Mo max, jpeg/png/webp/avif, resize 1600 px, EXIF supprimé (§6).
- **RTL/i18n**: `dir` dynamique; chiffres, téléphones et numéros de commande en `dir="ltr"`.
- **Slug**: `unique`, regex `[a-z0-9-]`, liste réservée (`app`, `www`, `api`...).
- **RGPD**: `on delete cascade` store → données; suppression de compte = suppression de ses boutiques, export proposé avant.
