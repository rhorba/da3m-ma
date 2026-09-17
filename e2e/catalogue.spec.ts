import { expect, test } from "@playwright/test";

/**
 * The catalogue page and the crawl surface (Stories 4.1 and 4.2).
 * Runs against the fixture catalogue published by `pnpm e2e:seed`.
 */

test.describe("catalogue", () => {
  test("lists every published programme", async ({ page }) => {
    await page.goto("/fr/programmes");

    await expect(page.getByRole("heading", { name: "Subvention numérique (test)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prêt rural (test)" })).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(4);
  });

  test("narrows the list by type of support, and clears again", async ({ page }) => {
    await page.goto("/fr/programmes");

    await page.getByLabel("Type d'aide").selectOption({ label: "Prêt" });
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Prêt rural (test)" })).toBeVisible();
    await expect(page.getByText("1 programme", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Effacer les filtres" }).click();
    await expect(page.getByRole("listitem")).toHaveCount(4);
  });

  test("says so when filters match nothing", async ({ page }) => {
    await page.goto("/fr/programmes");

    await page.getByLabel("Type d'aide").selectOption({ label: "Prêt" });
    await page.getByLabel("Statut").selectOption({ label: "Clôturé" });

    await expect(page.getByText("Aucun programme ne correspond à ces filtres.")).toBeVisible();
  });

  test("opens a programme from the list", async ({ page }) => {
    await page.goto("/fr/programmes");
    await page.getByRole("link", { name: /Subvention numérique/ }).click();

    await expect(page).toHaveURL(/\/fr\/programmes\/e2e-subvention-numerique/);
    await expect(page.getByRole("heading", { name: "Qui peut en bénéficier" })).toBeVisible();
  });
});

test.describe("crawl surface", () => {
  test("lists programmes in the sitemap, in every language", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);

    const xml = await response.text();
    expect(xml).toContain("/fr/programmes/e2e-subvention-numerique");
    expect(xml).toContain("/ar/programmes/e2e-subvention-numerique");
    expect(xml).toContain("/fr/eligibilite");
    expect(xml).toContain('hreflang="ar"');
  });

  test("keeps crawlers out of personal results", async ({ request }) => {
    const response = await request.get("/robots.txt");
    const text = await response.text();

    expect(text).toContain("Disallow: /fr/resultats/");
    expect(text).toContain("Disallow: /ar/resultats/");
    expect(text).toContain("Sitemap:");
  });
});
