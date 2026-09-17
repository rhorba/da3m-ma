import { and, desc, eq, isNotNull, notInArray } from "drizzle-orm";
import { getDatabase, type Database } from "@/lib/db/client";
import { programs, programVersions, sourceWatches } from "@/lib/db/schema";
import type { ValidCatalogueFile } from "./file-schema";

/**
 * Publishes verified catalogue files into the database (ADR-8). Published versions are
 * never modified (ADR-4): a file whose content differs from the latest published version
 * becomes a new version. Running sync twice with the same files changes nothing.
 * Drafts are skipped. Programmes missing from the files are left untouched — history is
 * never deleted by a sync.
 */

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, stable((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

type VersionPayload = {
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  amountMinMad: number | null;
  amountMaxMad: number | null;
  rules: unknown;
  documents: unknown;
  content: unknown;
  sourceUrl: string;
  applicationUrl: string | null;
  verifiedAt: string;
};

const fingerprint = (payload: VersionPayload) => JSON.stringify(stable(payload));

const toNumber = (value: string | null) => (value === null ? null : Number(value));

export type SyncSummary = {
  published: string[];
  unchanged: string[];
  skippedDrafts: string[];
};

export function createCatalogueSyncRepository(db: Database) {
  return {
    async sync(files: ValidCatalogueFile[]): Promise<SyncSummary> {
      const summary: SyncSummary = { published: [], unchanged: [], skippedDrafts: [] };

      for (const file of files) {
        if (file.verification.status !== "verified") {
          summary.skippedDrafts.push(file.slug);
          continue;
        }
        const verifiedAt = file.verification.verifiedAt!;
        const verifiedBy = file.verification.verifiedBy!;
        const payload: VersionPayload = {
          status: file.version.status,
          opensAt: file.version.opensAt,
          closesAt: file.version.closesAt,
          amountMinMad: file.version.amountMinMad,
          amountMaxMad: file.version.amountMaxMad,
          rules: file.parsedRules,
          documents: file.version.documents,
          content: file.version.content,
          sourceUrl: file.version.sourceUrl,
          applicationUrl: file.version.applicationUrl,
          verifiedAt,
        };

        const published = await db.transaction(async (tx) => {
          const [program] = await tx
            .insert(programs)
            .values({ slug: file.slug, operator: file.operator, kind: file.kind })
            .onConflictDoUpdate({
              target: programs.slug,
              set: { operator: file.operator, kind: file.kind, updatedAt: new Date() },
            })
            .returning({ id: programs.id });
          const programId = program!.id;

          const [latest] = await tx
            .select()
            .from(programVersions)
            .where(eq(programVersions.programId, programId))
            .orderBy(desc(programVersions.version))
            .limit(1);
          const [latestPublished] = await tx
            .select()
            .from(programVersions)
            .where(
              and(eq(programVersions.programId, programId), isNotNull(programVersions.publishedAt)),
            )
            .orderBy(desc(programVersions.version))
            .limit(1);

          const current = latestPublished
            ? fingerprint({
                status: latestPublished.status,
                opensAt: latestPublished.opensAt,
                closesAt: latestPublished.closesAt,
                amountMinMad: toNumber(latestPublished.amountMinMad),
                amountMaxMad: toNumber(latestPublished.amountMaxMad),
                rules: latestPublished.rules,
                documents: latestPublished.documents,
                content: latestPublished.content,
                sourceUrl: latestPublished.sourceUrl,
                applicationUrl: latestPublished.applicationUrl,
                verifiedAt: latestPublished.verifiedAt,
              })
            : null;

          let isNew = false;
          if (current !== fingerprint(payload)) {
            await tx.insert(programVersions).values({
              programId,
              version: (latest?.version ?? 0) + 1,
              status: payload.status as ValidCatalogueFile["version"]["status"],
              opensAt: payload.opensAt,
              closesAt: payload.closesAt,
              amountMinMad: payload.amountMinMad === null ? null : String(payload.amountMinMad),
              amountMaxMad: payload.amountMaxMad === null ? null : String(payload.amountMaxMad),
              rules: payload.rules,
              documents: payload.documents as { id: string; label: { fr: string } }[],
              content: payload.content as Record<string, unknown>,
              sourceUrl: payload.sourceUrl,
              applicationUrl: payload.applicationUrl,
              verifiedAt,
              verifiedBy,
              publishedAt: new Date(),
            });
            isNew = true;
          }

          const urls = file.watches.map((w) => w.url);
          for (const watch of file.watches) {
            await tx
              .insert(sourceWatches)
              .values({ programId, url: watch.url, cssSelector: watch.cssSelector })
              .onConflictDoUpdate({
                target: [sourceWatches.programId, sourceWatches.url],
                set: { cssSelector: watch.cssSelector },
              });
          }
          await tx
            .delete(sourceWatches)
            .where(
              urls.length > 0
                ? and(eq(sourceWatches.programId, programId), notInArray(sourceWatches.url, urls))
                : eq(sourceWatches.programId, programId),
            );

          return isNew;
        });

        (published ? summary.published : summary.unchanged).push(file.slug);
      }
      return summary;
    },
  };
}

export type CatalogueSyncRepository = ReturnType<typeof createCatalogueSyncRepository>;

export const getCatalogueSyncRepository = (): CatalogueSyncRepository =>
  createCatalogueSyncRepository(getDatabase());
