import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createAlertToken } from "../lib/alerts/tokens";
import { E2E_ALERTS } from "./fixtures/alerts";

/**
 * The pages behind the links in alert emails (Story 4.4), against subscriptions that
 * `pnpm e2e:seed` puts in known states. Tokens are signed here with the server's secret,
 * exactly as the cron and the subscribe action sign them.
 */

const SECRET = process.env.ALERTS_SIGNING_SECRET ?? "";

const token = (purpose: "confirm" | "unsubscribe", subscriptionId: string) =>
  createAlertToken(
    {
      subscriptionId,
      purpose,
      expiresAt: purpose === "confirm" ? Math.floor(Date.now() / 1000) + 3600 : null,
    },
    SECRET,
  );

test.describe("alert email links", () => {
  test.skip(!SECRET, "ALERTS_SIGNING_SECRET is not set");

  test("confirming takes a button press, then says so", async ({ page }) => {
    await page.goto(`/fr/alertes/confirmer?t=${token("confirm", E2E_ALERTS.pendingId)}`);
    // Opening the link alone must change nothing: mail scanners open links.
    await expect(page.getByRole("status")).toHaveCount(0);

    await page.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByRole("status")).toContainText("C'est confirmé");
  });

  test("unsubscribing works from the page, in Arabic", async ({ page }) => {
    await page.goto(`/ar/alertes/desinscription?t=${token("unsubscribe", E2E_ALERTS.activeId)}`);
    await page.getByRole("button", { name: "إلغاء الاشتراك" }).click();
    await expect(page.getByRole("status")).toContainText("تم ذلك");
  });

  test("a tampered link is refused without a button to press", async ({ page }) => {
    const forged = token("unsubscribe", E2E_ALERTS.activeId).replace(/.$/, "x");
    await page.goto(`/fr/alertes/desinscription?t=${forged}`);
    await page.getByRole("button", { name: "Me désinscrire" }).click();
    await expect(page.getByRole("status")).toContainText("Ce lien n'est pas valide");
  });

  test("a confirm link cannot be used to unsubscribe", async ({ page }) => {
    await page.goto(`/en/alertes/desinscription?t=${token("confirm", E2E_ALERTS.activeId)}`);
    await page.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(page.getByRole("status")).toContainText("This link isn't valid");
  });

  test("mail clients can unsubscribe in one click (RFC 8058)", async ({ request }) => {
    const ok = await request.post(
      `/api/alerts/unsubscribe?t=${token("unsubscribe", E2E_ALERTS.activeId)}`,
      { data: "List-Unsubscribe=One-Click" },
    );
    expect(ok.status()).toBe(204);

    const bad = await request.post("/api/alerts/unsubscribe?t=nope");
    expect(bad.status()).toBe(400);
  });

  test("a client that opens the header link gets the page instead", async ({ request }) => {
    const response = await request.get("/api/alerts/unsubscribe?t=abc", { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toContain("/fr/alertes/desinscription?t=abc");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`the link pages have no WCAG AA violations (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      for (const path of [
        `/fr/alertes/confirmer?t=${token("confirm", E2E_ALERTS.pendingId)}`,
        `/ar/alertes/desinscription?t=${token("unsubscribe", E2E_ALERTS.activeId)}`,
      ]) {
        await page.goto(path);
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect([path, violations.map((v) => v.id)]).toEqual([path, []]);
      }
    });
  }
});
