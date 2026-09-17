import { desc, eq, isNotNull } from "drizzle-orm";
import { parseRules, type ProgramStatus, type Rule } from "@/lib/engine";
import { getDatabase, type Database } from "@/lib/db/client";
import { programs, programVersions, type I18nText } from "@/lib/db/schema";

/**
 * Reading the published catalogue. The catalogue is platform-owned public data, not
 * tenant data, so unlike every other repository these functions take no Actor: there is
 * no predicate to derive. Writes still go only through the sync repository (ADR-8).
 */

export type ProgramContent = Partial<Record<string, { title: string; summary: string }>>;

/** One programme at its currently published version, with everything a report snapshots. */
export type PublishedProgram = {
  programId: string;
  programVersionId: string;
  version: number;
  slug: string;
  operator: string;
  kind: string;
  status: ProgramStatus;
  opensAt: string | null;
  closesAt: string | null;
  amountMinMad: number | null;
  amountMaxMad: number | null;
  content: ProgramContent;
  documents: { id: string; label: I18nText }[];
  sourceUrl: string;
  applicationUrl: string | null;
  verifiedAt: string;
  rules: Rule;
};

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

export function createCatalogueReadRepository(db: Database) {
  return {
    /**
     * Every programme at its latest published version, ordered by slug so two calls
     * feed the engine the same catalogue.
     */
    async listPublished(): Promise<PublishedProgram[]> {
      const rows = await db
        .selectDistinctOn([programVersions.programId], {
          programId: programs.id,
          slug: programs.slug,
          operator: programs.operator,
          kind: programs.kind,
          programVersionId: programVersions.id,
          version: programVersions.version,
          status: programVersions.status,
          opensAt: programVersions.opensAt,
          closesAt: programVersions.closesAt,
          amountMinMad: programVersions.amountMinMad,
          amountMaxMad: programVersions.amountMaxMad,
          content: programVersions.content,
          documents: programVersions.documents,
          sourceUrl: programVersions.sourceUrl,
          applicationUrl: programVersions.applicationUrl,
          verifiedAt: programVersions.verifiedAt,
          rules: programVersions.rules,
        })
        .from(programVersions)
        .innerJoin(programs, eq(programs.id, programVersions.programId))
        .where(isNotNull(programVersions.publishedAt))
        .orderBy(programVersions.programId, desc(programVersions.version));

      const published: PublishedProgram[] = [];
      for (const row of rows) {
        const parsed = parseRules(row.rules);
        if (!parsed.ok) {
          // Unreachable for anything CI let through (ADR-8). Dropping one corrupt
          // programme is better than failing every visitor's results page.
          console.error(`Published rules for ${row.slug} do not parse`, parsed.issues);
          continue;
        }
        published.push({
          ...row,
          kind: row.kind,
          amountMinMad: toNumber(row.amountMinMad),
          amountMaxMad: toNumber(row.amountMaxMad),
          content: (row.content ?? {}) as ProgramContent,
          rules: parsed.rules,
        });
      }
      return published.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    },
  };
}

export type CatalogueReadRepository = ReturnType<typeof createCatalogueReadRepository>;

export const getCatalogueReadRepository = (): CatalogueReadRepository =>
  createCatalogueReadRepository(getDatabase());
