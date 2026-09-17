import { and, eq, sql } from "drizzle-orm";
import { getDatabase, type Database } from "@/lib/db/client";
import { memberships, organizations, type MembershipRole } from "@/lib/db/schema";

/**
 * Mirrors Clerk organisations and memberships into our database. Webhooks can arrive
 * out of order and more than once, so every write is an idempotent upsert, and a
 * membership event creates its organisation if that event hasn't landed yet.
 */
export function createClerkSyncRepository(db: Database) {
  async function upsertOrganization(clerkOrgId: string, name: string): Promise<string> {
    const [row] = await db
      .insert(organizations)
      .values({ clerkOrgId, name })
      .onConflictDoUpdate({
        target: organizations.clerkOrgId,
        set: { name, updatedAt: sql`now()` },
      })
      .returning({ id: organizations.id });
    if (!row) throw new Error("Organisation upsert returned no row");
    return row.id;
  }

  return {
    upsertOrganization,

    async deleteOrganization(clerkOrgId: string): Promise<void> {
      await db.delete(organizations).where(eq(organizations.clerkOrgId, clerkOrgId));
    },

    async upsertMembership(input: {
      clerkOrgId: string;
      orgName: string;
      clerkUserId: string;
      role: MembershipRole;
    }): Promise<void> {
      const orgId = await upsertOrganization(input.clerkOrgId, input.orgName);
      await db
        .insert(memberships)
        .values({ orgId, clerkUserId: input.clerkUserId, role: input.role })
        .onConflictDoUpdate({
          target: [memberships.orgId, memberships.clerkUserId],
          set: { role: input.role },
        });
    },

    async deleteMembership(clerkOrgId: string, clerkUserId: string): Promise<void> {
      const orgIds = db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.clerkOrgId, clerkOrgId));
      await db
        .delete(memberships)
        .where(
          and(sql`${memberships.orgId} IN (${orgIds})`, eq(memberships.clerkUserId, clerkUserId)),
        );
    },
  };
}

export type ClerkSyncRepository = ReturnType<typeof createClerkSyncRepository>;

export const getClerkSyncRepository = (): ClerkSyncRepository =>
  createClerkSyncRepository(getDatabase());
