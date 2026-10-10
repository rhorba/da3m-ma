import { describe, expect, it, vi } from "vitest";
import type { Actor } from "@/lib/auth";
import type { CatalogueReadRepository, PublishedProgram } from "@/lib/catalog";
import type { Mailer, OutgoingEmail } from "./mailer";
import type { AlertsRepository, SubscribeResult } from "./repository";
import { createAlertsDigestHandler, subscribeToAlerts } from "./service";
import { verifyAlertToken } from "./tokens";

const SECRET = "s3cret";
const NOW = new Date("2026-10-10T08:00:00Z");
const USER: Actor = { kind: "user", userId: "user_1" };
const SUB_ID = "3f1c2a9e-7b4d-4c1a-9e2f-8a7b6c5d4e3f";

function fakeMailer() {
  const sent: OutgoingEmail[] = [];
  const mailer: Mailer = {
    send: vi.fn(async (email: OutgoingEmail) => {
      sent.push(email);
    }),
  };
  return { mailer, sent };
}

function fakeAlerts(over: Partial<AlertsRepository> = {}): AlertsRepository {
  return {
    subscribe: vi.fn(async (): Promise<SubscribeResult> => ({
      kind: "pending",
      subscriptionId: SUB_ID,
      email: "a@example.com",
    })),
    status: vi.fn(async () => null),
    confirm: vi.fn(async () => true),
    unsubscribe: vi.fn(async () => true),
    listDue: vi.fn(async () => []),
    markDigested: vi.fn(async () => {}),
    ...over,
  };
}

describe("subscribeToAlerts", () => {
  it("sends an opt-in whose link confirms this subscription", async () => {
    const { mailer, sent } = fakeMailer();
    const outcome = await subscribeToAlerts(
      { alerts: fakeAlerts(), mailer, secret: SECRET },
      USER,
      { email: " A@example.com ", locale: "fr", now: NOW },
    );

    expect(outcome).toEqual({ ok: true, state: "pending", email: "a@example.com" });
    expect(sent).toHaveLength(1);
    const token = decodeURIComponent(sent[0]!.text.match(/\?t=(\S+)/)![1]!);
    expect(verifyAlertToken(token, "confirm", SECRET, NOW)?.subscriptionId).toBe(SUB_ID);
  });

  it("does not email someone already subscribed", async () => {
    const { mailer, sent } = fakeMailer();
    const alerts = fakeAlerts({
      subscribe: vi.fn(async (): Promise<SubscribeResult> => ({ kind: "active", email: "a@x.ma" })),
    });
    const outcome = await subscribeToAlerts({ alerts, mailer, secret: SECRET }, USER, {
      email: "a@x.ma",
      locale: "fr",
      now: NOW,
    });
    expect(outcome).toEqual({ ok: true, state: "active", email: "a@x.ma" });
    expect(sent).toEqual([]);
  });

  it.each(["no_profile", "rate_limited"] as const)(
    "passes %s through without sending",
    async (kind) => {
      const { mailer, sent } = fakeMailer();
      const alerts = fakeAlerts({
        subscribe: vi.fn(async (): Promise<SubscribeResult> => ({ kind })),
      });
      const outcome = await subscribeToAlerts({ alerts, mailer, secret: SECRET }, USER, {
        email: "a@x.ma",
        locale: "fr",
        now: NOW,
      });
      expect(outcome).toEqual({ ok: false, error: kind });
      expect(sent).toEqual([]);
    },
  );

  it("refuses an invalid address before touching the database", async () => {
    const alerts = fakeAlerts();
    const outcome = await subscribeToAlerts(
      { alerts, mailer: fakeMailer().mailer, secret: SECRET },
      USER,
      { email: "not-an-email", locale: "fr", now: NOW },
    );
    expect(outcome).toEqual({ ok: false, error: "invalid_email" });
    expect(alerts.subscribe).not.toHaveBeenCalled();
  });

  it("is unavailable until email and signing are configured", async () => {
    const alerts = fakeAlerts();
    expect(
      await subscribeToAlerts({ alerts, mailer: null, secret: SECRET }, USER, {
        email: "a@x.ma",
        locale: "fr",
        now: NOW,
      }),
    ).toEqual({ ok: false, error: "unavailable" });
    expect(
      await subscribeToAlerts({ alerts, mailer: fakeMailer().mailer, secret: undefined }, USER, {
        email: "a@x.ma",
        locale: "fr",
        now: NOW,
      }),
    ).toEqual({ ok: false, error: "unavailable" });
  });
});

const program: PublishedProgram = {
  programId: "p1",
  programVersionId: "v1",
  version: 1,
  slug: "damane-express",
  operator: "Tamwilcom",
  kind: "guarantee",
  status: "rolling",
  opensAt: null,
  closesAt: null,
  amountMinMad: null,
  amountMaxMad: null,
  content: { fr: { title: "Damane Express", summary: "" } },
  documents: [],
  sourceUrl: "https://www.tamwilcom.ma/x",
  applicationUrl: null,
  verifiedAt: "2026-10-10",
  publishedAt: new Date("2026-10-09T00:00:00Z"),
  rules: {
    kind: "criterion",
    id: "exists",
    field: "legal_form",
    op: "neq",
    value: "none",
    reason: { fr: "r", ar: "r", en: "r" },
  },
};

const catalogue = {
  listPublished: vi.fn(async () => [program]),
  findPublishedBySlug: vi.fn(async () => null),
} as unknown as CatalogueReadRepository;

const due = [
  {
    id: SUB_ID,
    email: "a@example.com",
    locale: "fr",
    profileData: { legal_form: "sarl" },
    since: new Date("2026-10-01T00:00:00Z"),
  },
];

const authorised = () =>
  new Request("https://da3m.ma/api/cron/alerts", { headers: { authorization: "Bearer cron" } });

describe("alerts digest cron", () => {
  it("refuses a caller without the cron secret", async () => {
    const handler = createAlertsDigestHandler({
      alerts: fakeAlerts(),
      catalogue,
      mailer: fakeMailer().mailer,
      cronSecret: "cron",
      signingSecret: SECRET,
      now: () => NOW,
    });
    const response = await handler(new Request("https://da3m.ma/api/cron/alerts"));
    expect(response.status).toBe(401);
  });

  it("answers 503 rather than pretending to send when email is not configured", async () => {
    const handler = createAlertsDigestHandler({
      alerts: fakeAlerts(),
      catalogue,
      mailer: null,
      cronSecret: "cron",
      signingSecret: SECRET,
      now: () => NOW,
    });
    expect((await handler(authorised())).status).toBe(503);
  });

  it("sends each digest with an unsubscribe link that works, and marks it sent", async () => {
    const { mailer, sent } = fakeMailer();
    const alerts = fakeAlerts({ listDue: vi.fn(async () => due) });
    const handler = createAlertsDigestHandler({
      alerts,
      catalogue,
      mailer,
      cronSecret: "cron",
      signingSecret: SECRET,
      now: () => NOW,
    });

    const response = await handler(authorised());
    expect(await response.json()).toEqual({ due: 1, sent: 1, failed: 0 });
    expect(sent[0]!.text).toContain("Damane Express");
    const token = decodeURIComponent(sent[0]!.text.match(/desinscription\?t=(\S+)/)![1]!);
    expect(verifyAlertToken(token, "unsubscribe", SECRET, new Date("2030-01-01"))).not.toBeNull();
    expect(alerts.markDigested).toHaveBeenCalledWith([SUB_ID], NOW);
  });

  it("does not mark a digest sent when sending fails, so tomorrow retries it", async () => {
    const mailer: Mailer = {
      send: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const alerts = fakeAlerts({ listDue: vi.fn(async () => due) });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createAlertsDigestHandler({
      alerts,
      catalogue,
      mailer,
      cronSecret: "cron",
      signingSecret: SECRET,
      now: () => NOW,
    });

    expect(await (await handler(authorised())).json()).toEqual({ due: 1, sent: 0, failed: 1 });
    expect(alerts.markDigested).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
