import type { CatalogResult, FailedCheck } from "./evaluate";

/**
 * Ordering of evaluated programmes (Story 3.2). Pure, like the evaluator: same
 * inputs, same order, every time. Ranking lives outside evaluate.ts so the
 * evaluator's 100% branch gate keeps covering decision logic only.
 */

/** Mirrors the program_status database enum; parity is asserted in rank.test.ts. */
export const PROGRAM_STATUSES = ["open", "closed", "upcoming", "rolling"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

/**
 * How applicable a status is right now. "open" beats "rolling" because a window
 * that is explicitly open can close; a rolling programme is never urgent.
 */
const STATUS_RANK: Record<ProgramStatus, number> = {
  open: 0,
  rolling: 1,
  upcoming: 2,
  closed: 3,
};

/** An evaluation plus the version facts ranking needs. */
export type RankableResult = CatalogResult & {
  status: ProgramStatus;
  amountMaxMad: number | null;
};

/** A near miss: everything in the result, plus what the visitor would have to change. */
export type ClosestProgram<T extends RankableResult = RankableResult> = T & {
  wouldChange: FailedCheck[];
};

/**
 * Generic over the result type so a caller carrying more than the engine needs — a
 * stored report result, say — gets its own fields back rather than the base type.
 */
export type RankedCatalog<T extends RankableResult = RankableResult> = {
  eligible: T[];
  needsInfo: T[];
  ineligible: T[];
  /**
   * The three nearest misses, populated only when the visitor has nothing to act on —
   * no eligible programme and no question that could turn into one (UX empty state).
   */
  closest: ClosestProgram<T>[];
};

export const CLOSEST_LIMIT = 3;

/** Programmes without a published ceiling sort last; they promise nothing measurable. */
function amountKey(amountMaxMad: number | null): number {
  return amountMaxMad ?? Number.NEGATIVE_INFINITY;
}

/** Final tie-break, so two otherwise equal programmes never swap between runs. */
function byId(a: RankableResult, b: RankableResult): number {
  return a.programId < b.programId ? -1 : a.programId > b.programId ? 1 : 0;
}

function byStatusThenId(a: RankableResult, b: RankableResult): number {
  return STATUS_RANK[a.status] - STATUS_RANK[b.status] || byId(a, b);
}

/** Biggest cheque first among programmes that are equally open. */
function byOpennessThenAmount(a: RankableResult, b: RankableResult): number {
  return (
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    amountKey(b.amountMaxMad) - amountKey(a.amountMaxMad) ||
    byId(a, b)
  );
}

/** Fewest questions first: the shortest path to an answer. */
function byFewestMissing(a: RankableResult, b: RankableResult): number {
  return a.missing.length - b.missing.length || byStatusThenId(a, b);
}

/** Fewest blockers first: the nearest miss. */
function byFewestFailing(a: RankableResult, b: RankableResult): number {
  return a.failing.length - b.failing.length || byStatusThenId(a, b);
}

export function rankResults<T extends RankableResult>(results: readonly T[]): RankedCatalog<T> {
  const eligible = results.filter((r) => r.outcome === "eligible").sort(byOpennessThenAmount);
  const needsInfo = results.filter((r) => r.outcome === "needs_info").sort(byFewestMissing);
  const ineligible = results.filter((r) => r.outcome === "ineligible").sort(byFewestFailing);

  const closest =
    eligible.length === 0 && needsInfo.length === 0
      ? ineligible
          .slice(0, CLOSEST_LIMIT)
          .map((result) => ({ ...result, wouldChange: result.failing }))
      : [];

  return { eligible, needsInfo, ineligible, closest };
}

/** Flat order for storage and for "N programmes" counts: groups in display order. */
export function flattenRanked<T extends RankableResult>(ranked: RankedCatalog<T>): T[] {
  return [...ranked.eligible, ...ranked.needsInfo, ...ranked.ineligible];
}
