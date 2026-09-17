import { describe, expect, it } from "vitest";
import {
  PROFILE_FIELDS,
  PROFILE_KEYS_MATCH_SPECS,
  profileDataSchema,
  FIELD_SPECS,
  isProfileField,
} from "./profile-schema";
import { collectReasons, parseRules, referencedFields, RULE_MAX_DEPTH, type Rule } from "./rules";

const reason = { fr: "Réservé aux SARL", ar: "مخصص للشركات", en: "SARL only" };

const criterion = (overrides: Record<string, unknown> = {}) => ({
  kind: "criterion",
  id: "c1",
  field: "legal_form",
  op: "eq",
  value: "sarl",
  reason,
  ...overrides,
});

function issuesOf(input: unknown) {
  const result = parseRules(input);
  if (result.ok) throw new Error("expected validation to fail");
  return result.issues;
}

describe("parseRules — valid trees", () => {
  it("accepts a nested tree and returns it unchanged", () => {
    const tree = {
      kind: "all",
      rules: [
        criterion(),
        {
          kind: "any",
          rules: [criterion({ id: "c2", field: "is_mre", op: "is_true", value: undefined })],
        },
        {
          kind: "not",
          id: "not-big",
          reason,
          rule: criterion({ id: "c3", field: "employees_band", op: "in", value: ["200_plus"] }),
        },
      ],
    };
    const result = parseRules(tree);
    expect(result.ok).toBe(true);
  });

  it.each([
    ["enum eq", { field: "region", op: "eq", value: "oriental" }],
    ["enum not_in", { field: "sector", op: "not_in", value: ["tourism", "commerce"] }],
    ["integer gte", { field: "company_age_months", op: "gte", value: 0 }],
    ["integer between", { field: "company_age_months", op: "between", value: [12, 12] }],
    ["integer in", { field: "company_age_months", op: "in", value: [1, 2] }],
    ["boolean is_false", { field: "is_rural", op: "is_false", value: undefined }],
    ["set in", { field: "need_purposes", op: "in", value: ["export"] }],
  ])("accepts %s", (_label, overrides) => {
    expect(parseRules(criterion(overrides)).ok).toBe(true);
  });
});

describe("parseRules — rejections", () => {
  it("names an unknown profile field (Story 2.2 acceptance criterion)", () => {
    expect(issuesOf(criterion({ field: "turnover_eur" }))).toEqual([
      { path: "rules", message: 'Unknown profile field "turnover_eur"' },
    ]);
  });

  it("reports the path of a nested problem", () => {
    const tree = {
      kind: "all",
      rules: [criterion(), { kind: "any", rules: [criterion({ id: "c2", field: "nope" })] }],
    };
    expect(issuesOf(tree)).toEqual([
      { path: "rules.rules[1].rules[0]", message: 'Unknown profile field "nope"' },
    ]);
  });

  it.each([
    [
      "operator not valid for boolean",
      { field: "is_mre", op: "eq", value: true },
      /not valid for boolean/,
    ],
    ["operator not valid for enum", { field: "region", op: "gte", value: 1 }, /not valid for enum/],
    [
      "operator not valid for set",
      { field: "need_purposes", op: "eq", value: "export" },
      /not valid for enum_set/,
    ],
    ["boolean with a value", { field: "is_mre", op: "is_true", value: true }, /takes no value/],
    [
      "enum value outside the list",
      { field: "region", op: "eq", value: "paris" },
      /must be one of/,
    ],
    ["enum list empty", { field: "region", op: "in", value: [] }, /non-empty list/],
    [
      "enum list duplicates",
      { field: "region", op: "in", value: ["oriental", "oriental"] },
      /distinct/,
    ],
    [
      "enum list with a bad value",
      { field: "sector", op: "in", value: ["tourism", "space"] },
      /non-empty list/,
    ],
    [
      "set list not an array",
      { field: "need_purposes", op: "in", value: "export" },
      /non-empty list/,
    ],
    [
      "integer not integer",
      { field: "company_age_months", op: "gte", value: 1.5 },
      /integer within 0–1200/,
    ],
    [
      "integer out of range",
      { field: "company_age_months", op: "lte", value: 5000 },
      /integer within/,
    ],
    ["integer as string", { field: "company_age_months", op: "eq", value: "12" }, /integer within/],
    [
      "between inverted",
      { field: "company_age_months", op: "between", value: [60, 12] },
      /min ≤ max/,
    ],
    [
      "between wrong length",
      { field: "company_age_months", op: "between", value: [1] },
      /\[min, max\]/,
    ],
    ["between not array", { field: "company_age_months", op: "between", value: 5 }, /\[min, max\]/],
    [
      "between out of range",
      { field: "company_age_months", op: "between", value: [0, 9999] },
      /\[min, max\]/,
    ],
    [
      "integer list bad",
      { field: "company_age_months", op: "not_in", value: [1, -1] },
      /distinct integers/,
    ],
  ])("rejects %s", (_label, overrides, message) => {
    const issues = issuesOf(criterion(overrides));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(message);
  });

  it("rejects empty groups", () => {
    expect(issuesOf({ kind: "any", rules: [] })).toEqual([
      { path: "rules", message: '"any" needs at least one rule' },
    ]);
  });

  it("rejects duplicate ids across criteria and negations", () => {
    const tree = {
      kind: "all",
      rules: [criterion(), { kind: "not", id: "c1", reason, rule: criterion({ id: "c2" }) }],
    };
    expect(issuesOf(tree)).toEqual([{ path: "rules.rules[1]", message: 'Duplicate id "c1"' }]);
  });

  it("reports structural problems with their path", () => {
    const issues = issuesOf({ kind: "all", rules: [criterion({ reason: { ar: "x" } })] });
    expect(issues.some((i) => i.path.startsWith("rules.rules[0].reason"))).toBe(true);
  });

  it.each([
    ["unknown kind", { kind: "xor", rules: [] }],
    ["not an object", "legal_form = sarl"],
    ["null", null],
    ["bad id", criterion({ id: "Has Spaces" })],
    ["unknown operator", criterion({ op: "like" })],
    ["empty French reason", criterion({ reason: { fr: "  " } })],
  ])("rejects %s", (_label, input) => {
    expect(parseRules(input).ok).toBe(false);
  });

  it(`accepts depth ${RULE_MAX_DEPTH} and rejects depth ${RULE_MAX_DEPTH + 1}`, () => {
    const nest = (levels: number): unknown =>
      levels === 1 ? criterion() : { kind: "all", rules: [nest(levels - 1)] };
    expect(parseRules(nest(RULE_MAX_DEPTH)).ok).toBe(true);
    expect(issuesOf(nest(RULE_MAX_DEPTH + 1))).toEqual([
      { path: "rules", message: `Rule tree is deeper than ${RULE_MAX_DEPTH} levels` },
    ]);
  });

  it("counts not() when measuring depth", () => {
    const nest = (levels: number): unknown =>
      levels === 1
        ? criterion()
        : { kind: "not", id: `n${levels}`, reason, rule: nest(levels - 1) };
    expect(parseRules(nest(RULE_MAX_DEPTH + 1)).ok).toBe(false);
  });

  it("does not overflow the stack on a pathologically deep tree", () => {
    let tree: unknown = criterion();
    for (let i = 0; i < 100_000; i++) tree = { kind: "all", rules: [tree] };
    expect(parseRules(tree).ok).toBe(false);
  });
});

describe("tree helpers", () => {
  const tree: Rule = {
    kind: "all",
    rules: [
      { kind: "criterion", id: "a", field: "region", op: "eq", value: "oriental", reason },
      {
        kind: "not",
        id: "b",
        reason,
        rule: {
          kind: "any",
          rules: [
            { kind: "criterion", id: "c", field: "region", op: "eq", value: "oriental", reason },
            { kind: "criterion", id: "d", field: "is_mre", op: "is_true", reason },
          ],
        },
      },
    ],
  };

  it("lists referenced fields once, in order", () => {
    expect(referencedFields(tree)).toEqual(["region", "is_mre"]);
  });

  it("collects every reason including negations", () => {
    expect(collectReasons(tree).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("profile schema", () => {
  it("declares the same fields in the Zod schema and FIELD_SPECS", () => {
    expect(PROFILE_KEYS_MATCH_SPECS).toBe(true);
    expect(Object.keys(profileDataSchema.shape).sort()).toEqual([...PROFILE_FIELDS].sort());
  });

  it("recognises profile fields and nothing else", () => {
    expect(isProfileField("region")).toBe(true);
    expect(isProfileField("toString")).toBe(false);
    expect(isProfileField("turnover_eur")).toBe(false);
  });

  it("accepts an empty profile and ignores unknown keys", () => {
    expect(profileDataSchema.parse({})).toEqual({});
    expect(profileDataSchema.parse({ region: "oriental", cin: "AB123456" })).toEqual({
      region: "oriental",
    });
  });

  it("rejects out-of-contract values", () => {
    expect(profileDataSchema.safeParse({ region: "paris" }).success).toBe(false);
    expect(profileDataSchema.safeParse({ company_age_months: -1 }).success).toBe(false);
    expect(profileDataSchema.safeParse({ need_purposes: ["export", "export"] }).success).toBe(
      false,
    );
  });

  it("has 12 regions and bands with no gaps in their spec", () => {
    expect(FIELD_SPECS.region.values).toHaveLength(12);
    expect(FIELD_SPECS.company_age_months).toEqual({ kind: "integer", min: 0, max: 1200 });
  });
});
