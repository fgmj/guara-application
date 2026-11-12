import type { NextAuthConfig } from "next-auth";
import { canAccessPath, homeFor } from "@/lib/roles";

// Configuração compatível com o Edge (usada pelo middleware): sem Prisma nem bcrypt.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const user = auth?.user;
      if (nextUrl.pathname.startsWith("/login")) {
        return user ? Response.redirect(new URL(homeFor(user.role), nextUrl)) : true;
      }
      if (!user) return false; // redireciona para /login
      if (nextUrl.pathname !== "/" && !canAccessPath(user.role, nextUrl.pathname)) {
        return Response.redirect(new URL(homeFor(user.role), nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
