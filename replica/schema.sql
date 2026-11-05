-- ============================================================================
-- Clone clean-room de Converty — migration 0 (référence SQL)
-- Le schéma applicatif vit dans prisma/schema.prisma (miroir de ce fichier).
-- Postgres 15+ (Neon, région eu-central-1 / Francfort). Tout en UTC (timestamptz).
-- Argent = entier de millimes TND (unité mineure), jamais de float.
-- Téléphones en E.164 (+216...). Hôtes: app.<domaine> (dashboard, session),
-- <slug>.<domaine> (boutique publique, sans session).
-- ============================================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type order_status as enum (
  'new',          -- reçue, pas encore prise en charge
  'to_confirm',   -- en cours d'appel (confirmation téléphonique manuelle)
  'unreachable',  -- 3 appels sans réponse (voir order_call_attempts); réversible -> to_confirm
  'confirmed',    -- confirmée par téléphone
  'shipped',      -- expédiée (transporteur + tracking)
  'delivered',    -- livrée (terminal; payment_status -> 'paid', COD encaissé)
  'returned',     -- retournée (terminal; remise en stock)
  'cancelled'     -- annulée (terminal; remise en stock)
);

create type call_outcome as enum ('answered', 'no_answer', 'busy', 'whatsapp');
create type payment_method as enum ('cod', 'card');   -- M5: 'card' = PSP simulé (psp_transactions)
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');  -- M5: 'failed' = paiement refusé
create type store_status   as enum ('draft', 'published');
create type order_source   as enum ('web', 'manual');

-- ----------------------------------------------------------------------------
-- Utilisateurs & auth (Auth.js v5 — cookie de session host-only sur app.<domaine>)
-- ----------------------------------------------------------------------------
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  name          text not null,
  phone         text,                          -- E.164, ex. +21698123456
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  type                text not null,
  provider            text not null,
  provider_account_id text not null,
  refresh_token       text,
  access_token        text,
  expires_at          integer,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  unique (provider, provider_account_id)
);

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  user_id       uuid not null references users(id) on delete cascade,
  expires       timestamptz not null
);
create index on sessions (user_id);

create table verification_tokens (
  identifier text not null,
  token      text not null unique,
  expires    timestamptz not null,
  primary key (identifier, token)
);

-- ----------------------------------------------------------------------------
-- Multi-tenant: une boutique = un sous-domaine <slug>.<domaine>.
-- Toute table métier porte store_id (directement ou via orders).
-- Isolation primaire = couche données (lib/tenant.ts, testée en M0/M1).
-- RLS en défense en profondeur: voir la section RLS en bas de ce fichier.
-- ----------------------------------------------------------------------------
create table stores (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references users(id) on delete cascade,
  name           text not null,
  slug           text not null unique            -- sous-domaine; labels réservés interdits côté app
    check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  currency       text not null default 'TND',
  default_locale text not null default 'fr' check (default_locale in ('fr','ar')),
  status         store_status not null default 'draft',
  settings       jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on stores (owner_id);

create table delivery_rates (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  governorate text not null,                    -- slug: tunis, ariana, ben-arous, ... (24)
  fee_minor   integer not null check (fee_minor >= 0),
  created_at  timestamptz not null default now(),
  unique (store_id, governorate)
);

-- Transporteurs SIMULÉS (seed). L'app passe par lib/carriers/CarrierAdapter;
-- remplacer l'implémentation = brancher une vraie API transporteur.
create table carriers (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,
  base_fee_minor integer not null default 0 check (base_fee_minor >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

insert into carriers (code, name, base_fee_minor) values
  ('sim-standard', 'Livraison standard (simulée)', 0),
  ('sim-express',  'Livraison express (simulée)',  5000);

-- ----------------------------------------------------------------------------
-- Catalogue
-- ----------------------------------------------------------------------------
create table categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  name       text not null,
  slug       text not null,
  created_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name        text not null,
  description text not null default '',
  price_minor integer not null check (price_minor >= 0),   -- millimes TND
  cost_minor  integer check (cost_minor is null or cost_minor >= 0),
  stock       integer not null default 0 check (stock >= 0), -- décrémenté à la commande (transaction conditionnelle)
  barcode     text,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (store_id, barcode)
);
create index on products (store_id);
create index on products (store_id, is_active);
create index on products (category_id);

-- ----------------------------------------------------------------------------
-- Variantes de produits (M5) — ex. taille/couleur, avec stock et delta de prix
-- ----------------------------------------------------------------------------
create table product_variants (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references products(id) on delete cascade,
  label              text not null,                       -- ex. "M", "Rouge"
  sku                text,
  price_delta_minor  integer not null default 0,          -- +/- en millimes TND
  stock              integer not null default 0 check (stock >= 0),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (product_id, label)
);
create index on product_variants (product_id);

-- ----------------------------------------------------------------------------
-- Commandes (cœur du clone: boucle COD)
-- ----------------------------------------------------------------------------
create sequence if not exists order_number_seq;  -- numéro lisible: CMD-000123

create table orders (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references stores(id) on delete cascade,
  number             text not null,             -- 'CMD-' || lpad(nextval(order_number_seq)::text, 6, '0')
  customer_name      text not null,
  customer_phone     text not null check (customer_phone ~ '^\+216[0-9]{8}$'),
  governorate        text not null,
  address            text not null,
  subtotal_minor     integer not null check (subtotal_minor >= 0),
  delivery_fee_minor integer not null default 0 check (delivery_fee_minor >= 0),
  discount_minor     integer not null default 0 check (discount_minor >= 0),
  total_minor        integer not null check (total_minor >= 0),
  payment_method     payment_method not null default 'cod',
  payment_status     payment_status not null default 'pending',
  status             order_status not null default 'new',
  source             order_source not null default 'web',
  carrier_id         uuid references carriers(id) on delete set null,
  tracking_number    text,
  idempotency_key    text unique,                -- anti double-submit (checkout)
  restocked          boolean not null default false,  -- garde-fou: remise en stock faite UNE fois (cancelled/returned)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (store_id, number),
  constraint total_ok check (total_minor = subtotal_minor + delivery_fee_minor - discount_minor)
);
create index on orders (store_id, status);
create index on orders (store_id, created_at desc);
create index on orders (customer_phone);
create index on orders (store_id, customer_phone);

-- Transitions valides (appliquées dans lib/orders.ts, dans une transaction):
--   new -> to_confirm -> confirmed -> shipped -> delivered | returned
--   new | to_confirm -> unreachable (3x no_answer) -> to_confirm (retry)
--   new | to_confirm | unreachable | confirmed -> cancelled   (pas après shipped)
--   cancelled | returned  => remise en stock des order_items (si restocked = false)
--   delivered             => payment_status = 'paid'

create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,  -- snapshot conservé si produit supprimé
  variant_id    uuid references product_variants(id) on delete set null,  -- M5: variante choisie (snapshot aussi)
  variant_label text,                                          -- M5: libellé figé (ex. "M")
  name_snapshot text not null,
  price_minor   integer not null check (price_minor >= 0),    -- prix final unité (base + delta variante)
  qty           integer not null check (qty > 0)
);
create index on order_items (order_id);
create index on order_items (product_id);
create index on order_items (variant_id);

create table order_status_history (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  status        order_status not null,
  note          text,
  changed_by_id uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on order_status_history (order_id, created_at);

-- Suivi des appels de confirmation (boutons appel / WhatsApp du dashboard)
create table order_call_attempts (
  id       uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  outcome  call_outcome not null,
  note     text,
  user_id  uuid references users(id) on delete set null,
  at       timestamptz not null default now()
);
create index on order_call_attempts (order_id, at desc);
-- 'unreachable' est posé par l'app quand count(outcome='no_answer') >= 3 sur la commande

-- ----------------------------------------------------------------------------
-- Rate limiting (route publique de commande) & numéros bloqués
-- Fenêtre fixe en Postgres (MVP); lib/rate-limit.ts, clés 'ip:<ip>' / 'phone:<+216...>'
-- Limites ex.: 5 commandes / 10 min par IP, 3 / heure par téléphone -> HTTP 429.
-- ----------------------------------------------------------------------------
create table order_rate_limits (
  key          text not null,                   -- 'ip:203.0.113.7' | 'phone:+21698123456'
  window_start timestamptz not null,             -- début de la fenêtre fixe (ex. 10 min)
  count        integer not null default 0 check (count >= 0),
  primary key (key, window_start)
);

create table blocked_phone_numbers (
  phone      text primary key check (phone ~ '^\+216[0-9]{8}$'),
  reason     text,
  blocked_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- Vérifié par POST /api/public/stores/[slug]/orders AVANT création -> HTTP 403

-- ----------------------------------------------------------------------------
-- M5 — PSP carte bancaire SIMULÉ (SimPSP) : transactions de paiement
-- ----------------------------------------------------------------------------
create table psp_transactions (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  psp_code     text not null default 'simpsp',
  psp_ref      text not null unique,              -- ex. PSP-8F3K2Q (id côté PSP)
  amount_minor integer not null check (amount_minor > 0),
  currency     text not null default 'TND',
  status       text not null default 'pending'    -- pending|paid|failed|refunded
               check (status in ('pending','paid','failed','refunded')),
  auth_code    text,                               -- code d'autorisation renvoyé par le PSP
  payload      jsonb not null default '{}',        -- événements webhook reçus (idempotence)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on psp_transactions (order_id);

-- ----------------------------------------------------------------------------
-- M5 — Notifications push (simulées, sans service worker en local) :
-- abonnements + file d'événements envoyés (outbox consultable au dashboard)
-- ----------------------------------------------------------------------------
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references stores(id) on delete cascade,
  user_id    uuid references users(id) on delete cascade,
  endpoint   text not null unique,                -- en prod: URL push browser; en local: sim://device/<uuid>
  keys       jsonb not null default '{}',         -- p256dh/auth (prod)
  created_at timestamptz not null default now()
);
create table push_events (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  subscription_id uuid references push_subscriptions(id) on delete set null,
  title           text not null,
  body            text not null,
  url             text,
  status          text not null default 'sent' check (status in ('sent','failed')),
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index on push_events (store_id, created_at desc);
create index on push_subscriptions (store_id);

-- ----------------------------------------------------------------------------
-- Vue dashboard (stats M3): taux de confirmation / livraison / retour, CA
-- ----------------------------------------------------------------------------
create view store_order_stats as
select
  o.store_id,
  count(*)                                                                as orders_total,
  count(*) filter (where o.status = 'new')                                as orders_new,
  count(*) filter (where o.status = 'to_confirm')                         as orders_to_confirm,
  count(*) filter (where o.status = 'unreachable')                        as orders_unreachable,
  count(*) filter (where o.status in ('confirmed','shipped','delivered')) as orders_confirmed,
  count(*) filter (where o.status in ('shipped','delivered','returned'))  as orders_shipped,
  count(*) filter (where o.status = 'delivered')                          as orders_delivered,
  count(*) filter (where o.status = 'returned')                           as orders_returned,
  count(*) filter (where o.status = 'cancelled')                          as orders_cancelled,
  coalesce(sum(o.total_minor) filter (where o.status = 'delivered'), 0)   as revenue_minor,
  -- CA encaissé = livrées (COD). 'returned'/'cancelled' = remise en stock, hors CA.
  coalesce(sum(o.total_minor), 0)                                         as gmv_minor
from orders o
group by o.store_id;

-- ============================================================================
-- RLS — DÉFENSE EN PROFONDEUR (activé en M4)
-- ----------------------------------------------------------------------------
-- Les ordres RLS (policies + ENABLE/FORCE ROW LEVEL SECURITY) sont dans
-- replica/schema-rls.sql, appliqués UNIQUEMENT par clone/scripts/enable-rls.mjs
-- (après le seed : FORCE RLS s'applique aussi au propriétaire, le seed doit
-- donc tourner avant). L'app pose les GUC 'app.current_user_id' et
-- 'app.store_id' en début de requête (src/lib/db.ts setAppContext) ;
-- current_setting(..., true) renvoie NULL si non posé => fail-closed.
-- stores: lisible publiquement si published (storefront par slug), sinon owner.
-- blocked_phone_numbers / order_rate_limits: tables anti-abus globales, hors RLS.
-- ATTENTION prod (Neon): la clé service contourne RLS — jamais côté client.
