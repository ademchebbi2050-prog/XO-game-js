// Déclarations pour le compilateur de requêtes WASM embarqué dans
// @prisma/client/runtime (aucun .d.ts fourni par le paquet pour ces modules).
declare module "@prisma/client/runtime/query_compiler_bg.postgresql.wasm-base64.mjs" {
  export const wasm: string;
}

declare module "@prisma/client/runtime/query_compiler_bg.postgresql.js" {
  const runtime: unknown;
  export = runtime;
}
