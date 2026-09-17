import {
  ENGINE_VERSION,
  evaluateCatalog,
  rankResults,
  type CatalogEntry,
  type FailedCheck,
  type ProfileData,
  type ProfileField,
  type ProgramOutcome,
  type ProgramStatus,
  type RankedCatalog,
} from "@/lib/engine";
import type { ProgramContent, PublishedProgram } from "@/lib/catalog";

/**
 * Turning a profile plus the published catalogue into a report (Story 3.3). Pure:
 * the caller supplies the catalogue and persists the result.
 *
 * A report snapshots everything the results page renders, not just the outcome, so a
 * report opened a year later still shows the programme as it was when it was run
 * (ADR-4). Nothing here reads a programme version at render time.
 */

export type ReportResult = {
  programId: string;
  programVersionId: string;
  /** The version number, so a stale report can say how far behind it is. */
  version: number;
  slug: string;
  operator: string;
  kind: string;
  outcome: ProgramOutcome;
  failing: FailedCheck[];
  missing: ProfileField[];
  status: ProgramStatus;
  amountMinMad: number | null;
  amountMaxMad: number | null;
  content: ProgramContent;
  sourceUrl: string;
  applicationUrl: string | null;
  verifiedAt: string;
};

export type BuiltReport = {
  engineVersion: string;
  inputSnapshot: ProfileData;
  results: ReportResult[];
  eligibleCount: number;
};

function toCatalogEntry(program: PublishedProgram): CatalogEntry {
  return {
    programId: program.programId,
    programVersionId: program.programVersionId,
    rules: program.rules,
  };
}

/** Groups the results of a stored report back into display order without re-evaluating. */
export function rankReportResults(results: readonly ReportResult[]): RankedCatalog<ReportResult> {
  return rankResults(results);
}

export function buildReport(
  profile: ProfileData,
  catalogue: readonly PublishedProgram[],
): BuiltReport {
  const byVersion = new Map(catalogue.map((p) => [p.programVersionId, p]));
  const evaluations = evaluateCatalog(profile, catalogue.map(toCatalogEntry));

  const results: ReportResult[] = evaluations.map((evaluation) => {
    const program = byVersion.get(evaluation.programVersionId)!;
    return {
      programId: evaluation.programId,
      programVersionId: evaluation.programVersionId,
      version: program.version,
      slug: program.slug,
      operator: program.operator,
      kind: program.kind,
      outcome: evaluation.outcome,
      failing: evaluation.failing,
      missing: evaluation.missing,
      status: program.status,
      amountMinMad: program.amountMinMad,
      amountMaxMad: program.amountMaxMad,
      content: program.content,
      sourceUrl: program.sourceUrl,
      applicationUrl: program.applicationUrl,
      verifiedAt: program.verifiedAt,
    };
  });

  return {
    engineVersion: ENGINE_VERSION,
    inputSnapshot: profile,
    results,
    eligibleCount: results.filter((r) => r.outcome === "eligible").length,
  };
}
