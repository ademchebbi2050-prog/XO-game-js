import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

// Auth.js v5, stratégie JWT (credentials). Le cookie de session reste
// HOST-ONLY sur app.<domaine>: on ne pose jamais d'attribut Domain,
// donc jamais transmissible aux sous-domaines boutiques ni au parent.
export const { handlers, auth, signIn, signOut } = NextAuth({
  // trustHost: nécessaire en local (hôtes app.localhost:3000, *.localhost:3000).
  // En prod derrière le domaine racine, Auth.js fait confiance au Host natif.
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
  pages: { signIn: "/app/login" },
  providers: [
    Credentials({
      name: "email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: String(creds.email).toLowerCase().trim() },
        });
        if (!user) return null;
        const ok = await verifyPassword(String(creds.password), user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        // Secure uniquement si COOKIE_SECURE=true (prod HTTPS). En local
        // (http://*.localhost:3000) un cookie Secure ne serait jamais renvoyé.
        secure: process.env.COOKIE_SECURE === "true",
        // PAS d'attribut domain -> cookie host-only (app.<domaine> uniquement)
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.uid) (session.user as { id?: string }).id = String(token.uid);
      return session;
    },
  },
});

export type SessionUser = { id: string; email: string; name: string };

/** Session courante côté serveur (layouts / routes). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user?.email || !id) return null;
  return { id, email: session.user.email, name: session.user.name ?? "" };
}
