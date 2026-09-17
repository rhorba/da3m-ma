import { expect, test } from "@playwright/test";

// Story 1.5 — i18n routing skeleton.

test.describe("root redirect with an unsupported browser language", () => {
  test.use({ locale: "de-DE" });

  test("falls back to French", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });
});

test.describe("root redirect with an Arabic browser", () => {
  test.use({ locale: "ar-MA" });

  test("negotiates Arabic", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test("serves Arabic right-to-left with translated copy", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/الدعم العمومي/);
});

test("switching language keeps the page and flips direction", async ({ page }) => {
  await page.goto("/ar");
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/public funding/);
});

test("shows the non-affiliation note in every locale", async ({ page }) => {
  for (const locale of ["fr", "ar", "en"]) {
    await page.goto(`/${locale}`);
    await expect(page.getByTestId("non-affiliation")).toBeVisible();
  }
});

test("sends the baseline security headers", async ({ request }) => {
  const response = await request.get("/fr");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});

test("unknown locales are not served", async ({ page }) => {
  const response = await page.goto("/de");
  expect(response?.status()).toBe(404);
});
