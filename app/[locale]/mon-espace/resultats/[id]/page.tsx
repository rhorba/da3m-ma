import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReportBody } from "@/components/results/report-body";
import { formatDate, getReportsRepository } from "@/lib/reports";
import { getActor } from "@/lib/session";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * A claimed report, read through the account rather than the anonymous cookie.
 *
 * The public `/resultats/[id]` resolves only the anonymous token, and claiming rotates
 * that token — so once a report belongs to an account, this is the route that reaches
 * it. Same rendering, different door.
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: AppLocale; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "results" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function OwnedResultsPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const actor = await getActor();
  const report = actor ? await getReportsRepository().getReport(actor, id) : null;
  if (!report) notFound();

  const t = await getTranslations("results");
  const tSpace = await getTranslations("space");
  const tCommon = await getTranslations("common");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/mon-espace"
          className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-primary underline underline-offset-4"
        >
          {tSpace("title")}
        </Link>
        <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
        <p className="text-sm text-text-muted">
          <bdi>
            {t("subtitle", {
              date: formatDate(locale, report.createdAt.toISOString().slice(0, 10)),
            })}
          </bdi>
        </p>
      </header>

      <ReportBody report={report} locale={locale} />

      <footer className="mt-2 border-t border-border pt-4">
        <p data-testid="non-affiliation" className="text-xs text-text-muted">
          {tCommon("nonAffiliation")}
        </p>
      </footer>
    </main>
  );
}
