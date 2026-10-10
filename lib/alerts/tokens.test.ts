import { describe, expect, it } from "vitest";
import { createAlertToken, verifyAlertToken } from "./tokens";

const SECRET = "test-secret";
const ID = "3f1c2a9e-7b4d-4c1a-9e2f-8a7b6c5d4e3f";
const NOW = new Date("2026-10-10T08:00:00Z");
const nowSeconds = NOW.getTime() / 1000;

describe("alert tokens", () => {
  it("round-trips a confirm token before it expires", () => {
    const token = createAlertToken(
      { subscriptionId: ID, purpose: "confirm", expiresAt: nowSeconds + 60 },
      SECRET,
    );
    expect(verifyAlertToken(token, "confirm", SECRET, NOW)).toEqual({
      subscriptionId: ID,
      purpose: "confirm",
      expiresAt: nowSeconds + 60,
    });
  });

  it("keeps an unsubscribe token valid indefinitely", () => {
    const token = createAlertToken(
      { subscriptionId: ID, purpose: "unsubscribe", expiresAt: null },
      SECRET,
    );
    const muchLater = new Date("2036-01-01T00:00:00Z");
    expect(verifyAlertToken(token, "unsubscribe", SECRET, muchLater)?.subscriptionId).toBe(ID);
  });

  it("rejects an expired confirm token", () => {
    const token = createAlertToken(
      { subscriptionId: ID, purpose: "confirm", expiresAt: nowSeconds - 1 },
      SECRET,
    );
    expect(verifyAlertToken(token, "confirm", SECRET, NOW)).toBeNull();
  });

  it("never lets a confirm link act as an unsubscribe, or the reverse", () => {
    const confirm = createAlertToken(
      { subscriptionId: ID, purpose: "confirm", expiresAt: nowSeconds + 60 },
      SECRET,
    );
    const unsubscribe = createAlertToken(
      { subscriptionId: ID, purpose: "unsubscribe", expiresAt: null },
      SECRET,
    );
    expect(verifyAlertToken(confirm, "unsubscribe", SECRET, NOW)).toBeNull();
    expect(verifyAlertToken(unsubscribe, "confirm", SECRET, NOW)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createAlertToken(
      { subscriptionId: ID, purpose: "unsubscribe", expiresAt: null },
      "other-secret",
    );
    expect(verifyAlertToken(token, "unsubscribe", SECRET, NOW)).toBeNull();
  });

  it("rejects a token whose subscription id was swapped", () => {
    const token = createAlertToken(
      { subscriptionId: ID, purpose: "unsubscribe", expiresAt: null },
      SECRET,
    );
    const forged = token.replace(ID, "00000000-0000-4000-8000-000000000000");
    expect(verifyAlertToken(forged, "unsubscribe", SECRET, NOW)).toBeNull();
  });

  it.each(["", "garbage", "a.b.c", "a.b.c.d.e", `unsubscribe.not-a-uuid.-.sig`])(
    "rejects malformed input %j",
    (token) => {
      expect(verifyAlertToken(token, "unsubscribe", SECRET, NOW)).toBeNull();
    },
  );

  it("rejects a correctly signed token whose id is not a uuid", () => {
    const token = createAlertToken(
      { subscriptionId: "not-a-uuid", purpose: "unsubscribe", expiresAt: null },
      SECRET,
    );
    expect(verifyAlertToken(token, "unsubscribe", SECRET, NOW)).toBeNull();
  });
});
