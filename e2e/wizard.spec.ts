import { expect, test, type Page } from "@playwright/test";

/**
 * The path a visitor actually takes: five questions, a ranked report, then one inline
 * answer that changes the outcome (Stories 3.4 and 3.5).
 *
 * Runs against the fixture catalogue published by `pnpm e2e:seed`.
 */

const ELIGIBLE = "Subvention numérique (test)";
const NEEDS_INFO = "Prêt rural (test)";

async function continueStep(page: Page) {
  await page.getByRole("button", { name: "Continuer" }).click();
}

/** Fills the five steps as a 12-month-old digital SARL in Casablanca. */
async function fillWizard(page: Page) {
  await page.goto("/fr/eligibilite");

  await page.getByRole("radio", { name: "SARL", exact: true }).check();
  await continueStep(page);

  await page.getByRole("radio", { name: "Numérique" }).check();
  await page.getByRole("radio", { name: "Casablanca-Settat" }).check();
  await continueStep(page);

  await page.getByRole("radio", { name: "26 à 35 ans" }).check();
  await page.getByRole("radio", { name: "Non" }).check();
  await continueStep(page);

  await page.getByLabel(/Depuis combien de mois/).fill("12");
  await page.getByRole("radio", { name: "1 à 9 salariés" }).check();
  await page.getByRole("radio", { name: "Moins de 1 million de DH" }).check();
  await continueStep(page);

  await page.getByRole("radio", { name: "100 000 à 500 000 DH" }).check();
  await page.getByRole("checkbox", { name: "Innover, développer un produit" }).check();
  await page.getByRole("button", { name: "Voir mes résultats" }).click();

  await page.waitForURL(/\/fr\/resultats\//);
}

test.describe("wizard", () => {
  test("shows the step in the URL and skips the company step for an idea", async ({ page }) => {
    await page.goto("/fr/eligibilite");
    await expect(page.getByText("Étape 1 sur 5")).toBeVisible();

    await page.getByRole("radio", { name: "Je n'ai pas encore créé mon entreprise" }).check();
    await continueStep(page);

    await expect(page).toHaveURL(/etape=project/);
    // Four steps instead of five: a project that does not exist has no size.
    await expect(page.getByText("Étape 2 sur 4")).toBeVisible();
  });

  test("keeps answers when the page is reloaded", async ({ page }) => {
    await page.goto("/fr/eligibilite");
    await page.getByRole("radio", { name: "Coopérative" }).check();
    await continueStep(page);

    await page.reload();
    await page.goto("/fr/eligibilite?etape=situation");
    await expect(page.getByRole("radio", { name: "Coopérative" })).toBeChecked();
  });
});

test.describe("results", () => {
  test("groups programmes by outcome, best first", async ({ page }) => {
    await fillWizard(page);

    await expect(page.getByRole("heading", { name: "Vos résultats" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Vous êtes éligible/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: ELIGIBLE })).toBeVisible();
    await expect(page.getByRole("heading", { name: NEEDS_INFO })).toBeVisible();

    // Ineligible programmes are collapsed, not hidden: they are information, not failure.
    const industry = page.getByRole("heading", { name: "Appui industrie (test)" });
    await expect(industry).toBeHidden();
    await page.locator("details > summary").click();
    await expect(industry).toBeVisible();
  });

  test("states that the site is not a government platform", async ({ page }) => {
    await fillWizard(page);
    await expect(page.getByTestId("non-affiliation")).toBeVisible();
  });

  test("answering the inline question moves the programme to eligible", async ({ page }) => {
    await fillWizard(page);
    const before = page.url();

    const question = page.getByRole("group", { name: /milieu rural/ });
    await expect(question).toBeVisible();
    await question.getByRole("radio", { name: "Oui" }).check();

    // A new report is written and swapped in; the visitor stays on the results page.
    await expect(page).not.toHaveURL(before);
    await expect(page).toHaveURL(/\/fr\/resultats\//);
    await expect(page.getByRole("group", { name: /milieu rural/ })).toHaveCount(0);

    const eligible = page.getByRole("heading", { name: /Vous êtes éligible/ }).locator("..");
    await expect(eligible.getByRole("heading", { name: NEEDS_INFO })).toBeVisible();
  });

  test("hides a report from a visitor who does not own it", async ({ page, context }) => {
    await fillWizard(page);
    const url = page.url();

    await context.clearCookies();
    const response = await page.goto(url);
    expect(response?.status()).toBe(404);
  });
});
