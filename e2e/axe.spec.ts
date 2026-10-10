import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The automated half of the accessibility baseline (UI foundation §6, Story 4.7): an axe
 * sweep of every public page, in every locale, in both themes, against WCAG 2.2 AA.
 *
 * a11y.spec.ts keeps the checks axe cannot make (heading order, tap targets, focus).
 * Runs against the fixture catalogue published by `pnpm e2e:seed`.
 */

const LOCALES = ["fr", "ar", "en"] as const;
const THEMES = ["light", "dark"] as const;
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const PAGES = [
  { name: "home", path: "" },
  { name: "wizard", path: "/eligibilite" },
  { name: "catalogue", path: "/programmes" },
  { name: "programme", path: "/programmes/e2e-subvention-numerique" },
];

/** Keeps a failure readable: which rule, how bad, and the first few offending nodes. */
async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  return violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
}

/** Fills the five steps as a 12-month-old digital SARL; any report will do here. */
async function reachResults(page: Page) {
  await page.goto("/fr/eligibilite");
  await page.getByRole("radio", { name: "SARL", exact: true }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: "Numérique" }).check();
  await page.getByRole("radio", { name: "Casablanca-Settat" }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: "26 à 35 ans" }).check();
  await page.getByRole("radio", { name: "Non" }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel(/Depuis combien de mois/).fill("12");
  await page.getByRole("radio", { name: "1 à 9 salariés" }).check();
  await page.getByRole("radio", { name: "Moins de 1 million de DH" }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: "100 000 à 500 000 DH" }).check();
  await page.getByRole("checkbox", { name: "Innover, développer un produit" }).check();
  await page.getByRole("button", { name: "Voir mes résultats" }).click();
  await page.waitForURL(/\/fr\/resultats\//);
  return new URL(page.url()).pathname.replace(/^\/fr/, "");
}

for (const theme of THEMES) {
  test.describe(`axe, ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
    });

    for (const locale of LOCALES) {
      for (const { name, path } of PAGES) {
        test(`${name} (${locale}) has no WCAG AA violations`, async ({ page }) => {
          await page.goto(`/${locale}${path}`);
          expect(await violations(page)).toEqual([]);
        });
      }
    }
  });
}

// One wizard submit, then every locale and theme: the wizard is rate limited per IP
// (Story 3.6) and every test here shares localhost, so a submit per case would starve
// wizard.spec.ts of its budget.
test("results has no WCAG AA violations in any locale or theme", async ({ page }) => {
  const results = await reachResults(page);
  const found = [];
  for (const theme of THEMES) {
    await page.emulateMedia({ colorScheme: theme });
    for (const locale of LOCALES) {
      await page.goto(`/${locale}${results}`);
      found.push(...(await violations(page)).map((v) => ({ theme, locale, ...v })));
    }
  }
  expect(found).toEqual([]);
});
