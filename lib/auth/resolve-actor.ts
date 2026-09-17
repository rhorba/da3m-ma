import { hashAnonToken, type Actor } from "./actor";
import type { MembershipRole } from "@/lib/db/schema";

export type ResolveActorDeps = {
  /** Clerk session: userId and the active Clerk organisation id, if any. */
  getSession: () => Promise<{ userId: string | null; clerkOrgId: string | null }>;
  /** Raw anonymous token from the cookie, if present. */
  getAnonToken: () => Promise<string | null>;
  /**
   * Membership as recorded in our database (synced from Clerk webhooks). The session's
   * own org claim is never trusted on its own: a removed member with a stale session
   * token must not keep firm access.
   */
  findMembership: (
    clerkOrgId: string,
    clerkUserId: string,
  ) => Promise<{ orgId: string; role: MembershipRole } | null>;
};

export async function resolveActor(deps: ResolveActorDeps): Promise<Actor | null> {
  const { userId, clerkOrgId } = await deps.getSession();

  if (userId) {
    if (clerkOrgId) {
      const membership = await deps.findMembership(clerkOrgId, userId);
      if (membership) {
        return { kind: "member", userId, orgId: membership.orgId, role: membership.role };
      }
    }
    return { kind: "user", userId };
  }

  const token = await deps.getAnonToken();
  if (token) return { kind: "anonymous", tokenHash: hashAnonToken(token) };

  return null;
}
