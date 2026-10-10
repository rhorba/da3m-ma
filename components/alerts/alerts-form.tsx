"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { subscribeAlerts } from "@/app/[locale]/alertes/actions";
import { Button } from "@/components/ui/button";
import type { AlertStatus, SubscribeOutcome } from "@/lib/alerts";
import type { AppLocale } from "@/i18n/routing";

/**
 * Turning alerts on from /mon-espace (Story 4.4). The address is prefilled from the
 * account but stays editable: people often want alerts at a work address.
 */
export function AlertsForm({
  locale,
  defaultEmail,
  status,
}: {
  locale: AppLocale;
  defaultEmail: string;
  status: AlertStatus;
}) {
  const t = useTranslations("alerts.form");
  const [outcome, action, pending] = useActionState<SubscribeOutcome | null, FormData>(
    subscribeAlerts.bind(null, locale),
    null,
  );

  const current = outcome?.ok ? { state: outcome.state, email: outcome.email } : status;

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="text-xl font-semibold text-text">{t("title")}</h2>
      <p className="text-sm text-text-muted">{t("intro")}</p>

      {current ? (
        <p role="status" className="text-sm text-text">
          <bdi>{t(current.state, { email: current.email })}</bdi>
        </p>
      ) : null}

      {current?.state === "active" ? null : (
        <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-text">
            {t("emailLabel")}
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              dir="ltr"
              defaultValue={current?.email ?? defaultEmail}
              aria-invalid={outcome?.ok === false && outcome.error === "invalid_email"}
              aria-describedby={outcome?.ok === false ? "alerts-error" : undefined}
              className="min-h-11 rounded-md border border-border bg-surface px-3 text-base text-text"
            />
          </label>
          <Button type="submit" disabled={pending}>
            {t("submit")}
          </Button>
        </form>
      )}

      {outcome?.ok === false ? (
        <p id="alerts-error" role="alert" className="text-sm text-error">
          {t(`errors.${outcome.error}`)}
        </p>
      ) : null}
    </section>
  );
}
