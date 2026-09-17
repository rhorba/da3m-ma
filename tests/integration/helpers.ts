import { randomUUID } from "node:crypto";
import { afterAll, inject } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { memberships, organizations, type MembershipRole } from "@/lib/db/schema";
import type { Actor } from "@/lib/auth";

/** One pooled connection per test file, closed automatically. */
export function connectTestDatabase() {
  const handle = createDatabase(inject("databaseUrl"), { max: 2 });
  afterAll(() => handle.close());
  return handle.db;
}

export const uniqueId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "")}`;

type Db = ReturnType<typeof connectTestDatabase>;

export async function seedFirm(db: Db, name = "Firm") {
  const [org] = await db
    .insert(organizations)
    .values({ clerkOrgId: uniqueId("org"), name })
    .returning();
  if (!org) throw new Error("seed failed");

  async function member(role: MembershipRole): Promise<Extract<Actor, { kind: "member" }>> {
    const userId = uniqueId("user");
    await db.insert(memberships).values({ orgId: org!.id, clerkUserId: userId, role });
    return { kind: "member", userId, orgId: org!.id, role };
  }

  return { org, member };
}
