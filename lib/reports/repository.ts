import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { AccessDeniedError, type Actor } from "@/lib/auth";
import { getDatabase, type Database } from "@/lib/db/client";
import { eligibilityReports, profiles } from "@/lib/db/schema";
import type { BuiltReport, ReportResult } from "./build";

/**
 * Eligibility reports (Story 3.3). Rows are written once and never updated: answering a
 * follow-up question creates a new report rather than mutating the old one, so a link
 * shared today shows the same thing next year (ADR-4).
 */

export type EligibilityReport = Omit<typeof eligibilityReports.$inferSelect, "results"> & {
  results: ReportResult[];
};

const uuidSchema = z.uuid();

/** The profile predicate that proves this actor owns the report's profile. */
function profileOwnerPredicate(actor: Actor) {
  switch (actor.kind) {
    case "anonymous":
      return eq(profiles.anonTokenHash, actor.tokenHash);
    case "user":
      return eq(profiles.ownerUserId, actor.userId);
    default:
      // Firm members read cabinet reports, which are scoped by org and client (Sprint 5).
      return null;
  }
}

export function createReportsRepository(db: Database) {
  return {
    /**
     * Stores a report against a profile the actor owns. The profile id is re-checked
     * against the actor rather than trusted from the caller.
     */
    async createReport(
      actor: Actor,
      profileId: string,
      report: BuiltReport,
    ): Promise<EligibilityReport> {
      const owner = profileOwnerPredicate(actor);
      if (!owner) throw new AccessDeniedError("Only visitors and signed-in users own reports");
      if (!uuidSchema.safeParse(profileId).success) {
        throw new AccessDeniedError("Unknown profile");
      }

      const [profile] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(eq(profiles.id, profileId), owner))
        .limit(1);
      if (!profile) throw new AccessDeniedError("Unknown profile");

      const [row] = await db
        .insert(eligibilityReports)
        .values({
          profileId,
          engineVersion: report.engineVersion,
          inputSnapshot: report.inputSnapshot,
          results: report.results,
          eligibleCount: report.eligibleCount,
        })
        .returning();
      if (!row) throw new Error("Insert returned no row");
      return row as EligibilityReport;
    },

    /** A report is readable only by the actor who owns the profile it was run for. */
    async getReport(actor: Actor, id: string): Promise<EligibilityReport | null> {
      const owner = profileOwnerPredicate(actor);
      if (!owner || !uuidSchema.safeParse(id).success) return null;

      const [row] = await db
        .select({ report: eligibilityReports })
        .from(eligibilityReports)
        .innerJoin(profiles, eq(profiles.id, eligibilityReports.profileId))
        .where(and(eq(eligibilityReports.id, id), owner))
        .limit(1);
      return (row?.report as EligibilityReport | undefined) ?? null;
    },
  };
}

export type ReportsRepository = ReturnType<typeof createReportsRepository>;

export const getReportsRepository = (): ReportsRepository => createReportsRepository(getDatabase());
