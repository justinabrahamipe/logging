import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
};

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['query', 'error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

console.log('[AUTH] Prisma client initialized:', !!prisma);
console.log('[AUTH] Prisma account model exists:', !!prisma?.account);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/contacts.readonly"
        }
      }
    }),
  ],
  trustHost: true,
  debug: false,
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
    error: "/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicPaths = ["/", "/login", "/verify-request", "/error", "/privacy", "/terms"];
      const isPublicPage = publicPaths.some(path => nextUrl.pathname === path || nextUrl.pathname.startsWith(path));

      if (isPublicPage) return true;

      return isLoggedIn;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.id = profile.sub || token.sub;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
});
