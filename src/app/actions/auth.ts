// SPDX-License-Identifier: GPL-3.0-only
"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { needsSetup } from "@/lib/setup";
import { checkRateLimit, throttlingEnabled, DEFAULT_LIMITS } from "@/lib/rate-limit";
import { getAppConfig } from "@/lib/app-config";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "anonymous";
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export async function registerUser(input: { email: string; password: string; name: string }) {
  if (throttlingEnabled() && !checkRateLimit(`register:${await clientIp()}`, DEFAULT_LIMITS.register)) {
    return { error: "Too many requests. Try again later." };
  }
  if (await needsSetup()) return { error: "Setup admin account first at /setup" };
  if (process.env.ALLOW_REGISTRATION === "false") return { error: "Registration is disabled" };
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, password, name } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "Email already registered" };

  const passwordHash = await bcrypt.hash(password, 12);
  // v3.5.2 — auth.selfApprove (config.yaml): skip the admin approval step and
  // approve the account immediately. No email verification exists, so the
  // address is approved as-is.
  const selfApprove = (await getAppConfig()).authSelfApprove;
  await db.user.create({ data: { email, name, passwordHash, approved: selfApprove } });
  return { ok: true, approved: selfApprove };
}
