import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { seedDefaultData } from "@/lib/seed-data";


export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: false,
      authorization: {
        params: {
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile"
        }
      }
    }),
  ],
  events: {
    async createUser({ user }) {
      if (user.id) {
        await seedDefaultData(user.id);
      }
    },
  },
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
    error: "/error",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        // Always resolve to the existing user by email to prevent ID mismatches
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, profile.email))
          .limit(1);
        if (existing.length > 0) {
          token.sub = existing[0].id;
        }
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
});
