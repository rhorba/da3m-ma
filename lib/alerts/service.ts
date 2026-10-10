import { z } from "zod";
import type { Actor } from "@/lib/auth";
import type { CatalogueReadRepository } from "@/lib/catalog";
import { isAuthorizedCron } from "@/lib/curation";
import { buildDigests } from "./digest";
import { confirmationEmail, digestEmail } from "./emails";
import type { Mailer } from "./mailer";
import type { AlertsRepository } from "./repository";
import { CONFIRM_TTL_SECONDS, createAlertToken } from "./tokens";

/**
 * The two things alerts do (Story 4.4), with every dependency injected so both run in
 * tests without a provider: subscribe-and-send-the-opt-in, and the daily digest.
 */

export type SubscribeOutcome =
  | { ok: true; state: "pending" | "active"; email: string }
  | { ok: false; error: "invalid_email" | "rate_limited" | "no_profile" | "unavailable" };

const emailSchema = z.email().max(254);

export async function subscribeToAlerts(
  deps: { alerts: AlertsRepository; mailer: Mailer | null; secret: string | undefined },
  actor: Actor,
  input: { email: string; locale: string; now: Date },
): Promise<SubscribeOutcome> {
  // Without a way to send or sign, a subscription could never be confirmed.
  if (!deps.mailer || !deps.secret) return { ok: false, error: "unavailable" };
  if (!emailSchema.safeParse(input.email.trim()).success) {
    return { ok: false, error: "invalid_email" };
  }

  const result = await deps.alerts.subscribe(actor, input);
  if (result.kind === "no_profile" || result.kind === "rate_limited") {
    return { ok: false, error: result.kind };
  }
  if (result.kind === "active") return { ok: true, state: "active", email: result.email };

  const token = createAlertToken(
    {
      subscriptionId: result.subscriptionId,
      purpose: "confirm",
      expiresAt: Math.floor(input.now.getTime() / 1000) + CONFIRM_TTL_SECONDS,
    },
    deps.secret,
  );
  await deps.mailer.send(
    confirmationEmail({ to: result.email, locale: input.locale, confirmToken: token }),
  );
  return { ok: true, state: "pending", email: result.email };
}

export type DigestSummary = { due: number; sent: number; failed: number };

export function createAlertsDigestHandler(deps: {
  alerts: AlertsRepository;
  catalogue: CatalogueReadRepository;
  mailer: Mailer | null;
  cronSecret: string | undefined;
  signingSecret: string | undefined;
  now: () => Date;
}) {
  return async function handle(request: Request): Promise<Response> {
    const requestId = `req_${crypto.randomUUID()}`;
    if (!isAuthorizedCron(request, deps.cronSecret)) {
      return Response.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid cron credentials.",
            request_id: requestId,
          },
        },
        { status: 401 },
      );
    }
    if (!deps.mailer || !deps.signingSecret) {
      return Response.json(
        {
          error: {
            code: "NOT_CONFIGURED",
            message: "Email is not configured.",
            request_id: requestId,
          },
        },
        { status: 503 },
      );
    }

    const now = deps.now();
    const due = await deps.alerts.listDue(now);
    const digests = buildDigests(due, await deps.catalogue.listPublished());

    const summary: DigestSummary = { due: due.length, sent: 0, failed: 0 };
    for (const digest of digests) {
      const unsubscribeToken = createAlertToken(
        { subscriptionId: digest.subscriptionIds[0]!, purpose: "unsubscribe", expiresAt: null },
        deps.signingSecret,
      );
      try {
        await deps.mailer.send(
          digestEmail({
            to: digest.email,
            locale: digest.locale,
            items: digest.items,
            unsubscribeToken,
          }),
        );
        // Marked only once sent: a failed send is retried by tomorrow's run.
        await deps.alerts.markDigested(digest.subscriptionIds, now);
        summary.sent++;
      } catch (error) {
        // One bad address must not stop everyone else's digest.
        console.error("Alert digest failed", { requestId, error: String(error) });
        summary.failed++;
      }
    }

    return Response.json(summary);
  };
}
