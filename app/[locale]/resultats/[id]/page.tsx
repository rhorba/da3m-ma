import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProgramResultCard } from "@/components/results/program-result-card";
import { ResultGroup } from "@/components/results/result-group";
import { readAnonActor } from "@/lib/auth";
import { formatDate, getReportsRepository, rankReportResults } from "@/lib/reports";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * A report, exactly as it was run (Story 3.3 / 3.5). Dynamic: it reads the anonymous
 * cookie, so it is never prerendered or cached. Only the visitor who owns the profile
 * behind the report can open it; everyone else gets a 404 rather than a hint that the
 * report exists.
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: AppLocale; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "results" });
  // Results are personal; they must not be indexed or previewed.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ResultsPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const actor = await readAnonActor();
  const report = actor ? await getReportsRepository().getReport(actor, id) : null;
  if (!report) notFound();

  const t = await getTranslations("results");
  const tCommon = await getTranslations("common");
  const ranked = rankReportResults(report.results);
  const hasNothing = ranked.eligible.length === 0 && ranked.needsInfo.length === 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="inline-flex min-h-11 w-fit items-center text-lg font-semibold text-primary"
          dir="ltr"
        >
          Da3m.ma
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

      {hasNothing ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold text-text">{t("empty.title")}</h2>
          {ranked.closest.length > 0 ? (
            <>
              <p className="mt-2 text-sm text-text-muted">{t("empty.closest")}</p>
              <div className="mt-4 grid gap-3">
                {ranked.closest.map((result) => (
                  <ProgramResultCard
                    key={result.programVersionId}
                    result={result}
                    locale={locale}
                    reportId={report.id}
                    showReasons
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-muted">{t("empty.none")}</p>
          )}
        </section>
      ) : (
        <>
          <ResultGroup
            tone="eligible"
            results={ranked.eligible}
            locale={locale}
            reportId={report.id}
          />
          <ResultGroup
            tone="needsInfo"
            results={ranked.needsInfo}
            locale={locale}
            reportId={report.id}
          />
        </>
      )}

      {hasNothing ? null : (
        <ResultGroup
          tone="ineligible"
          results={ranked.ineligible}
          locale={locale}
          reportId={report.id}
        />
      )}

      <footer className="mt-2 flex flex-col gap-4 border-t border-border pt-4">
        <Link
          href="/eligibilite"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
        >
          {t("restart")}
        </Link>
        <p data-testid="non-affiliation" className="text-xs text-text-muted">
          {tCommon("nonAffiliation")}
        </p>
      </footer>
    </main>
  );
}
