import { cookies } from "next/headers";
import { ANON_COOKIE_NAME, generateAnonToken, hashAnonToken, type Actor } from "./actor";

/**
 * The anonymous visitor identity for public routes. Public pages never touch Clerk
 * (ADR-7), so the wizard resolves its actor from this cookie alone. A signed-in
 * visitor's anonymous data is claimed on their first visit to /mon-espace (Story 4.3).
 */

export type AnonActor = Extract<Actor, { kind: "anonymous" }>;

/** 24 months (security §3): long enough that a returning visitor keeps their results. */
export const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 730;

export const ANON_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: ANON_COOKIE_MAX_AGE,
} as const;

/** The visitor as they already are; null before they have ever submitted anything. */
export async function readAnonActor(): Promise<AnonActor | null> {
  const token = (await cookies()).get(ANON_COOKIE_NAME)?.value;
  return token ? { kind: "anonymous", tokenHash: hashAnonToken(token) } : null;
}

/**
 * The visitor, minting a token if this is their first submission. Only callable from a
 * Server Action or Route Handler — a Server Component cannot set cookies.
 */
export async function ensureAnonActor(): Promise<AnonActor> {
  const jar = await cookies();
  const existing = jar.get(ANON_COOKIE_NAME)?.value;
  if (existing) return { kind: "anonymous", tokenHash: hashAnonToken(existing) };

  const token = generateAnonToken();
  jar.set(ANON_COOKIE_NAME, token, ANON_COOKIE_OPTIONS);
  return { kind: "anonymous", tokenHash: hashAnonToken(token) };
}
