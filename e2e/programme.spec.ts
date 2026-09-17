import { expect, test } from "@playwright/test";

/**
 * Programme pages (Stories 4.1 and 4.5): what a search engine and an applicant each get.
 * Runs against the fixture catalogue published by `pnpm e2e:seed`.
 */

const SLUG = "e2e-subvention-numerique";
const TITLE = "Subvention numérique (test)";

test.describe("programme page", () => {
  test("shows what the programme is, who qualifies and what to bring", async ({ page }) => {
    await page.goto(`/fr/programmes/${SLUG}`);

    await expect(page.getByRole("heading", { name: TITLE, level: 1 })).toBeVisible();
    await expect(page.getByText("Organisme de test")).toBeVisible();
    await expect(page.getByText("Jusqu'à 500.000 MAD")).toBeVisible();

    // The criteria are the engine's own rule reasons, not separately written copy.
    const criteria = page.getByRole("heading", { name: "Qui peut en bénéficier" }).locator("..");
    await expect(criteria.getByText("Réservé aux sociétés constituées")).toBeVisible();
    await expect(criteria.getByText("Réservé au numérique et aux services")).toBeVisible();

    const documents = page.getByRole("heading", { name: "Pièces à préparer" }).locator("..");
    await expect(documents.getByText("Registre de commerce")).toBeVisible();
    await expect(documents.getByText("Business plan sur 3 ans")).toBeVisible();
  });

  test("sends visitors into the questionnaire", async ({ page }) => {
    await page.goto(`/fr/programmes/${SLUG}`);
    await page.getByRole("link", { name: "Vérifier mon éligibilité" }).click();

    await expect(page).toHaveURL(/\/fr\/eligibilite/);
  });

  test("describes itself to search engines", async ({ page }) => {
    await page.goto(`/fr/programmes/${SLUG}`);

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    const parsed = JSON.parse(jsonLd ?? "{}");
    expect(parsed).toMatchObject({
      "@type": "GovernmentService",
      name: TITLE,
      provider: { name: "Organisme de test" },
      areaServed: { name: "Morocco" },
    });

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/fr\/programmes\//,
    );
  });

  test("offers itself in all three languages", async ({ page }) => {
    await page.goto(`/fr/programmes/${SLUG}`);

    const hreflangs = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((links) => links.map((l) => l.getAttribute("hreflang")));
    expect(hreflangs.sort()).toEqual(["ar", "en", "fr", "x-default"]);
  });

  test("reads right to left in Arabic", async ({ page }) => {
    await page.goto(`/ar/programmes/${SLUG}`);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "منحة رقمية (اختبار)", level: 1 }),
    ).toBeVisible();
  });

  test("404s for a programme that is not published", async ({ page }) => {
    const response = await page.goto("/fr/programmes/pas-encore-verifie");
    expect(response?.status()).toBe(404);
  });
});
