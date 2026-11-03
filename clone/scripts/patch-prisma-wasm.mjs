// Post-génération : branche le compilateur de requêtes WASM embarqué de
// @prisma/client/runtime dans le client généré (provider prisma-client,
// runtime node). Sans ce patch, config.compilerWasm reste `undefined` et le
// client exige le binaire Rust libquery_engine (indisponible hors-ligne).
// Le patch est réappliqué à chaque `prisma generate` via le script postinstall.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const genDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "generated", "prisma");

const REPLACEMENT = `config.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_bg.postgresql.js"),
  getQueryCompilerWasmModule: async () => {
    const mod = await import("@prisma/client/runtime/query_compiler_bg.postgresql.wasm-base64.mjs");
    return new WebAssembly.Module(Buffer.from(mod.wasm, "base64"));
  },
}`;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|js|mjs|cjs)$/.test(name)) yield p;
  }
}

let patched = 0;
for (const file of walk(genDir)) {
  const src = readFileSync(file, "utf8");
  if (src.includes("config.compilerWasm = undefined")) {
    writeFileSync(file, src.replaceAll("config.compilerWasm = undefined", REPLACEMENT));
    patched++;
    console.log("patch wasm compiler:", file);
  }
}
if (patched === 0) {
  const all = [...walk(genDir)].map((f) => readFileSync(f, "utf8")).join("\n");
  if (all.includes("config.compilerWasm = {")) {
    console.log("patch-prisma-wasm: compilerWasm déjà présent (PRISMA_CLIENT_ENGINE_TYPE=client), rien à faire");
  } else {
    console.error("Aucune occurrence de `config.compilerWasm = undefined` trouvée dans", genDir);
    process.exit(1);
  }
} else {
  console.log(`patch-prisma-wasm: ${patched} fichier(s) patché(s)`);
}
