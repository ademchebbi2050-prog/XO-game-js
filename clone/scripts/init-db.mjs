// Applique replica/schema.sql (source de vérité) sur la base PGlite locale,
// si elle n'est pas encore initialisée. prisma db push est inutilisable ici
// (le binaire schema-engine n'est pas téléchargeable hors-ligne).
import pg from "pg";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
const pool = new pg.Pool({ connectionString: url });
const client = await pool.connect();
try {
  const { rows } = await client.query(
    "SELECT to_regclass('public.users') AS t"
  );
  if (rows[0].t) {
    console.log("schema déjà initialisé, rien à faire");
  } else {
    let sql = readFileSync(new URL("../../replica/schema.sql", import.meta.url), "utf8");
    // pgcrypto peut ne pas être dispo: gen_random_uuid() est dans le cœur de Postgres 13+
    sql = sql.replace(/create extension if not exists pgcrypto;.*\n/i, "");
    await client.query(sql);
    console.log("schema.sql appliqué (tables, enums, contraintes, séquence, vue)");
  }
} finally {
  client.release();
  await pool.end();
}
