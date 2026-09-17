import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { AccessDeniedError, canWriteCabinet, type Actor } from "@/lib/auth";
import { getDatabase, type Database } from "@/lib/db/client";
import { clients } from "@/lib/db/schema";

// Profile shape is formalised in Story 2.1; until then client profiles are an open object.
const CLIENT_PROFILE_SCHEMA_VERSION = 1;

export const newClientInputSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  contactEmail: z.email().max(320).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  profile: z.record(z.string(), z.unknown()).default({}),
});
export type NewClientInput = z.input<typeof newClientInputSchema>;

export type Client = typeof clients.$inferSelect;

const uuidSchema = z.uuid();

/**
 * Firm-scoped client data. Every read and write is constrained to the actor's own
 * organisation; anything outside it is reported as "not found" (security §4).
 */
export function createCabinetRepository(db: Database) {
  return {
    async createClient(actor: Actor, input: NewClientInput): Promise<Client> {
      if (!canWriteCabinet(actor)) throw new AccessDeniedError("Cannot create clients");
      const data = newClientInputSchema.parse(input);
      const [row] = await db
        .insert(clients)
        .values({
          orgId: actor.orgId,
          displayName: data.displayName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          profile: data.profile,
          schemaVersion: CLIENT_PROFILE_SCHEMA_VERSION,
          createdBy: actor.userId,
        })
        .returning();
      if (!row) throw new Error("Insert returned no row");
      return row;
    },

    async getClient(actor: Actor, id: string): Promise<Client | null> {
      if (actor.kind !== "member" || !uuidSchema.safeParse(id).success) return null;
      const [row] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.id, id), eq(clients.orgId, actor.orgId)))
        .limit(1);
      return row ?? null;
    },

    async listClients(actor: Actor): Promise<Client[]> {
      if (actor.kind !== "member") return [];
      return db
        .select()
        .from(clients)
        .where(and(eq(clients.orgId, actor.orgId), isNull(clients.archivedAt)))
        .orderBy(asc(clients.displayName));
    },
  };
}

export type CabinetRepository = ReturnType<typeof createCabinetRepository>;

export const getCabinetRepository = (): CabinetRepository => createCabinetRepository(getDatabase());
