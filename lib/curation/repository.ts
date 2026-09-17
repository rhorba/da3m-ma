import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDatabase, type Database } from "@/lib/db/client";
import { programVersions, programs, reviewTasks, sourceWatches } from "@/lib/db/schema";
import type { WatchOutcome } from "./watcher";

/**
 * Catalogue maintenance jobs. The catalogue is platform-owned, not tenant data, and these
 * functions only touch catalogue tables. They are invoked by the cron route (authenticated
 * with CRON_SECRET), never by a user action.
 */

export const REVERIFY_AFTER_DAYS = 30;

export type DueWatch = typeof sourceWatches.$inferSelect;

export function createCurationJobsRepository(db: Database) {
  return {
    /**
     * The least-recently checked watch for each host, so a run sends at most one request
     * per host (NFR-6). With an hourly schedule every watch is checked at least daily as
     * long as a host has no more than 24 watched pages.
     */
    async listDueWatches(): Promise<DueWatch[]> {
      const rows = await db
        .select()
        .from(sourceWatches)
        .orderBy(sql`${sourceWatches.lastCheckedAt} ASC NULLS FIRST`, asc(sourceWatches.id));
      const perHost = new Map<string, DueWatch>();
      for (const row of rows) {
        let host: string;
        try {
          host = new URL(row.url).hostname.toLowerCase();
        } catch {
          host = `invalid:${row.id}`;
        }
        if (!perHost.has(host)) perHost.set(host, row);
      }
      return [...perHost.values()];
    },

    async recordOutcome(watch: DueWatch, outcome: WatchOutcome): Promise<void> {
      await db.transaction(async (tx) => {
        const now = sql`now()`;
        switch (outcome.kind) {
          case "baseline":
            await tx
              .update(sourceWatches)
              .set({
                lastHash: outcome.hash,
                lastText: outcome.text,
                lastCheckedAt: now,
                lastError: null,
              })
              .where(eq(sourceWatches.id, watch.id));
            return;
          case "unchanged":
            await tx
              .update(sourceWatches)
              .set({ lastCheckedAt: now, lastError: null })
              .where(eq(sourceWatches.id, watch.id));
            return;
          case "changed":
            await tx
              .update(sourceWatches)
              .set({
                lastHash: outcome.hash,
                lastText: outcome.text,
                lastCheckedAt: now,
                lastChangedAt: now,
                lastError: null,
              })
              .where(eq(sourceWatches.id, watch.id));
            await tx.insert(reviewTasks).values({
              programId: watch.programId,
              watchId: watch.id,
              kind: "source_changed",
              diffExcerpt: outcome.diffExcerpt,
            });
            return;
          case "blocked":
          case "error": {
            await tx
              .update(sourceWatches)
              .set({ lastCheckedAt: now, lastError: outcome.reason })
              .where(eq(sourceWatches.id, watch.id));
            // One open "fetch_failing" task per watch, not one per hourly run.
            const [open] = await tx
              .select({ id: reviewTasks.id })
              .from(reviewTasks)
              .where(
                and(
                  eq(reviewTasks.watchId, watch.id),
                  eq(reviewTasks.kind, "fetch_failing"),
                  eq(reviewTasks.status, "open"),
                ),
              )
              .limit(1);
            if (!open) {
              await tx.insert(reviewTasks).values({
                programId: watch.programId,
                watchId: watch.id,
                kind: "fetch_failing",
                diffExcerpt: outcome.reason,
              });
            }
          }
        }
      });
    },

    /**
     * Opens a "reverify_due" task for each programme whose current published version was
     * last verified more than 30 days before `today`, unless one is already open.
     */
    async openReverifyTasks(today: string): Promise<number> {
      const published = await db
        .select({
          programId: programVersions.programId,
          version: programVersions.version,
          verifiedAt: programVersions.verifiedAt,
        })
        .from(programVersions)
        .innerJoin(programs, eq(programs.id, programVersions.programId))
        .where(isNotNull(programVersions.publishedAt))
        .orderBy(asc(programVersions.programId), desc(programVersions.version));

      const current = new Map<string, string>();
      for (const row of published) {
        if (!current.has(row.programId)) current.set(row.programId, row.verifiedAt);
      }

      const cutoff = new Date(`${today}T00:00:00Z`);
      cutoff.setUTCDate(cutoff.getUTCDate() - REVERIFY_AFTER_DAYS);
      const cutoffDate = cutoff.toISOString().slice(0, 10);

      let opened = 0;
      for (const [programId, verifiedAt] of current) {
        if (verifiedAt >= cutoffDate) continue;
        const [open] = await db
          .select({ id: reviewTasks.id })
          .from(reviewTasks)
          .where(
            and(
              eq(reviewTasks.programId, programId),
              eq(reviewTasks.kind, "reverify_due"),
              eq(reviewTasks.status, "open"),
            ),
          )
          .limit(1);
        if (open) continue;
        await db.insert(reviewTasks).values({
          programId,
          kind: "reverify_due",
          diffExcerpt: `Last verified ${verifiedAt}`,
        });
        opened++;
      }
      return opened;
    },
  };
}

export type CurationJobsRepository = ReturnType<typeof createCurationJobsRepository>;

export const getCurationJobsRepository = (): CurationJobsRepository =>
  createCurationJobsRepository(getDatabase());
