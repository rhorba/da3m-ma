import { describe, expect, it } from "vitest";
import type { PublishedProgram } from "@/lib/catalog";
import type { Rule } from "@/lib/engine";
import { buildDigests, type DueSubscription } from "./digest";

const reason = { fr: "r", ar: "r", en: "r" };
const ruralOnly: Rule = {
  kind: "criterion",
  id: "rural",
  field: "is_rural",
  op: "is_true",
  reason,
};
const anyone: Rule = {
  kind: "criterion",
  id: "exists",
  field: "legal_form",
  op: "neq",
  value: "none",
  reason,
};

function program(slug: string, rules: Rule, publishedAt: string): PublishedProgram {
  return {
    programId: `p-${slug}`,
    programVersionId: `v-${slug}`,
    version: 2,
    slug,
    operator: "Tamwilcom",
    kind: "loan",
    status: "rolling",
    opensAt: null,
    closesAt: null,
    amountMinMad: null,
    amountMaxMad: null,
    content: { fr: { title: `Titre ${slug}`, summary: "" } },
    documents: [],
    sourceUrl: "https://www.tamwilcom.ma/x",
    applicationUrl: null,
    verifiedAt: "2026-10-01",
    publishedAt: new Date(publishedAt),
    rules,
  };
}

function subscription(over: Partial<DueSubscription> = {}): DueSubscription {
  return {
    id: "s1",
    email: "a@example.com",
    locale: "fr",
    profileData: { legal_form: "sarl", is_rural: false },
    since: new Date("2026-10-01T00:00:00Z"),
    ...over,
  };
}

const OLD = "2026-09-01T00:00:00Z";
const NEW = "2026-10-05T00:00:00Z";

describe("buildDigests", () => {
  it("reports only programmes published since the subscriber's last digest", () => {
    const digests = buildDigests(
      [subscription()],
      [program("old", anyone, OLD), program("fresh", anyone, NEW)],
    );
    expect(digests).toHaveLength(1);
    expect(digests[0]!.items.map((i) => i.slug)).toEqual(["fresh"]);
  });

  it("leaves out programmes the profile is not eligible for", () => {
    const digests = buildDigests([subscription()], [program("rural", ruralOnly, NEW)]);
    expect(digests).toEqual([]);
  });

  it("includes a programme one answer away, after the eligible ones", () => {
    const digests = buildDigests(
      [subscription({ profileData: { legal_form: "sarl" } })],
      [program("rural", ruralOnly, NEW), program("open", anyone, NEW)],
    );
    expect(digests[0]!.items.map((i) => [i.slug, i.outcome])).toEqual([
      ["open", "eligible"],
      ["rural", "needs_info"],
    ]);
  });

  it("sends one email per address, covering every subscription it has", () => {
    const digests = buildDigests(
      [
        subscription({ id: "s1", profileData: { legal_form: "sarl" } }),
        subscription({
          id: "s2",
          email: "A@Example.com",
          profileData: { legal_form: "sarl", is_rural: true },
        }),
      ],
      [program("rural", ruralOnly, NEW)],
    );
    expect(digests).toHaveLength(1);
    expect(digests[0]!.subscriptionIds).toEqual(["s1", "s2"]);
    // One profile needed more information, the other qualified: the better news wins.
    expect(digests[0]!.items).toMatchObject([{ slug: "rural", outcome: "eligible" }]);
  });

  it("skips a profile that no longer matches the schema instead of guessing", () => {
    const digests = buildDigests(
      [subscription({ profileData: { legal_form: "not-a-form" } })],
      [program("open", anyone, NEW)],
    );
    expect(digests).toEqual([]);
  });

  it("produces nothing when nothing is new", () => {
    expect(buildDigests([subscription()], [program("old", anyone, OLD)])).toEqual([]);
  });
});
