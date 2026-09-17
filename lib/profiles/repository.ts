import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AccessDeniedError, type Actor } from "@/lib/auth";
import { getDatabase, type Database } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

// Profile shape is formalised in Story 2.1 (ADR-6).
const PROFILE_SCHEMA_VERSION = 1;

export type Profile = typeof profiles.$inferSelect;

const profileDataSchema = z.record(z.string(), z.unknown());
const uuidSchema = z.uuid();

function ownerPredicate(actor: Actor) {
  switch (actor.kind) {
    case "anonymous":
      return eq(profiles.anonTokenHash, actor.tokenHash);
    case "user":
      return eq(profiles.ownerUserId, actor.userId);
    default:
      // Firm members and platform admins never read B2C profiles (security §4).
      return null;
  }
}

/** B2C profiles: readable and writable only by their anonymous token or owning user. */
export function createProfilesRepository(db: Database) {
  return {
    /**
     * An anonymous visitor has exactly one profile (the wizard saves after every step),
     * so saving again updates it. A signed-in user gets a new profile per call.
     */
    async saveProfile(actor: Actor, data: Record<string, unknown>): Promise<Profile> {
      if (actor.kind !== "anonymous" && actor.kind !== "user") {
        throw new AccessDeniedError("Only visitors and signed-in users own profiles");
      }
      const parsed = profileDataSchema.parse(data);
      const insert = db.insert(profiles).values({
        anonTokenHash: actor.kind === "anonymous" ? actor.tokenHash : null,
        ownerUserId: actor.kind === "user" ? actor.userId : null,
        data: parsed,
        schemaVersion: PROFILE_SCHEMA_VERSION,
      });
      const [row] = await (
        actor.kind === "anonymous"
          ? insert.onConflictDoUpdate({
              target: profiles.anonTokenHash,
              set: { data: parsed, schemaVersion: PROFILE_SCHEMA_VERSION, updatedAt: sql`now()` },
            })
          : insert
      ).returning();
      if (!row) throw new Error("Insert returned no row");
      return row;
    },

    async getProfile(actor: Actor, id: string): Promise<Profile | null> {
      const owner = ownerPredicate(actor);
      if (!owner || !uuidSchema.safeParse(id).success) return null;
      const [row] = await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, id), owner))
        .limit(1);
      return row ?? null;
    },
  };
}

export type ProfilesRepository = ReturnType<typeof createProfilesRepository>;

export const getProfilesRepository = (): ProfilesRepository =>
  createProfilesRepository(getDatabase());
