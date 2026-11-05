-- RLS — défense en profondeur (M4). Appliqué par clone/scripts/enable-rls.mjs.
-- Idempotent. FORCE RLS: même le propriétaire est filtré.
drop policy if exists tenant_isolation on stores;
create policy tenant_isolation on stores
  using (owner_id = nullif(current_setting('app.current_user_id', true), '')::uuid
         or status = 'published');
alter table stores enable row level security;
alter table stores force row level security;

drop policy if exists tenant_isolation on products;
create policy tenant_isolation on products
  using (store_id = nullif(current_setting('app.store_id', true), '')::uuid);
alter table products enable row level security;
alter table products force row level security;

drop policy if exists tenant_isolation on categories;
create policy tenant_isolation on categories
  using (store_id = nullif(current_setting('app.store_id', true), '')::uuid);
alter table categories enable row level security;
alter table categories force row level security;

drop policy if exists tenant_isolation on orders;
create policy tenant_isolation on orders
  using (store_id = nullif(current_setting('app.store_id', true), '')::uuid);
alter table orders enable row level security;
alter table orders force row level security;

drop policy if exists tenant_isolation on delivery_rates;
create policy tenant_isolation on delivery_rates
  using (store_id = nullif(current_setting('app.store_id', true), '')::uuid);
alter table delivery_rates enable row level security;
alter table delivery_rates force row level security;

drop policy if exists tenant_isolation on order_items;
create policy tenant_isolation on order_items
  using (exists (select 1 from orders o
                 where o.id = order_items.order_id
                   and o.store_id = nullif(current_setting('app.store_id', true), '')::uuid));
alter table order_items enable row level security;
alter table order_items force row level security;

drop policy if exists tenant_isolation on order_status_history;
create policy tenant_isolation on order_status_history
  using (exists (select 1 from orders o
                 where o.id = order_status_history.order_id
                   and o.store_id = nullif(current_setting('app.store_id', true), '')::uuid));
alter table order_status_history enable row level security;
alter table order_status_history force row level security;

drop policy if exists tenant_isolation on order_call_attempts;
create policy tenant_isolation on order_call_attempts
  using (exists (select 1 from orders o
                 where o.id = order_call_attempts.order_id
                   and o.store_id = nullif(current_setting('app.store_id', true), '')::uuid));
alter table order_call_attempts enable row level security;
alter table order_call_attempts force row level security;

-- ----------------------------------------------------------------------------
-- M5 — RLS sur les nouvelles tables (mêmes règles fail-closed)
-- ----------------------------------------------------------------------------
drop policy if exists tenant_isolation on product_variants;
create policy tenant_isolation on product_variants
  using (exists (select 1 from products p
                 where p.id = product_variants.product_id
                   and p.store_id = nullif(current_setting('app.store_id', true), '')::uuid));
alter table product_variants enable row level security;
alter table product_variants force row level security;

drop policy if exists tenant_isolation on psp_transactions;
create policy tenant_isolation on psp_transactions
  using (exists (select 1 from orders o
                 where o.id = psp_transactions.order_id
                   and o.store_id = nullif(current_setting('app.store_id', true), '')::uuid));
alter table psp_transactions enable row level security;
alter table psp_transactions force row level security;

drop policy if exists tenant_isolation on push_subscriptions;
create policy tenant_isolation on push_subscriptions
  using (store_id = nullif(current_setting('app.store_id', true), '')::uuid);
alter table push_subscriptions enable row level security;
alter table push_subscriptions force row level security;

drop policy if exists tenant_isolation on push_events;
create policy tenant_isolation on push_events
  using (store_id = nullif(current_setting('app.store_id', true), '')::uuid);
alter table push_events enable row level security;
alter table push_events force row level security;
