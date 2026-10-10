"use server";

import { getAlertsRepository, getMailer, subscribeToAlerts, verifyAlertToken } from "@/lib/alerts";
import type { SubscribeOutcome } from "@/lib/alerts";
import { getActor } from "@/lib/session";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * Alerts' three writes (Story 4.4). Subscribing happens in /mon-espace, signed in.
 * Confirming and unsubscribing come from email links and need no session: the signed
 * token is the proof. Both are a button press rather than the link itself, because
 * mail scanners open links, and a scanner must not confirm or cancel anyone.
 */

export async function subscribeAlerts(
  locale: AppLocale,
  _previous: SubscribeOutcome | null,
  form: FormData,
): Promise<SubscribeOutcome> {
  const actor = await getActor();
  if (!actor || actor.kind !== "user") return { ok: false, error: "unavailable" };

  return subscribeToAlerts(
    {
      alerts: getAlertsRepository(),
      mailer: getMailer(),
      secret: process.env.ALERTS_SIGNING_SECRET,
    },
    actor,
    { email: String(form.get("email") ?? ""), locale, now: new Date() },
  );
}

async function act(
  purpose: "confirm" | "unsubscribe",
  locale: AppLocale,
  form: FormData,
): Promise<never> {
  const path = purpose === "confirm" ? "/alertes/confirmer" : "/alertes/desinscription";
  const secret = process.env.ALERTS_SIGNING_SECRET;
  const now = new Date();
  const payload = secret
    ? verifyAlertToken(String(form.get("t") ?? ""), purpose, secret, now)
    : null;

  const repository = getAlertsRepository();
  const done =
    payload !== null &&
    (purpose === "confirm"
      ? await repository.confirm(payload.subscriptionId, now)
      : await repository.unsubscribe(payload.subscriptionId, now));

  return redirect({ href: `${path}?etat=${done ? "ok" : "invalide"}`, locale });
}

export async function confirmAlerts(locale: AppLocale, form: FormData): Promise<void> {
  await act("confirm", locale, form);
}

export async function unsubscribeAlerts(locale: AppLocale, form: FormData): Promise<void> {
  await act("unsubscribe", locale, form);
}
