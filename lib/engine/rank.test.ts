import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { programStatus } from "@/lib/db/schema";
import type { FailedCheck } from "./evaluate";
import {
  CLOSEST_LIMIT,
  flattenRanked,
  PROGRAM_STATUSES,
  rankResults,
  type ProgramStatus,
  type RankableResult,
} from "./rank";

const reason = { fr: "r", ar: "ر", en: "r" };
const check = (id: string): FailedCheck => ({ id, reason });

type Overrides = Partial<RankableResult> & { id: string };

function result({ id, ...rest }: Overrides): RankableResult {
  return {
    programId: id,
    programVersionId: `${id}-v1`,
    outcome: "eligible",
    failing: [],
    missing: [],
    status: "open",
    amountMaxMad: null,
    ...rest,
  };
}

const ids = (items: readonly RankableResult[]) => items.map((r) => r.programId);

describe("PROGRAM_STATUSES", () => {
  it("matches the program_status database enum", () => {
    expect([...PROGRAM_STATUSES].sort()).toEqual([...programStatus.enumValues].sort());
  });
});

describe("rankResults grouping", () => {
  it("splits results by outcome", () => {
    const ranked = rankResults([
      result({ id: "a" }),
      result({ id: "b", outcome: "needs_info", missing: ["legal_form"] }),
      result({ id: "c", outcome: "ineligible", failing: [check("x")] }),
    ]);

    expect(ids(ranked.eligible)).toEqual(["a"]);
    expect(ids(ranked.needsInfo)).toEqual(["b"]);
    expect(ids(ranked.ineligible)).toEqual(["c"]);
  });

  it("returns empty groups for an empty catalogue", () => {
    expect(rankResults([])).toEqual({
      eligible: [],
      needsInfo: [],
      ineligible: [],
      closest: [],
    });
  });
});

describe("eligible ordering", () => {
  it("puts currently open programmes before rolling, upcoming then closed", () => {
    const ranked = rankResults([
      result({ id: "closed", status: "closed" }),
      result({ id: "upcoming", status: "upcoming" }),
      result({ id: "rolling", status: "rolling" }),
      result({ id: "open", status: "open" }),
    ]);

    expect(ids(ranked.eligible)).toEqual(["open", "rolling", "upcoming", "closed"]);
  });

  it("orders equally open programmes by the largest amount first", () => {
    const ranked = rankResults([
      result({ id: "small", amountMaxMad: 50_000 }),
      result({ id: "big", amountMaxMad: 1_000_000 }),
      result({ id: "medium", amountMaxMad: 300_000 }),
    ]);

    expect(ids(ranked.eligible)).toEqual(["big", "medium", "small"]);
  });

  it("sorts programmes without a published ceiling last", () => {
    const ranked = rankResults([
      result({ id: "unknown-amount", amountMaxMad: null }),
      result({ id: "zero", amountMaxMad: 0 }),
    ]);

    expect(ids(ranked.eligible)).toEqual(["zero", "unknown-amount"]);
  });

  it("falls back to the programme id when status and amount tie", () => {
    const ranked = rankResults([
      result({ id: "b", amountMaxMad: 100 }),
      result({ id: "a", amountMaxMad: 100 }),
    ]);

    expect(ids(ranked.eligible)).toEqual(["a", "b"]);
  });

  it("keeps a stable order for duplicate ids", () => {
    const ranked = rankResults([
      result({ id: "same", programVersionId: "same-v1" }),
      result({ id: "same", programVersionId: "same-v2" }),
    ]);

    expect(ranked.eligible.map((r) => r.programVersionId)).toEqual(["same-v1", "same-v2"]);
  });
});

describe("needs_info ordering", () => {
  const needsInfo = (id: string, missing: RankableResult["missing"], status?: ProgramStatus) =>
    result({ id, outcome: "needs_info", missing, status });

  it("asks for the fewest answers first", () => {
    const ranked = rankResults([
      needsInfo("three", ["legal_form", "region", "sector"]),
      needsInfo("one", ["legal_form"]),
      needsInfo("two", ["legal_form", "region"]),
    ]);

    expect(ids(ranked.needsInfo)).toEqual(["one", "two", "three"]);
  });

  it("breaks ties on status, then on id", () => {
    const ranked = rankResults([
      needsInfo("z-open", ["region"], "open"),
      needsInfo("a-closed", ["region"], "closed"),
      needsInfo("a-open", ["region"], "open"),
    ]);

    expect(ids(ranked.needsInfo)).toEqual(["a-open", "z-open", "a-closed"]);
  });
});

describe("ineligible ordering", () => {
  const ineligible = (id: string, failing: FailedCheck[], status?: ProgramStatus) =>
    result({ id, outcome: "ineligible", failing, status });

  it("puts the nearest misses first", () => {
    const ranked = rankResults([
      ineligible("far", [check("a"), check("b"), check("c")]),
      ineligible("near", [check("a")]),
      ineligible("mid", [check("a"), check("b")]),
    ]);

    expect(ids(ranked.ineligible)).toEqual(["near", "mid", "far"]);
  });

  it("breaks ties on status, then on id", () => {
    const ranked = rankResults([
      ineligible("z-open", [check("a")], "open"),
      ineligible("a-closed", [check("a")], "closed"),
      ineligible("a-open", [check("a")], "open"),
    ]);

    expect(ids(ranked.ineligible)).toEqual(["a-open", "z-open", "a-closed"]);
  });
});

describe("closest programmes", () => {
  const ineligible = (id: string, failing: FailedCheck[]) =>
    result({ id, outcome: "ineligible", failing });

  it("offers the three nearest misses with what would have to change", () => {
    const ranked = rankResults([
      ineligible("d", [check("a"), check("b"), check("c"), check("d")]),
      ineligible("c", [check("a"), check("b"), check("c")]),
      ineligible("b", [check("a"), check("b")]),
      ineligible("a", [check("a")]),
    ]);

    expect(ids(ranked.closest)).toEqual(["a", "b", "c"]);
    expect(ranked.closest).toHaveLength(CLOSEST_LIMIT);
    expect(ranked.closest[0]?.wouldChange).toEqual([check("a")]);
  });

  it("offers fewer than three when the catalogue is smaller", () => {
    const ranked = rankResults([ineligible("a", [check("a")])]);

    expect(ids(ranked.closest)).toEqual(["a"]);
  });

  it("stays empty when something is already eligible", () => {
    const ranked = rankResults([result({ id: "yes" }), ineligible("no", [check("a")])]);

    expect(ranked.closest).toEqual([]);
  });

  it("stays empty when a question could still turn into a match", () => {
    const ranked = rankResults([
      result({ id: "ask", outcome: "needs_info", missing: ["region"] }),
      ineligible("no", [check("a")]),
    ]);

    expect(ranked.closest).toEqual([]);
  });
});

describe("flattenRanked", () => {
  it("returns the groups in display order", () => {
    const ranked = rankResults([
      result({ id: "no", outcome: "ineligible", failing: [check("a")] }),
      result({ id: "yes" }),
      result({ id: "ask", outcome: "needs_info", missing: ["region"] }),
    ]);

    expect(ids(flattenRanked(ranked))).toEqual(["yes", "ask", "no"]);
  });
});

describe("ranking properties", () => {
  const resultArb: fc.Arbitrary<RankableResult> = fc
    .record({
      programId: fc.string({ minLength: 1, maxLength: 4 }),
      outcome: fc.constantFrom("eligible" as const, "needs_info" as const, "ineligible" as const),
      status: fc.constantFrom(...PROGRAM_STATUSES),
      amountMaxMad: fc.option(fc.integer({ min: 0, max: 10_000_000 }), { nil: null }),
      failingCount: fc.integer({ min: 0, max: 4 }),
      missingCount: fc.integer({ min: 0, max: 4 }),
    })
    .map(({ programId, outcome, status, amountMaxMad, failingCount, missingCount }) => ({
      programId,
      programVersionId: `${programId}-v1`,
      outcome,
      status,
      amountMaxMad,
      failing:
        outcome === "ineligible"
          ? Array.from({ length: failingCount }, (_, i) => check(`f${i}`))
          : [],
      missing:
        outcome === "needs_info"
          ? Array.from({ length: missingCount }, () => "region" as const)
          : [],
    }));

  it("loses nothing: every result lands in exactly one group", () => {
    fc.assert(
      fc.property(fc.array(resultArb, { maxLength: 30 }), (results) => {
        const ranked = rankResults(results);
        expect(flattenRanked(ranked)).toHaveLength(results.length);
      }),
    );
  });

  it("does not depend on input order", () => {
    fc.assert(
      fc.property(fc.array(resultArb, { maxLength: 20 }), (results) => {
        const shuffled = [...results].reverse();
        expect(flattenRanked(rankResults(shuffled))).toEqual(flattenRanked(rankResults(results)));
      }),
    );
  });

  it("never mutates its input", () => {
    fc.assert(
      fc.property(fc.array(resultArb, { maxLength: 20 }), (results) => {
        const before = JSON.stringify(results);
        rankResults(results);
        expect(JSON.stringify(results)).toBe(before);
      }),
    );
  });
});
