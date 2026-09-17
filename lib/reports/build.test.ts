import { describe, expect, it } from "vitest";
import type { PublishedProgram } from "@/lib/catalog";
import { ENGINE_VERSION, type ProfileData, type Rule } from "@/lib/engine";
import { buildReport, rankReportResults } from "./build";

const reason = { fr: "Moins de 5 ans", ar: "أقل من 5 سنوات", en: "Under 5 years" };

const youngRule: Rule = {
  kind: "criterion",
  id: "young",
  field: "company_age_months",
  op: "lte",
  value: 60,
  reason,
};

const ruralRule: Rule = {
  kind: "criterion",
  id: "rural",
  field: "is_rural",
  op: "is_true",
  reason: { fr: "Zone rurale", ar: "منطقة قروية", en: "Rural area" },
};

function program(overrides: Partial<PublishedProgram> & { slug: string }): PublishedProgram {
  return {
    programId: `prog-${overrides.slug}`,
    programVersionId: `ver-${overrides.slug}`,
    version: 1,
    operator: "Tamwilcom",
    kind: "loan",
    status: "open",
    opensAt: null,
    closesAt: null,
    amountMinMad: null,
    amountMaxMad: 1_000_000,
    content: { fr: { title: "Exemple", summary: "Résumé" } },
    documents: [],
    sourceUrl: "https://www.tamwilcom.ma/fr/example",
    applicationUrl: null,
    verifiedAt: "2026-09-16",
    rules: youngRule,
    ...overrides,
  };
}

describe("buildReport", () => {
  const catalogue = [
    program({ slug: "young-only", rules: youngRule }),
    program({ slug: "rural-only", rules: ruralRule, amountMaxMad: 300_000 }),
  ];

  it("records the engine version and the profile it was run against", () => {
    const profile: ProfileData = { company_age_months: 12 };
    const report = buildReport(profile, catalogue);

    expect(report.engineVersion).toBe(ENGINE_VERSION);
    expect(report.inputSnapshot).toEqual(profile);
  });

  it("evaluates every published programme", () => {
    const report = buildReport({ company_age_months: 12 }, catalogue);

    expect(report.results.map((r) => [r.slug, r.outcome])).toEqual([
      ["young-only", "eligible"],
      ["rural-only", "needs_info"],
    ]);
    expect(report.eligibleCount).toBe(1);
  });

  it("carries the failing check so the report can explain itself later", () => {
    const report = buildReport({ company_age_months: 120 }, catalogue);
    const youngOnly = report.results.find((r) => r.slug === "young-only");

    expect(youngOnly?.outcome).toBe("ineligible");
    expect(youngOnly?.failing).toEqual([{ id: "young", reason }]);
  });

  it("names the missing field so the results page can ask one question", () => {
    const report = buildReport({ company_age_months: 12 }, catalogue);
    const ruralOnly = report.results.find((r) => r.slug === "rural-only");

    expect(ruralOnly?.missing).toEqual(["is_rural"]);
  });

  it("snapshots the document checklist, so it cannot change under the visitor", () => {
    const documents = [{ id: "rc", label: { fr: "RC", ar: "السجل", en: "Register" } }];
    const report = buildReport({}, [program({ slug: "with-docs", documents })]);

    expect(report.results[0]?.documents).toEqual(documents);
  });

  it("snapshots the version facts the results page renders", () => {
    const report = buildReport({}, [
      program({
        slug: "snapshot",
        version: 7,
        status: "rolling",
        amountMinMad: 10_000,
        amountMaxMad: 200_000,
        applicationUrl: "https://www.tamwilcom.ma/fr/apply",
        verifiedAt: "2026-08-01",
      }),
    ]);

    expect(report.results[0]).toMatchObject({
      version: 7,
      slug: "snapshot",
      operator: "Tamwilcom",
      kind: "loan",
      status: "rolling",
      amountMinMad: 10_000,
      amountMaxMad: 200_000,
      sourceUrl: "https://www.tamwilcom.ma/fr/example",
      applicationUrl: "https://www.tamwilcom.ma/fr/apply",
      verifiedAt: "2026-08-01",
      content: { fr: { title: "Exemple", summary: "Résumé" } },
    });
  });

  it("counts no matches for an empty catalogue", () => {
    expect(buildReport({}, [])).toMatchObject({ results: [], eligibleCount: 0 });
  });
});

describe("rankReportResults", () => {
  it("groups a stored report without re-evaluating anything", () => {
    const report = buildReport({ company_age_months: 120, is_rural: true }, [
      program({ slug: "no", rules: youngRule }),
      program({ slug: "yes", rules: ruralRule }),
    ]);

    const ranked = rankReportResults(report.results);

    expect(ranked.eligible.map((r) => r.slug)).toEqual(["yes"]);
    expect(ranked.ineligible.map((r) => r.slug)).toEqual(["no"]);
    expect(ranked.closest).toEqual([]);
  });

  it("offers the nearest misses when nothing matches and nothing can be asked", () => {
    const report = buildReport({ company_age_months: 120, is_rural: false }, [
      program({ slug: "no", rules: youngRule }),
      program({ slug: "also-no", rules: ruralRule }),
    ]);

    const ranked = rankReportResults(report.results);

    expect(ranked.closest.map((r) => r.slug)).toEqual(["also-no", "no"]);
    expect(ranked.closest[0]?.wouldChange).toHaveLength(1);
  });
});
