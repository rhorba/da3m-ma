import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluateProgram, evaluateRule } from "./evaluate";
import {
  FIELD_SPECS,
  PROFILE_FIELDS,
  profileDataSchema,
  type ProfileData,
  type ProfileField,
} from "./profile-schema";
import { parseRules, type Criterion, type Rule } from "./rules";

// Property tests (test strategy §3). Rules and profiles are generated from FIELD_SPECS,
// so every new profile field is automatically covered.

const reason = { fr: "r", ar: "ر", en: "r" };

function valueFor(field: ProfileField): fc.Arbitrary<unknown> {
  const spec = FIELD_SPECS[field];
  switch (spec.kind) {
    case "boolean":
      return fc.boolean();
    case "integer":
      return fc.integer({ min: spec.min, max: spec.max });
    case "enum":
      return fc.constantFrom(...spec.values);
    case "enum_set":
      return fc.uniqueArray(fc.constantFrom(...spec.values), { maxLength: spec.values.length });
  }
}

/** fast-check's Arbitrary is invariant, so each operator-specific branch is widened explicitly. */
const asCriterion = (arb: fc.Arbitrary<unknown>) => arb as fc.Arbitrary<Criterion>;

const criterionArb: fc.Arbitrary<Criterion> = fc
  .tuple(fc.constantFrom(...PROFILE_FIELDS), fc.nat())
  .chain(([field, n]): fc.Arbitrary<Criterion> => {
    const spec = FIELD_SPECS[field];
    const base = { kind: "criterion" as const, id: `c${n}`, field, reason };
    switch (spec.kind) {
      case "boolean":
        return asCriterion(fc.constantFrom("is_true", "is_false").map((op) => ({ ...base, op })));
      case "integer": {
        const int = fc.integer({ min: spec.min, max: spec.max });
        return asCriterion(
          fc.oneof(
            fc
              .tuple(fc.constantFrom("eq", "neq", "gte", "lte"), int)
              .map(([op, value]) => ({ ...base, op, value })),
            fc.tuple(int, int).map(([a, b]) => ({
              ...base,
              op: "between" as const,
              value: [Math.min(a, b), Math.max(a, b)],
            })),
            fc
              .tuple(
                fc.constantFrom("in", "not_in"),
                fc.uniqueArray(int, { minLength: 1, maxLength: 4 }),
              )
              .map(([op, value]) => ({ ...base, op, value })),
          ),
        );
      }
      case "enum":
      case "enum_set": {
        const one = fc.constantFrom(...spec.values);
        const many = fc.uniqueArray(one, { minLength: 1, maxLength: 4 });
        const listOps = fc
          .tuple(fc.constantFrom("in", "not_in"), many)
          .map(([op, value]) => ({ ...base, op, value }));
        return asCriterion(
          spec.kind === "enum_set"
            ? listOps
            : fc.oneof(
                fc
                  .tuple(fc.constantFrom("eq", "neq"), one)
                  .map(([op, value]) => ({ ...base, op, value })),
                listOps,
              ),
        );
      }
    }
  });

const { rule: ruleArb } = fc.letrec<{ rule: Rule }>((tie) => ({
  rule: fc.oneof(
    { maxDepth: 4, depthIdentifier: "rule" },
    criterionArb,
    fc
      .array(tie("rule"), { minLength: 1, maxLength: 3 })
      .map((rules): Rule => ({ kind: "all", rules })),
    fc
      .array(tie("rule"), { minLength: 1, maxLength: 3 })
      .map((rules): Rule => ({ kind: "any", rules })),
    fc
      .tuple(tie("rule"), fc.nat())
      .map(([rule, n]): Rule => ({ kind: "not", id: `n${n}`, rule, reason })),
  ),
}));

const fullProfileArb: fc.Arbitrary<ProfileData> = fc.record(
  Object.fromEntries(PROFILE_FIELDS.map((f) => [f, valueFor(f)])) as Record<
    ProfileField,
    fc.Arbitrary<unknown>
  >,
) as fc.Arbitrary<ProfileData>;

/** A full profile plus a subset of it (same values, fewer fields). */
const profilePairArb = fullProfileArb.chain((full) =>
  fc.subarray(PROFILE_FIELDS).map((kept) => ({
    full,
    partial: Object.fromEntries(kept.map((f) => [f, full[f]])) as ProfileData,
  })),
);

describe("engine properties", () => {
  it("generated profiles are valid profiles", () => {
    fc.assert(fc.property(fullProfileArb, (p) => profileDataSchema.safeParse(p).success));
  });

  it("adding information never reverses a decision already made", () => {
    fc.assert(
      fc.property(ruleArb, profilePairArb, (rule, { full, partial }) => {
        const before = evaluateRule(rule, partial).value;
        const after = evaluateRule(rule, full).value;
        return before === "unknown" || before === after;
      }),
      { numRuns: 500 },
    );
  });

  it("a complete profile never yields needs_info", () => {
    fc.assert(
      fc.property(
        ruleArb,
        fullProfileArb,
        (rule, profile) => evaluateProgram(rule, profile).outcome !== "needs_info",
      ),
      { numRuns: 500 },
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(ruleArb, profilePairArb, (rule, { partial }) => {
        expect(evaluateProgram(rule, partial)).toEqual(evaluateProgram(rule, partial));
      }),
    );
  });

  it("every ineligible result has a reason and every needs_info names a field", () => {
    fc.assert(
      fc.property(ruleArb, profilePairArb, (rule, { partial }) => {
        const r = evaluateProgram(rule, partial);
        if (r.outcome === "ineligible") return r.failing.length > 0 && r.missing.length === 0;
        if (r.outcome === "needs_info") return r.missing.length > 0 && r.failing.length === 0;
        return r.failing.length === 0 && r.missing.length === 0;
      }),
      { numRuns: 500 },
    );
  });

  it("every missing field is actually absent from the profile", () => {
    fc.assert(
      fc.property(ruleArb, profilePairArb, (rule, { partial }) =>
        evaluateProgram(rule, partial).missing.every((f) => partial[f] === undefined),
      ),
      { numRuns: 300 },
    );
  });

  it("generated rule trees pass the validator (the generator matches the DSL)", () => {
    fc.assert(
      fc.property(ruleArb, (rule) => {
        // Generated ids may collide; that's a validator concern, not a structural one.
        const result = parseRules(rule);
        return result.ok || result.issues.every((i) => i.message.startsWith("Duplicate id"));
      }),
      { numRuns: 300 },
    );
  });
});
