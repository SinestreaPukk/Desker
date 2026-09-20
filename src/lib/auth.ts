/**
 * Admin authentication (Auth.js / NextAuth v5, credentials + JWT sessions).
 *
 * Email + password against the local User table. Deliberately no SSO, no email
 * verification, no password reset - single-workspace MVP.
 *
 * There is no middleware matcher: every admin surface calls `requireAdmin()`
 * (route handlers) or `auth()` (the admin layout) directly, so the check runs in
 * the Node runtime where Prisma is available and cannot be bypassed by a route
 * the matcher forgot.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * The signed-in user, verified against the database. A JWT outlives the row it
 * points at (a reset database, a deleted account), and everything tenancy does
 * starts from the user row - so a session with no user behind it is treated as
 * signed out rather than as a crash further down.
 */
export async function currentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        // Compare against a dummy hash when the user is absent so that a missing
        // account and a wrong password take the same time to answer.
        const hash =
          user?.passwordHash ??
          "$2a$12$00000000000000000000000000000000000000000000000000000";
        const ok = await bcrypt.compare(parsed.data.password, hash);

        if (!user || !ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
