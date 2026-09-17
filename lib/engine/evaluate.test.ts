import { describe, expect, it } from "vitest";
import { evaluateCatalog, evaluateProgram, evaluateRule, type TriState } from "./evaluate";
import type { ProfileData } from "./profile-schema";
import type { Criterion, Rule } from "./rules";

const reason = (id: string) => ({ fr: `raison ${id}`, ar: `سبب ${id}`, en: `reason ${id}` });

const criterion = (
  id: string,
  field: Criterion["field"],
  op: Criterion["op"],
  value?: unknown,
): Criterion => ({ kind: "criterion", id, field, op, value, reason: reason(id) });

// Leaves with a known truth value against BASE: is_mre = true, is_rural absent.
const BASE: ProfileData = { is_mre: true };
const leaf: Record<TriState, (id: string) => Criterion> = {
  pass: (id) => criterion(id, "is_mre", "is_true"),
  fail: (id) => criterion(id, "is_mre", "is_false"),
  unknown: (id) => criterion(id, "is_rural", "is_true"),
};
const STATES: TriState[] = ["pass", "unknown", "fail"];

describe("three-valued logic — full truth tables (ADR-3)", () => {
  const ALL: Record<TriState, Record<TriState, TriState>> = {
    pass: { pass: "pass", unknown: "unknown", fail: "fail" },
    unknown: { pass: "unknown", unknown: "unknown", fail: "fail" },
    fail: { pass: "fail", unknown: "fail", fail: "fail" },
  };
  const ANY: Record<TriState, Record<TriState, TriState>> = {
    pass: { pass: "pass", unknown: "pass", fail: "pass" },
    unknown: { pass: "pass", unknown: "unknown", fail: "unknown" },
    fail: { pass: "pass", unknown: "unknown", fail: "fail" },
  };

  for (const a of STATES) {
    for (const b of STATES) {
      it(`all(${a}, ${b}) = ${ALL[a][b]}`, () => {
        const rule: Rule = { kind: "all", rules: [leaf[a]("a"), leaf[b]("b")] };
        expect(evaluateRule(rule, BASE).value).toBe(ALL[a][b]);
      });
      it(`any(${a}, ${b}) = ${ANY[a][b]}`, () => {
        const rule: Rule = { kind: "any", rules: [leaf[a]("a"), leaf[b]("b")] };
        expect(evaluateRule(rule, BASE).value).toBe(ANY[a][b]);
      });
    }
  }

  it.each([
    ["pass", "fail"],
    ["fail", "pass"],
    ["unknown", "unknown"],
  ] as const)("not(%s) = %s", (input, expected) => {
    const rule: Rule = {
      kind: "not",
      id: "negated",
      rule: leaf[input]("x"),
      reason: reason("negated"),
    };
    expect(evaluateRule(rule, BASE).value).toBe(expected);
  });
});

describe("explanations", () => {
  it("a failing all() reports only the failing checks", () => {
    const rule: Rule = {
      kind: "all",
      rules: [leaf.pass("ok"), leaf.fail("bad"), leaf.unknown("q")],
    };
    const result = evaluateRule(rule, BASE);
    expect(result.failing.map((f) => f.id)).toEqual(["bad"]);
    expect(result.missing).toEqual([]);
  });

  it("an unknown all() reports each missing field once", () => {
    const rule: Rule = {
      kind: "all",
      rules: [
        leaf.unknown("q1"),
        criterion("q2", "is_rural", "is_false"),
        criterion("q3", "region", "eq", "oriental"),
      ],
    };
    expect(evaluateRule(rule, BASE)).toEqual({
      value: "unknown",
      failing: [],
      missing: ["is_rural", "region"],
    });
  });

  it("a failing any() reports every alternative that failed", () => {
    const rule: Rule = { kind: "any", rules: [leaf.fail("x"), leaf.fail("y")] };
    expect(evaluateRule(rule, BASE).failing.map((f) => f.id)).toEqual(["x", "y"]);
  });

  it("an unknown any() reports the fields that could still make it pass", () => {
    const rule: Rule = { kind: "any", rules: [leaf.fail("x"), leaf.unknown("q")] };
    expect(evaluateRule(rule, BASE)).toEqual({
      value: "unknown",
      failing: [],
      missing: ["is_rural"],
    });
  });

  it("a failing not() reports its own reason, not its child's", () => {
    const rule: Rule = {
      kind: "not",
      id: "not-mre",
      rule: leaf.pass("mre"),
      reason: reason("not-mre"),
    };
    expect(evaluateRule(rule, BASE).failing).toEqual([
      { id: "not-mre", reason: reason("not-mre") },
    ]);
  });

  it("an unknown not() passes through the missing fields", () => {
    const rule: Rule = { kind: "not", id: "n", rule: leaf.unknown("q"), reason: reason("n") };
    expect(evaluateRule(rule, BASE).missing).toEqual(["is_rural"]);
  });
});

describe("operators", () => {
  const profile: ProfileData = {
    legal_form: "sarl",
    company_age_months: 36,
    region: "fes-meknes",
    need_purposes: ["equip", "digitalise"],
    is_innovative: false,
  };
  const check = (c: Criterion, p: ProfileData = profile) => evaluateRule(c, p).value;

  it.each([
    ["eq match", criterion("c", "legal_form", "eq", "sarl"), "pass"],
    ["eq mismatch", criterion("c", "legal_form", "eq", "sa"), "fail"],
    ["neq match", criterion("c", "legal_form", "neq", "sa"), "pass"],
    ["neq mismatch", criterion("c", "legal_form", "neq", "sarl"), "fail"],
    ["in hit", criterion("c", "region", "in", ["oriental", "fes-meknes"]), "pass"],
    ["in miss", criterion("c", "region", "in", ["oriental"]), "fail"],
    ["not_in hit", criterion("c", "region", "not_in", ["fes-meknes"]), "fail"],
    ["not_in miss", criterion("c", "region", "not_in", ["oriental"]), "pass"],
    ["set in overlap", criterion("c", "need_purposes", "in", ["export", "equip"]), "pass"],
    ["set in disjoint", criterion("c", "need_purposes", "in", ["export"]), "fail"],
    ["set not_in overlap", criterion("c", "need_purposes", "not_in", ["digitalise"]), "fail"],
    ["set not_in disjoint", criterion("c", "need_purposes", "not_in", ["export"]), "pass"],
    ["gte boundary", criterion("c", "company_age_months", "gte", 36), "pass"],
    ["gte below", criterion("c", "company_age_months", "gte", 37), "fail"],
    ["lte boundary", criterion("c", "company_age_months", "lte", 36), "pass"],
    ["lte above", criterion("c", "company_age_months", "lte", 35), "fail"],
    ["between inclusive low", criterion("c", "company_age_months", "between", [36, 60]), "pass"],
    ["between inclusive high", criterion("c", "company_age_months", "between", [12, 36]), "pass"],
    ["between below", criterion("c", "company_age_months", "between", [37, 60]), "fail"],
    ["between above", criterion("c", "company_age_months", "between", [0, 35]), "fail"],
    ["is_true on false", criterion("c", "is_innovative", "is_true"), "fail"],
    ["is_false on false", criterion("c", "is_innovative", "is_false"), "pass"],
  ] as const)("%s", (_label, c, expected) => {
    expect(check(c)).toBe(expected);
  });

  it("treats an empty multi-value answer as answered", () => {
    expect(check(criterion("c", "need_purposes", "in", ["equip"]), { need_purposes: [] })).toBe(
      "fail",
    );
    expect(check(criterion("c", "need_purposes", "not_in", ["equip"]), { need_purposes: [] })).toBe(
      "pass",
    );
  });

  it("treats null like an absent field", () => {
    const profileWithNull = { region: null } as unknown as ProfileData;
    expect(evaluateRule(criterion("c", "region", "eq", "oriental"), profileWithNull)).toEqual({
      value: "unknown",
      failing: [],
      missing: ["region"],
    });
  });

  it("never treats a missing field as a failure, whatever the operator", () => {
    for (const op of [
      "eq",
      "neq",
      "in",
      "not_in",
      "gte",
      "lte",
      "between",
      "is_true",
      "is_false",
    ] as const) {
      expect(check(criterion("c", "sector", op, "x"), {})).toBe("unknown");
    }
  });
});

describe("programme outcome", () => {
  const rules: Rule = {
    kind: "all",
    rules: [
      criterion("form", "legal_form", "in", ["sarl", "sa", "auto_entrepreneur"]),
      criterion("young", "company_age_months", "lte", 60),
    ],
  };

  it("missing information is a question, not a rejection (test strategy §4)", () => {
    expect(evaluateProgram(rules, { legal_form: "sarl" })).toEqual({
      outcome: "needs_info",
      failing: [],
      missing: ["company_age_months"],
    });
  });

  it("names the failing criterion when ineligible", () => {
    const result = evaluateProgram(rules, { legal_form: "sarl", company_age_months: 120 });
    expect(result.outcome).toBe("ineligible");
    expect(result.failing).toEqual([{ id: "young", reason: reason("young") }]);
  });

  it("is eligible when everything passes", () => {
    expect(evaluateProgram(rules, { legal_form: "sa", company_age_months: 12 }).outcome).toBe(
      "eligible",
    );
  });

  it("evaluates a whole catalogue, keeping version ids", () => {
    const results = evaluateCatalog({ legal_form: "sa", company_age_months: 12 }, [
      { programId: "p1", programVersionId: "v1", rules },
      { programId: "p2", programVersionId: "v7", rules: leaf.unknown("q") },
    ]);
    expect(results).toEqual([
      { programId: "p1", programVersionId: "v1", outcome: "eligible", failing: [], missing: [] },
      {
        programId: "p2",
        programVersionId: "v7",
        outcome: "needs_info",
        failing: [],
        missing: ["is_rural"],
      },
    ]);
  });
});
