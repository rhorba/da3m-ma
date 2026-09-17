import { and, desc, eq, isNotNull } from "drizzle-orm";
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

const COLUMNS = {
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
} as const;

/** The selection above, typed from the tables rather than from drizzle internals. */
type Row = Pick<typeof programs.$inferSelect, "slug" | "operator" | "kind"> &
  Pick<
    typeof programVersions.$inferSelect,
    | "version"
    | "status"
    | "opensAt"
    | "closesAt"
    | "amountMinMad"
    | "amountMaxMad"
    | "content"
    | "documents"
    | "sourceUrl"
    | "applicationUrl"
    | "verifiedAt"
    | "rules"
  > & { programId: string; programVersionId: string };

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * Turns a row into a programme, or null when its stored rules do not parse. That is
 * unreachable for anything CI let through (ADR-8); dropping one corrupt programme is
 * better than failing every visitor's page.
 */
function toPublished(row: Row): PublishedProgram | null {
  const parsed = parseRules(row.rules);
  if (!parsed.ok) {
    console.error(`Published rules for ${row.slug} do not parse`, parsed.issues);
    return null;
  }
  return {
    ...row,
    amountMinMad: toNumber(row.amountMinMad),
    amountMaxMad: toNumber(row.amountMaxMad),
    content: (row.content ?? {}) as ProgramContent,
    rules: parsed.rules,
  };
}

export function createCatalogueReadRepository(db: Database) {
  return {
    /**
     * Every programme at its latest published version, ordered by slug so two calls
     * feed the engine the same catalogue.
     */
    async listPublished(): Promise<PublishedProgram[]> {
      const rows = await db
        .selectDistinctOn([programVersions.programId], COLUMNS)
        .from(programVersions)
        .innerJoin(programs, eq(programs.id, programVersions.programId))
        .where(isNotNull(programVersions.publishedAt))
        .orderBy(programVersions.programId, desc(programVersions.version));

      return rows
        .map(toPublished)
        .filter((p): p is PublishedProgram => p !== null)
        .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    },

    /** One programme at its latest published version; null while it is still a draft. */
    async findPublishedBySlug(slug: string): Promise<PublishedProgram | null> {
      const [row] = await db
        .select(COLUMNS)
        .from(programVersions)
        .innerJoin(programs, eq(programs.id, programVersions.programId))
        .where(and(eq(programs.slug, slug), isNotNull(programVersions.publishedAt)))
        .orderBy(desc(programVersions.version))
        .limit(1);

      return row ? toPublished(row) : null;
    },
  };
}

export type CatalogueReadRepository = ReturnType<typeof createCatalogueReadRepository>;

export const getCatalogueReadRepository = (): CatalogueReadRepository =>
  createCatalogueReadRepository(getDatabase());
