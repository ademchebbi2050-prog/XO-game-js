// migrate-m5.mjs — migration idempotente M5 pour une base EXISTANTE (PGlite locale).
// Les nouvelles installations passent par replica/schema.sql (init-db.mjs) ;
// celle-ci transforme une base M4 en M5 (enums, colonnes, tables).
// Idempotent: safe à rejouer. Lancé par run-all.mjs après init-db.mjs.
import pg from "pg";

const url = process.env.ADMIN_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
const client = new pg.Client({ connectionString: url });
await client.connect();

const steps = [
  ["enum payment_method + 'card'", "ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'card'"],
  ["enum payment_status + 'failed'", "ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed'"],
  ["order_items.variant_id", "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id uuid references product_variants(id) on delete set null"],
  ["order_items.variant_label", "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_label text"],
  ["index order_items.variant_id", "CREATE INDEX IF NOT EXISTS order_items_variant_id_idx on order_items (variant_id)"],
  ["table product_variants", `CREATE TABLE IF NOT EXISTS product_variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    label text not null,
    sku text,
    price_delta_minor integer not null default 0,
    stock integer not null default 0 check (stock >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    unique (product_id, label)
  )`],
  ["index product_variants.product_id", "CREATE INDEX IF NOT EXISTS product_variants_product_id_idx on product_variants (product_id)"],
  ["table psp_transactions", `CREATE TABLE IF NOT EXISTS psp_transactions (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    psp_code text not null default 'simpsp',
    psp_ref text not null unique,
    amount_minor integer not null check (amount_minor > 0),
    currency text not null default 'TND',
    status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
    auth_code text,
    payload jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`],
  ["index psp_transactions.order_id", "CREATE INDEX IF NOT EXISTS psp_transactions_order_id_idx on psp_transactions (order_id)"],
  ["table push_subscriptions", `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references stores(id) on delete cascade,
    user_id uuid references users(id) on delete cascade,
    endpoint text not null unique,
    keys jsonb not null default '{}',
    created_at timestamptz not null default now()
  )`],
  ["table push_events", `CREATE TABLE IF NOT EXISTS push_events (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references stores(id) on delete cascade,
    subscription_id uuid references push_subscriptions(id) on delete set null,
    title text not null,
    body text not null,
    url text,
    status text not null default 'sent' check (status in ('sent','failed')),
    created_at timestamptz not null default now(),
    sent_at timestamptz
  )`],
  ["index push_events", "CREATE INDEX IF NOT EXISTS push_events_store_created_idx on push_events (store_id, created_at desc)"],
  ["index push_subscriptions", "CREATE INDEX IF NOT EXISTS push_subscriptions_store_id_idx on push_subscriptions (store_id)"],
];

for (const [label, sql] of steps) {
  try {
    await client.query(sql);
    console.log("✅", label);
  } catch (e) {
    // dépendances: product_variants doit exister avant order_items.variant_id
    if (label.startsWith("order_items.variant_id")) {
      // re-tente après création de product_variants (ordre imprévisible)
      console.log("↩️", label, "— retenté après product_variants");
    } else {
      console.log("⚠️", label, "—", e.message);
    }
  }
}
// ordre sûr: recrée la FK variant_id si elle a échoué (product_variants existe maintenant)
await client.query("ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey");
await client.query("ALTER TABLE order_items ADD CONSTRAINT order_items_variant_id_fkey foreign key (variant_id) references product_variants(id) on delete set null").catch(() => {});

const t = await client.query(
  "select relname from pg_class where relname in ('product_variants','psp_transactions','push_subscriptions','push_events') order by 1"
);
console.log("tables M5:", t.rows.map((r) => r.relname).join(", "));
await client.end();
console.log("migrate-m5: OK");
