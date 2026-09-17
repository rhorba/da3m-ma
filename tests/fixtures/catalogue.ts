// A minimal valid catalogue file, shared by unit and integration tests.

const reason = { fr: "Moins de 5 ans", ar: "أقل من 5 سنوات", en: "Under 5 years" };

export const exampleFile = (overrides: Record<string, unknown> = {}) => ({
  slug: "example-loan",
  operator: "Tamwilcom",
  kind: "loan",
  verification: { status: "draft", verifiedAt: null, verifiedBy: null },
  sources: [{ url: "https://www.tamwilcom.ma/fr/example", consultedAt: "2026-09-17" }],
  version: {
    status: "open",
    opensAt: null,
    closesAt: null,
    amountMinMad: null,
    amountMaxMad: 1_000_000,
    sourceUrl: "https://www.tamwilcom.ma/fr/example",
    applicationUrl: null,
    rules: {
      kind: "criterion",
      id: "young",
      field: "company_age_months",
      op: "lte",
      value: 60,
      reason,
    },
    documents: [{ id: "rc", label: { fr: "RC", ar: "السجل", en: "Register" } }],
    content: {
      fr: { title: "Exemple", summary: "Résumé" },
      ar: { title: "مثال", summary: "ملخص" },
      en: { title: "Example", summary: "Summary" },
    },
  },
  watches: [{ url: "https://www.tamwilcom.ma/fr/example", cssSelector: null }],
  goldenProfiles: [
    { name: "young", profile: { company_age_months: 12 }, expected: "eligible" },
    {
      name: "old",
      profile: { company_age_months: 120 },
      expected: "ineligible",
      expectedFailing: ["young"],
    },
    {
      name: "unknown",
      profile: {},
      expected: "needs_info",
      expectedMissing: ["company_age_months"],
    },
  ],
  ...overrides,
});
