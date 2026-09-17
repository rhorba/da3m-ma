import { describe, expect, it } from "vitest";
import { getWizardRateLimiter, WIZARD_SUBMIT_WINDOW } from "./index";

describe("getWizardRateLimiter", () => {
  it("returns one limiter per process, so hits accumulate across requests", async () => {
    expect(getWizardRateLimiter()).toBe(getWizardRateLimiter());
  });

  it("counts a submission against the key it is given", async () => {
    const decision = await getWizardRateLimiter().limit(["test-key"]);

    expect(decision).toMatchObject({
      allowed: true,
      limit: WIZARD_SUBMIT_WINDOW.limit,
      remaining: WIZARD_SUBMIT_WINDOW.limit - 1,
    });
  });
});
