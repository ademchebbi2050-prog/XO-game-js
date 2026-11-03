import { redirect } from "next/navigation";

// La racine redirige selon l'hôte (le middleware réécrit déjà app./boutiques;
// ceci couvre le cas host racine non réécrit).
export const dynamic = "force-dynamic";

export default function Home() {
  redirect("/app");
}
