import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import PostgresAdapter from "@auth/pg-adapter";
import { getPool } from "@/lib/db";

const googleProvider = process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
  ? [Google({
      profile(profile) {
        const email = profile.email?.trim().toLowerCase();
        if (!email || profile.email_verified !== true) throw new Error("Google account email is not verified.");
        return { id: profile.sub, name: profile.name, email, image: profile.picture, emailVerified: new Date() };
      },
    })]
  : [];

const testProvider = process.env.NODE_ENV !== "production" && process.env.ALLOW_TEST_AUTH === "1"
  ? [Credentials({
      id: "test-login",
      name: "Local test login",
      credentials: { userId: { label: "User ID", type: "text" }, secret: { label: "Test secret", type: "password" } },
      async authorize(credentials) {
        if (typeof credentials.userId !== "string" || typeof credentials.secret !== "string"
          || !process.env.TEST_AUTH_SECRET || credentials.secret !== process.env.TEST_AUTH_SECRET) return null;
        const result = await getPool().query<{ id: string; email: string; name: string | null }>(
          "SELECT id, email, name FROM auth.users WHERE id = $1",
          [credentials.userId],
        );
        return result.rows[0] ?? null;
      },
    })]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(getPool()),
  providers: [...googleProvider, ...testProvider],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
