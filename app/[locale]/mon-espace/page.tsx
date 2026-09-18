import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { claimAnonymousData } from "@/lib/profiles";
import { formatDate, getReportsRepository } from "@/lib/reports";
import { getActor } from "@/lib/session";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * The signed-in visitor's own space (Story 4.3).
 *
 * Visiting is what claims anonymous work into the account: the wizard never asks anyone
 * to sign up first, so the profile and reports a visitor built anonymously are attached
 * here, on their first visit after signing in (ADR-7). The claim is idempotent, so
 * running it on every visit costs one indexed update that matches nothing.
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "space" });
  // Personal, like the results pages.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function MonEspacePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The middleware has already required a session; this resolves which actor it is.
  const actor = await getActor();
  if (!actor) notFound();

  const { claimed } = await claimAnonymousData(actor);
  const reports = await getReportsRepository().listReports(actor);

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

      <footer className="border-t border-border pt-4">
        <p className="text-xs text-text-muted">{tCommon("nonAffiliation")}</p>
      </footer>
    </main>
  );
}
