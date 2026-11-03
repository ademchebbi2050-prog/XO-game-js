import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DashboardShell from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

// Layout dashboard (app.<domaine>): exige une session; si l'utilisateur n'a
// aucune boutique, on l'envoie à l'onboarding.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/app/login");
  const storeCount = await prisma.store.count({ where: { ownerId: user.id } });
  if (storeCount === 0) redirect("/app/onboarding");
  return <DashboardShell userName={user.name}>{children}</DashboardShell>;
}
