import { and, eq } from "drizzle-orm";
import { getDatabase, type Database } from "@/lib/db/client";
import { memberships, organizations, type MembershipRole } from "@/lib/db/schema";

export function createAuthRepository(db: Database) {
  return {
    async findMembership(
      clerkOrgId: string,
      clerkUserId: string,
    ): Promise<{ orgId: string; role: MembershipRole } | null> {
      const [row] = await db
        .select({ orgId: memberships.orgId, role: memberships.role })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.orgId))
        .where(
          and(eq(organizations.clerkOrgId, clerkOrgId), eq(memberships.clerkUserId, clerkUserId)),
        )
        .limit(1);
      return row ?? null;
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;

export const getAuthRepository = (): AuthRepository => createAuthRepository(getDatabase());
