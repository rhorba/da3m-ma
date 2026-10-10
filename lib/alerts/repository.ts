import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { AccessDeniedError, type Actor } from "@/lib/auth";
import { getDatabase, type Database } from "@/lib/db/client";
import { alertSubscriptions, profiles } from "@/lib/db/schema";
import type { DueSubscription } from "./digest";

/**
 * Alert subscriptions (Story 4.4). Subscribing is a signed-in action (architecture §4):
 * alerts follow a saved profile, and only an account owns one durably. Confirming and
 * unsubscribing come from links in emails, so they are keyed by a subscription id the
 * caller has already proven through a signed token (tokens.ts).
 */

/** Opt-in emails per address per day: enough for a typo and a retry, too few to spam with. */
export const CONFIRMATIONS_PER_DAY = 3;
/** A day, less slack, so a cron that drifts a few minutes later still sends daily. */
export const DIGEST_INTERVAL_MS = 20 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscribeResult =
  | { kind: "pending"; subscriptionId: string; email: string }
  | { kind: "active"; email: string }
  | { kind: "no_profile" }
  | { kind: "rate_limited" };

export type AlertStatus = { email: string; state: "pending" | "active" } | null;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireUser(actor: Actor): string {
  if (actor.kind !== "user") throw new AccessDeniedError("Only a signed-in user has alerts");
  return actor.userId;
}

export function createAlertsRepository(db: Database) {
  async function latestProfileId(userId: string): Promise<string | null> {
    const [row] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.ownerUserId, userId))
      .orderBy(desc(profiles.updatedAt))
      .limit(1);
    return row?.id ?? null;
  }

  return {
    /**
     * Subscribes the user's most recent profile. Asking again re-sends the opt-in, and
     * re-subscribing after leaving needs a fresh confirmation: consent given once does
     * not survive an unsubscribe.
     */
    async subscribe(
      actor: Actor,
      input: { email: string; locale: string; now: Date },
    ): Promise<SubscribeResult> {
      const userId = requireUser(actor);
      const email = normaliseEmail(input.email);
      const profileId = await latestProfileId(userId);
      if (!profileId) return { kind: "no_profile" };

      const [existing] = await db
        .select()
        .from(alertSubscriptions)
        .where(
          and(eq(alertSubscriptions.profileId, profileId), eq(alertSubscriptions.email, email)),
        )
        .limit(1);
      if (existing?.confirmedAt && !existing.unsubscribedAt) return { kind: "active", email };

      const [{ sent } = { sent: 0 }] = await db
        .select({ sent: sql<number>`count(*)::int` })
        .from(alertSubscriptions)
        .where(
          and(
            eq(alertSubscriptions.email, email),
            gt(alertSubscriptions.confirmationSentAt, new Date(input.now.getTime() - DAY_MS)),
          ),
        );
      if (sent >= CONFIRMATIONS_PER_DAY) return { kind: "rate_limited" };

      const [row] = await db
        .insert(alertSubscriptions)
        .values({ profileId, email, locale: input.locale, confirmationSentAt: input.now })
        .onConflictDoUpdate({
          target: [alertSubscriptions.profileId, alertSubscriptions.email],
          set: {
            locale: input.locale,
            confirmationSentAt: input.now,
            confirmedAt: null,
            unsubscribedAt: null,
          },
        })
        .returning({ id: alertSubscriptions.id });
      if (!row) throw new Error("Upsert returned no row");
      return { kind: "pending", subscriptionId: row.id, email };
    },

    /** The state of the user's newest subscription that is still wanted. */
    async status(actor: Actor): Promise<AlertStatus> {
      const userId = requireUser(actor);
      const [row] = await db
        .select({ email: alertSubscriptions.email, confirmedAt: alertSubscriptions.confirmedAt })
        .from(alertSubscriptions)
        .innerJoin(profiles, eq(profiles.id, alertSubscriptions.profileId))
        .where(and(eq(profiles.ownerUserId, userId), isNull(alertSubscriptions.unsubscribedAt)))
        .orderBy(desc(alertSubscriptions.createdAt))
        .limit(1);
      if (!row) return null;
      return { email: row.email, state: row.confirmedAt ? "active" : "pending" };
    },

    /** True when the subscription exists and is not withdrawn; confirming twice is fine. */
    async confirm(subscriptionId: string, now: Date): Promise<boolean> {
      const [row] = await db
        .update(alertSubscriptions)
        .set({
          // Raw template values bypass the column's Date mapping, so the driver gets a string.
          confirmedAt: sql`coalesce(${alertSubscriptions.confirmedAt}, ${now.toISOString()}::timestamptz)`,
        })
        .where(
          and(eq(alertSubscriptions.id, subscriptionId), isNull(alertSubscriptions.unsubscribedAt)),
        )
        .returning({ id: alertSubscriptions.id });
      return Boolean(row);
    },

    /**
     * Stops every subscription for the address behind `subscriptionId`: someone who
     * clicks "unsubscribe" means the address, not one of its profiles.
     */
    async unsubscribe(subscriptionId: string, now: Date): Promise<boolean> {
      const [target] = await db
        .select({ email: alertSubscriptions.email })
        .from(alertSubscriptions)
        .where(eq(alertSubscriptions.id, subscriptionId))
        .limit(1);
      if (!target) return false;
      await db
        .update(alertSubscriptions)
        .set({ unsubscribedAt: now })
        .where(
          and(
            eq(alertSubscriptions.email, target.email),
            isNull(alertSubscriptions.unsubscribedAt),
          ),
        );
      return true;
    },

    /** Confirmed subscriptions not mailed in the last day, with the profile they follow. */
    async listDue(now: Date): Promise<DueSubscription[]> {
      const rows = await db
        .select({
          id: alertSubscriptions.id,
          email: alertSubscriptions.email,
          locale: alertSubscriptions.locale,
          profileData: profiles.data,
          confirmedAt: alertSubscriptions.confirmedAt,
          lastDigestAt: alertSubscriptions.lastDigestAt,
        })
        .from(alertSubscriptions)
        .innerJoin(profiles, eq(profiles.id, alertSubscriptions.profileId))
        .where(
          and(
            isNotNull(alertSubscriptions.confirmedAt),
            isNull(alertSubscriptions.unsubscribedAt),
            or(
              isNull(alertSubscriptions.lastDigestAt),
              lt(alertSubscriptions.lastDigestAt, new Date(now.getTime() - DIGEST_INTERVAL_MS)),
            ),
          ),
        )
        .orderBy(alertSubscriptions.email, alertSubscriptions.id);

      return rows.map((row) => ({
        id: row.id,
        email: row.email,
        locale: row.locale,
        profileData: row.profileData,
        since: row.lastDigestAt ?? row.confirmedAt!,
      }));
    },

    async markDigested(subscriptionIds: readonly string[], now: Date): Promise<void> {
      if (subscriptionIds.length === 0) return;
      await db
        .update(alertSubscriptions)
        .set({ lastDigestAt: now })
        .where(inArray(alertSubscriptions.id, [...subscriptionIds]));
    },
  };
}

export type AlertsRepository = ReturnType<typeof createAlertsRepository>;

export const getAlertsRepository = (): AlertsRepository => createAlertsRepository(getDatabase());
