"use server";
// Unlock action for the gate page, e.g. app/coming-soon/actions.ts. Use it with useActionState
// on a single password field.

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken } from "@/lib/access";

export type UnlockState = { status: "idle" | "ok" } | { status: "wrong"; attempt: number };

export async function unlock(previous: UnlockState, formData: FormData): Promise<UnlockState> {
  const expected = process.env.SITE_PASSWORD;
  if (!expected) console.error("[gate] SITE_PASSWORD is not set, so the site cannot be unlocked.");

  const given = String(formData.get("password") ?? "");
  if (!expected || !sameText(given, expected)) {
    await new Promise((r) => setTimeout(r, 600)); // slows down guessing
    return { status: "wrong", attempt: previous.status === "wrong" ? previous.attempt + 1 : 1 };
  }

  (await cookies()).set(ACCESS_COOKIE, await accessToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  return { status: "ok" };
}

function sameText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
