// Active le RLS (défense en profondeur, M4) en appliquant replica/schema-rls.sql.
// À lancer APRÈS db:setup (FORCE RLS s'applique aussi au propriétaire des tables,
// donc le seed doit tourner avant). Idempotent. Prod: idem sur Neon, puis re-run
// des tests d'isolation (tests/isolation/run.mjs) avec RLS actif.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const url = process.env.ADMIN_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
const sql = readFileSync(join(root, "replica", "schema-rls.sql"), "utf8");

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(sql);

// Rôle applicatif NON superuser: c'est lui qui subit le RLS (FORCE RLS ne suffit
// pas contre un superuser). L'app se connecte avec ce rôle (DATABASE_URL=app).
await client.query(`do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app') then
    create role app login password 'app';
  end if;
end $$;`);
await client.query("grant usage on schema public to app");
await client.query("grant select, insert, update, delete on all tables in schema public to app");
await client.query("grant usage, select on all sequences in schema public to app");
const r = await client.query(
  "select relname, relrowsecurity, relforcerowsecurity from pg_class where relrowsecurity"
);
console.log("RLS actif sur:", r.rows.map((x) => `${x.relname}(force=${x.relforcerowsecurity})`).join(", "));
await client.end();
console.log("enable-rls: OK");
