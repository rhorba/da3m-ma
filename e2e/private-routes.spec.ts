import { expect, test } from "@playwright/test";

/**
 * How the signed-in area behaves for someone who is not signed in (Story 4.3).
 *
 * `auth.protect()` answers an unauthenticated page request with 404 when it cannot
 * resolve a sign-in URL, which tells a visitor their own space does not exist. The
 * middleware redirects explicitly instead, and this pins that.
 *
 * Needs Clerk configured: without a secret key the middleware cannot run at all, so the
 * suite skips rather than asserting something it cannot mean.
 */

const CLERK_CONFIGURED = Boolean(process.env.CLERK_SECRET_KEY);

test.describe("signed-in area", () => {
  test.skip(!CLERK_CONFIGURED, "CLERK_SECRET_KEY is not set");

  test.use({ ignoreHTTPSErrors: true });

  for (const locale of ["fr", "ar", "en"]) {
    test(`sends a signed-out visitor to sign in, not to a 404 (${locale})`, async ({ request }) => {
      const response = await request.get(`/${locale}/mon-espace`, { maxRedirects: 0 });

      expect(response.status()).toBe(307);
      const location = response.headers()["location"] ?? "";
      expect(location).toContain("/sign-in");
      // And it remembers where they were going.
      expect(decodeURIComponent(location)).toContain(`/${locale}/mon-espace`);
    });
  }

  test("leaves the public surface alone", async ({ request }) => {
    for (const path of ["/fr", "/fr/eligibilite", "/fr/programmes"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([path, response.status()]).toEqual([path, 200]);
    }
  });
});
