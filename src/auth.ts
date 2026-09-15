// SPDX-License-Identifier: GPL-3.0-only
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkRateLimit, resetRateLimit, throttlingEnabled, DEFAULT_LIMITS } from "@/lib/rate-limit";
import { verifyTotpCode } from "@/lib/totp";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      // v2.10.0 — `totp` is the optional second factor; the login form only
      // sends it after authorize() answers with TOTP_REQUIRED.
      credentials: { email: {}, password: {}, totp: {} },
      // Brute-force guard: throttled per IP (password) and per account (TOTP).
      // authorize() runs in the Node runtime (db/bcrypt not available in the
      // middleware runtime), so the limiters live here instead of the proxy.
      authorize: async (credentials, request) => {
        const ip =
          request instanceof Request
            ? (request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "anonymous")
            : "anonymous";
        if (throttlingEnabled() && !checkRateLimit(`login:${ip}`, DEFAULT_LIMITS.login)) return null;

        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        if (!user.approved) {
          throw new Error("APPROVAL_PENDING");
        }

        // v2.10.0 — optional TOTP: without an enabled secret this step is a
        // no-op; with it, the code is mandatory and brute force is throttled
        // per account, independent of the attacker's IP rotation.
        if (user.totpEnabled) {
          const token = (credentials?.totp as string | undefined) ?? "";
          if (throttlingEnabled() && !checkRateLimit(`totp-login:${user.id}`, { max: 5, windowMs: 5 * 60 * 1000 })) {
            return null;
          }
          if (!token) throw new Error("TOTP_REQUIRED");
          if (user.totpSecret && verifyTotpCode(user.totpSecret, token) !== "VALID") {
            throw new Error("INVALID_TOTP");
          }
        }

        // Successful login clears the throttle counter for this IP
        if (throttlingEnabled()) resetRateLimit(`login:${ip}`);

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
