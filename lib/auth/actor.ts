import { createHash, randomBytes } from "node:crypto";
import type { MembershipRole } from "@/lib/db/schema";

/**
 * Who is making a request. Every repository function takes one and derives its
 * query predicates from it (ADR-5). There is deliberately no "system" actor that
 * bypasses scoping.
 */
export type Actor =
  | { kind: "anonymous"; tokenHash: string }
  | { kind: "user"; userId: string }
  | { kind: "member"; userId: string; orgId: string; role: MembershipRole }
  | { kind: "admin"; userId: string };

export class AccessDeniedError extends Error {
  constructor(message = "Access denied") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export const ANON_COOKIE_NAME = "da3m_anon";

export function generateAnonToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Anonymous tokens are only ever stored hashed (database doc §7). */
export function hashAnonToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Maps a Clerk organisation role key onto our three firm roles. Unknown roles get
 * the least privilege.
 */
export function mapClerkRole(clerkRole: string): MembershipRole {
  switch (clerkRole) {
    case "org:admin":
    case "org:owner":
      return "owner";
    case "org:member":
    case "org:consultant":
      return "consultant";
    default:
      return "viewer";
  }
}

export function canWriteCabinet(
  actor: Actor,
): actor is Extract<Actor, { kind: "member" }> & { role: "owner" | "consultant" } {
  return actor.kind === "member" && (actor.role === "owner" || actor.role === "consultant");
}
