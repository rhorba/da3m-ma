import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { ANON_COOKIE_NAME, getAuthRepository, resolveActor, type Actor } from "@/lib/auth";

/**
 * Resolving who is making a request on a signed-in route.
 *
 * This is the only module that imports Clerk outside the webhook, and it lives apart
 * from `lib/auth` so that importing the actor model on a public page cannot drag Clerk
 * into the bundle (ADR-7). `resolveActor` itself stays pure and injected, which is why
 * it can be tested without any of this.
 */
export async function getActor(): Promise<Actor | null> {
  return resolveActor({
    getSession: async () => {
      const { userId, orgId } = await auth();
      return { userId: userId ?? null, clerkOrgId: orgId ?? null };
    },
    getAnonToken: async () => (await cookies()).get(ANON_COOKIE_NAME)?.value ?? null,
    findMembership: (clerkOrgId, clerkUserId) =>
      getAuthRepository().findMembership(clerkOrgId, clerkUserId),
  });
}
