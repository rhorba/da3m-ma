import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertsForm } from "@/components/alerts/alerts-form";
import { getAlertsRepository } from "@/lib/alerts";
import { readAnonActor } from "@/lib/auth";
import { formatDate, getReportsRepository } from "@/lib/reports";
import { getActor, getPrimaryEmail } from "@/lib/session";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * The signed-in visitor's own space (Story 4.3).
 *
 * Visiting is what claims anonymous work into the account: the wizard never asks anyone
 * to sign up first, so the profile and reports a visitor built anonymously are attached
 * on their first visit after signing in (ADR-7). Claiming rotates the anonymous cookie,
 * which a Server Component cannot do, so a visitor who still has one goes through
 * `reclamer/` first and comes back with `?reclames=<count>`.
 */

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ reclames?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "space" });
  // Personal, like the results pages.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function MonEspacePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { reclames } = await searchParams;
  setRequestLocale(locale);

  // The middleware has already required a session; this resolves which actor it is.
  const actor = await getActor();
  if (!actor) notFound();

  // `reclames` marks the way back from the claim, so a cookie that matched nothing
  // cannot send the visitor round in a loop.
  if (actor.kind === "user" && reclames === undefined && (await readAnonActor())) {
    redirect(`/${locale}/mon-espace/reclamer`);
  }
  const claimed = Math.max(0, Number.parseInt(reclames ?? "0", 10) || 0);
  const reports = await getReportsRepository().listReports(actor);
  // Alerts follow a profile, which only a signed-in user (not a firm member) owns.
  const alerts =
    actor.kind === "user" && reports.length > 0
      ? { status: await getAlertsRepository().status(actor), email: await getPrimaryEmail() }
      : null;

  const t = await getTranslations("space");
  const tCommon = await getTranslations("common");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="inline-flex min-h-11 w-fit items-center text-lg font-semibold text-primary"
          dir="ltr"
        >
          Da3m.ma
        </Link>
        <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
        <p className="text-base text-text-muted">{t("intro")}</p>
      </header>

      {claimed > 0 ? (
        <p
          role="status"
          className="rounded-md border border-primary bg-surface px-4 py-3 text-sm text-text"
        >
          {t("claimed", { count: claimed })}
        </p>
      ) : null}

      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-xl font-semibold text-text">{t("history")}</h2>

        {reports.length === 0 ? (
          <p className="text-sm text-text-muted">{t("noHistory")}</p>
        ) : (
          <ul className="grid gap-3">
            {reports.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div>
                  <p className="text-sm font-medium text-text">
                    {t("eligibleCount", { count: report.eligibleCount })}
                  </p>
                  <p className="text-sm text-text-muted">
                    <bdi>
                      {t("runOn", {
                        date: formatDate(locale, report.createdAt.toISOString().slice(0, 10)),
                      })}
                    </bdi>
                  </p>
                </div>
                <Link
                  href={`/mon-espace/resultats/${report.id}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
                >
                  {t("openReport")}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/eligibilite"
          className="inline-flex min-h-13 w-fit items-center rounded-md bg-primary px-6 text-base font-medium text-primary-fg hover:opacity-90"
        >
          {reports.length === 0 ? tCommon("checkEligibility") : t("startWizard")}
        </Link>
      </section>

      {alerts ? (
        <AlertsForm locale={locale} defaultEmail={alerts.email ?? ""} status={alerts.status} />
      ) : null}

      <footer className="border-t border-border pt-4">
        <p className="text-xs text-text-muted">{tCommon("nonAffiliation")}</p>
      </footer>
    </main>
  );
}
