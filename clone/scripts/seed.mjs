// Seed dev: 1 user, 2 boutiques (tests d'isolation M0/M1), 1 catégorie + 1 produit
// par boutique, 2 transporteurs simulés, tarifs de livraison pour les 24 gouvernorats.
import pg from "pg";
import bcrypt from "bcryptjs";
import { GOVERNORATES, DEFAULT_DELIVERY_FEE_MINOR } from "../src/lib/governorates.ts";

const url = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
const pool = new pg.Pool({ connectionString: url });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const u = await client.query(
    `INSERT INTO users (email, password_hash, name, phone)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ["demo@exemple.tn", passwordHash, "Démo Commerçant", "+21698000000"]
  );
  const userId = u.rows[0].id;

  for (const [code, name, fee] of [
    ["sim-standard", "Livraison standard (simulée)", 0],
    ["sim-express", "Livraison express (simulée)", 5000],
  ]) {
    await client.query(
      "INSERT INTO carriers (code, name, base_fee_minor) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING",
      [code, name, fee]
    );
  }

  for (const slug of ["boutique-a", "boutique-b"]) {
    const s = await client.query(
      `INSERT INTO stores (owner_id, name, slug, status, settings)
       VALUES ($1,$2,$3,'published','{"codEnabled":true}')
       ON CONFLICT (slug) DO NOTHING RETURNING id`,
      [userId, slug === "boutique-a" ? "Boutique Démo A" : "Boutique Démo B", slug]
    );
    let storeId = s.rows[0]?.id;
    if (!storeId) {
      storeId = (await client.query("SELECT id FROM stores WHERE slug=$1", [slug])).rows[0].id;
    }
    const c = await client.query(
      `INSERT INTO categories (store_id, name, slug) VALUES ($1,'Divers','divers')
       ON CONFLICT (store_id, slug) DO NOTHING RETURNING id`,
      [storeId]
    );
    const catId = c.rows[0]?.id ?? (await client.query("SELECT id FROM categories WHERE store_id=$1 AND slug='divers'", [storeId])).rows[0].id;
    await client.query(
      `INSERT INTO products (store_id, category_id, name, description, price_minor, cost_minor, stock, barcode, is_active)
       VALUES ($1,$2,$3,$4,79000,45000,25,'DEMO-001',true)
       ON CONFLICT (store_id, barcode) DO NOTHING`,
      [storeId, catId, `Produit démo ${slug}`, "Produit de démonstration (données seed)."]
    );
    for (const g of GOVERNORATES) {
      await client.query(
        `INSERT INTO delivery_rates (store_id, governorate, fee_minor) VALUES ($1,$2,$3)
         ON CONFLICT (store_id, governorate) DO NOTHING`,
        [storeId, g.slug, g.slug === "tunis" ? 5000 : DEFAULT_DELIVERY_FEE_MINOR]
      );
    }
  }
  await client.query("COMMIT");
  console.log("seed ok: demo@exemple.tn / demo1234, boutiques boutique-a & boutique-b");
} catch (e) {
  await client.query("ROLLBACK");
  console.error(e);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
