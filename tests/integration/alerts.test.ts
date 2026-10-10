import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { CONFIRMATIONS_PER_DAY, createAlertsRepository, DIGEST_INTERVAL_MS } from "@/lib/alerts";
import { AccessDeniedError, type Actor } from "@/lib/auth";
import { alertSubscriptions } from "@/lib/db/schema";
import { createProfilesRepository } from "@/lib/profiles";
import { connectTestDatabase, uniqueId } from "./helpers";

// Story 4.4 — double opt-in, one-address unsubscribe, and the digest's view of who is due.

const db = connectTestDatabase();
const alerts = createAlertsRepository(db);
const profiles = createProfilesRepository(db);

const NOW = new Date("2026-10-10T08:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

const user = (): Extract<Actor, { kind: "user" }> => ({ kind: "user", userId: uniqueId("user") });
const email = () => `${uniqueId("a")}@example.com`;

async function subscribedUser(data: Record<string, unknown> = { legal_form: "sarl" }) {
  const account = user();
  await profiles.saveProfile(account, data);
  return account;
}

async function pending(account: Actor, address = email()) {
  const result = await alerts.subscribe(account, { email: address, locale: "ar", now: NOW });
  if (result.kind !== "pending") throw new Error(`expected pending, got ${result.kind}`);
  return result;
}

describe("subscribing", () => {
  it("creates a pending subscription for the user's latest profile, address normalised", async () => {
    const account = await subscribedUser();
    const address = email();
    const result = await pending(account, `  ${address.toUpperCase()} `);

    expect(result.email).toBe(address);
    expect(await alerts.status(account)).toEqual({ email: address, state: "pending" });
  });

  it("needs a saved profile to follow", async () => {
    expect(await alerts.subscribe(user(), { email: email(), locale: "fr", now: NOW })).toEqual({
      kind: "no_profile",
    });
  });

  it("is only for signed-in users", async () => {
    await expect(
      alerts.subscribe(
        { kind: "anonymous", tokenHash: "x" },
        { email: email(), locale: "fr", now: NOW },
      ),
    ).rejects.toThrow(AccessDeniedError);
  });

  it(`caps opt-in emails at ${CONFIRMATIONS_PER_DAY} per address per day`, async () => {
    const address = email();
    for (let i = 0; i < CONFIRMATIONS_PER_DAY; i++) {
      expect(
        (await alerts.subscribe(await subscribedUser(), { email: address, locale: "fr", now: NOW }))
          .kind,
      ).toBe("pending");
    }
    const blocked = await alerts.subscribe(await subscribedUser(), {
      email: address,
      locale: "fr",
      now: NOW,
    });
    expect(blocked).toEqual({ kind: "rate_limited" });

    // A day later the address can ask again.
    const nextDay = await alerts.subscribe(await subscribedUser(), {
      email: address,
      locale: "fr",
      now: later(25 * 60 * 60 * 1000),
    });
    expect(nextDay.kind).toBe("pending");
  });

  it("does not re-send to an address that is already confirmed", async () => {
    const account = await subscribedUser();
    const { subscriptionId, email: address } = await pending(account);
    await alerts.confirm(subscriptionId, NOW);

    expect(await alerts.subscribe(account, { email: address, locale: "fr", now: NOW })).toEqual({
      kind: "active",
      email: address,
    });
  });
});

describe("confirming and unsubscribing", () => {
  it("confirms once, and confirming again changes nothing", async () => {
    const account = await subscribedUser();
    const { subscriptionId } = await pending(account);

    expect(await alerts.confirm(subscriptionId, NOW)).toBe(true);
    expect(await alerts.confirm(subscriptionId, later(1000))).toBe(true);

    const [row] = await db
      .select()
      .from(alertSubscriptions)
      .where(eq(alertSubscriptions.id, subscriptionId));
    expect(row?.confirmedAt?.toISOString()).toBe(NOW.toISOString());
    expect((await alerts.status(account))?.state).toBe("active");
  });

  it("stops every subscription for the address, across profiles", async () => {
    const address = email();
    const first = await pending(await subscribedUser(), address);
    const second = await pending(await subscribedUser(), address);
    await alerts.confirm(first.subscriptionId, NOW);
    await alerts.confirm(second.subscriptionId, NOW);

    expect(await alerts.unsubscribe(first.subscriptionId, NOW)).toBe(true);

    const rows = await db
      .select()
      .from(alertSubscriptions)
      .where(eq(alertSubscriptions.email, address));
    expect(rows.every((r) => r.unsubscribedAt !== null)).toBe(true);
  });

  it("cannot confirm a subscription that was withdrawn", async () => {
    const { subscriptionId } = await pending(await subscribedUser());
    await alerts.unsubscribe(subscriptionId, NOW);
    expect(await alerts.confirm(subscriptionId, NOW)).toBe(false);
  });

  it("needs a fresh confirmation to come back after leaving", async () => {
    const account = await subscribedUser();
    const { subscriptionId, email: address } = await pending(account);
    await alerts.confirm(subscriptionId, NOW);
    await alerts.unsubscribe(subscriptionId, NOW);

    const again = await alerts.subscribe(account, { email: address, locale: "fr", now: NOW });
    expect(again.kind).toBe("pending");
    expect((await alerts.status(account))?.state).toBe("pending");
  });

  it("answers false for a subscription that does not exist", async () => {
    const missing = "00000000-0000-4000-8000-000000000000";
    expect(await alerts.unsubscribe(missing, NOW)).toBe(false);
    expect(await alerts.confirm(missing, NOW)).toBe(false);
  });
});

describe("who the digest is due for", () => {
  it("lists confirmed subscriptions with their profile, from confirmation onwards", async () => {
    const account = await subscribedUser({ legal_form: "sa", is_rural: true });
    const { subscriptionId } = await pending(account);
    expect((await alerts.listDue(NOW)).some((d) => d.id === subscriptionId)).toBe(false);

    await alerts.confirm(subscriptionId, NOW);
    const due = (await alerts.listDue(NOW)).find((d) => d.id === subscriptionId);
    expect(due).toMatchObject({
      locale: "ar",
      profileData: { legal_form: "sa", is_rural: true },
      since: NOW,
    });
  });

  it("waits a day after a digest, then reports changes since that digest", async () => {
    const { subscriptionId } = await pending(await subscribedUser());
    await alerts.confirm(subscriptionId, NOW);
    await alerts.markDigested([subscriptionId], NOW);

    const soon = later(DIGEST_INTERVAL_MS - 60_000);
    expect((await alerts.listDue(soon)).some((d) => d.id === subscriptionId)).toBe(false);

    const tomorrow = later(24 * 60 * 60 * 1000);
    const due = (await alerts.listDue(tomorrow)).find((d) => d.id === subscriptionId);
    expect(due?.since.toISOString()).toBe(NOW.toISOString());
  });

  it("drops anyone who unsubscribed", async () => {
    const { subscriptionId } = await pending(await subscribedUser());
    await alerts.confirm(subscriptionId, NOW);
    await alerts.unsubscribe(subscriptionId, NOW);
    expect((await alerts.listDue(later(60_000))).some((d) => d.id === subscriptionId)).toBe(false);
  });

  it("does nothing when asked to mark no subscriptions", async () => {
    await expect(alerts.markDigested([], NOW)).resolves.toBeUndefined();
  });
});
