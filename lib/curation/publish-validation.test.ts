import { describe, expect, it } from "vitest";
import type { Rule } from "@/lib/engine";
import {
  checkGoldenProfiles,
  goldenProfileSchema,
  previewRuleChange,
  validateForPublish,
  type GoldenProfile,
  type VersionDraft,
} from "./publish-validation";

const reason = {
  fr: "Réservé aux entreprises de moins de 5 ans",
  ar: "مخصص للمقاولات التي يقل عمرها عن 5 سنوات",
  en: "Companies under 5 years only",
};

const rules: Rule = {
  kind: "all",
  rules: [
    {
      kind: "criterion",
      id: "form",
      field: "legal_form",
      op: "in",
      value: ["sarl", "sarl_au", "auto_entrepreneur"],
      reason,
    },
    { kind: "criterion", id: "young", field: "company_age_months", op: "lte", value: 60, reason },
  ],
};

const content = {
  fr: { title: "Intelaka", summary: "Crédit à taux réduit." },
  ar: { title: "انطلاقة", summary: "قرض بسعر مخفض." },
  en: { title: "Intelaka", summary: "Reduced-rate loan." },
};

const documents = [
  { id: "rc", label: { fr: "Registre de commerce", ar: "السجل التجاري", en: "Trade register" } },
];

const draft = (overrides: Partial<VersionDraft> = {}): VersionDraft => ({
  status: "open",
  opensAt: null,
  closesAt: null,
  amountMinMad: 0,
  amountMaxMad: 1_200_000,
  rules,
  documents,
  content,
  sourceUrl: "https://www.tamwilcom.ma/fr/intelaka",
  applicationUrl: null,
  verifiedAt: "2026-09-15",
  ...overrides,
});

const TODAY = "2026-09-17";

function issuesOf(d: VersionDraft) {
  const result = validateForPublish(d, TODAY);
  if (result.ok) throw new Error("expected issues");
  return result.issues;
}

describe("validateForPublish", () => {
  it("accepts a complete, trilingual version and returns parsed values", () => {
    const result = validateForPublish(draft(), TODAY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rules).toEqual(rules);
      expect(result.content.ar.title).toBe("انطلاقة");
      expect(result.documents).toHaveLength(1);
    }
  });

  it("rejects an unknown profile field by name (Story 2.2 acceptance criterion)", () => {
    const bad = { kind: "criterion", id: "x", field: "turnover_eur", op: "gte", value: 1, reason };
    expect(issuesOf(draft({ rules: bad }))).toContainEqual({
      path: "rules",
      message: 'Unknown profile field "turnover_eur"',
    });
  });

  it("requires Arabic and English reasons on every criterion", () => {
    const frenchOnly: Rule = {
      kind: "criterion",
      id: "young",
      field: "company_age_months",
      op: "lte",
      value: 60,
      reason: { fr: "Moins de 5 ans" },
    };
    expect(issuesOf(draft({ rules: frenchOnly })).map((i) => i.message)).toEqual([
      'Missing ar reason for "young"',
      'Missing en reason for "young"',
    ]);
  });

  it("requires title and summary in all three languages", () => {
    const issues = issuesOf(
      draft({ content: { fr: content.fr, ar: { title: "انطلاقة", summary: "" } } }),
    );
    expect(issues.map((i) => i.path)).toEqual(
      expect.arrayContaining(["content.ar.summary", "content.en"]),
    );
  });

  it("requires trilingual document labels with unique ids", () => {
    expect(
      issuesOf(draft({ documents: [{ id: "rc", label: { fr: "RC" } }] })).some((i) =>
        i.path.startsWith("documents.0.label"),
      ),
    ).toBe(true);
    expect(
      issuesOf(draft({ documents: [...documents, ...documents] })).map((i) => i.message),
    ).toContain("Duplicate document ids");
  });

  it.each([
    ["http source", { sourceUrl: "http://www.tamwilcom.ma/fr/intelaka" }, "sourceUrl"],
    ["non-URL source", { sourceUrl: "tamwilcom" }, "sourceUrl"],
    ["http application URL", { applicationUrl: "http://example.ma" }, "applicationUrl"],
    ["future verification", { verifiedAt: "2026-09-18" }, "verifiedAt"],
    ["malformed verification", { verifiedAt: "15/09/2026" }, "verifiedAt"],
    ["malformed opening date", { opensAt: "soon" }, "opensAt"],
    ["closing before opening", { opensAt: "2026-10-01", closesAt: "2026-09-01" }, "closesAt"],
    ["upcoming without opening date", { status: "upcoming" as const }, "opensAt"],
    ["negative amount", { amountMinMad: -1 }, "amountMinMad"],
    ["min above max", { amountMinMad: 2_000_000 }, "amountMaxMad"],
  ])("rejects %s", (_label, overrides, path) => {
    expect(issuesOf(draft(overrides)).map((i) => i.path)).toContain(path);
  });

  it("accepts null amounts, dates and application URL", () => {
    expect(
      validateForPublish(
        draft({ amountMinMad: null, amountMaxMad: null, applicationUrl: "https://intelaka.ma" }),
        TODAY,
      ).ok,
    ).toBe(true);
  });

  it("reports every problem at once, not just the first", () => {
    const issues = issuesOf(draft({ sourceUrl: "nope", verifiedAt: "2099-01-01", content: {} }));
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });
});

const goldens: GoldenProfile[] = [
  {
    name: "young SARL",
    profile: { legal_form: "sarl", company_age_months: 12 },
    expected: "eligible",
  },
  {
    name: "old SARL",
    profile: { legal_form: "sarl", company_age_months: 120 },
    expected: "ineligible",
    expectedFailing: ["young"],
  },
  {
    name: "SARL, age unknown",
    profile: { legal_form: "sarl" },
    expected: "needs_info",
    expectedMissing: ["company_age_months"],
  },
];

describe("golden profiles", () => {
  it("pass when the rules produce the expected outcomes and explanations", () => {
    expect(checkGoldenProfiles(rules, goldens)).toEqual([]);
  });

  it("report outcome, failing and missing mismatches", () => {
    const wrong: GoldenProfile[] = [
      { ...goldens[0]!, expected: "ineligible" },
      { ...goldens[1]!, expectedFailing: ["form"] },
      { ...goldens[2]!, expectedMissing: ["region"] },
    ];
    expect(checkGoldenProfiles(rules, wrong)).toEqual([
      { name: "young SARL", problem: "expected ineligible, got eligible" },
      { name: "old SARL", problem: "expected failing [form], got [young]" },
      { name: "SARL, age unknown", problem: "expected missing [region], got [company_age_months]" },
    ]);
  });

  it("reject golden profiles that use fields outside the profile contract", () => {
    expect(
      goldenProfileSchema.safeParse({
        name: "x",
        profile: { turnover_eur: 1 },
        expected: "eligible",
      }).success,
    ).toBe(false);
  });
});

describe("previewRuleChange", () => {
  const stricter: Rule = {
    ...rules,
    rules: [
      rules.kind === "all" ? rules.rules[0]! : rules,
      { kind: "criterion", id: "young", field: "company_age_months", op: "lte", value: 6, reason },
    ],
  };

  it("shows which test profiles would change outcome", () => {
    expect(previewRuleChange(rules, stricter, goldens)).toEqual([
      { name: "young SARL", before: "eligible", after: "ineligible", changed: true, missing: [] },
      { name: "old SARL", before: "ineligible", after: "ineligible", changed: false, missing: [] },
      {
        name: "SARL, age unknown",
        before: "needs_info",
        after: "needs_info",
        changed: false,
        missing: ["company_age_months"],
      },
    ]);
  });

  it("treats a first version as changing everything", () => {
    expect(
      previewRuleChange(null, rules, goldens).every((row) => row.before === null && row.changed),
    ).toBe(true);
  });
});
