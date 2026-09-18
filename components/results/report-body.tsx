import { getTranslations } from "next-intl/server";
import { rankReportResults, type EligibilityReport } from "@/lib/reports";
import type { AppLocale } from "@/i18n/routing";
import { ProgramResultCard } from "./program-result-card";
import { ResultGroup } from "./result-group";

/**
 * A report's groups, rendered from the stored snapshot alone (ADR-4).
 *
 * Shared by the public `/resultats/[id]` and the signed-in `/mon-espace/resultats/[id]`.
 * The two routes differ only in who they let through: a report claimed into an account
 * is no longer reachable by the anonymous token that created it, because that token was
 * rotated, so the signed-in route is the only way back to it.
 */
export async function ReportBody({
  report,
  locale,
}: {
  report: EligibilityReport;
  locale: AppLocale;
}) {
  const t = await getTranslations("results");
  const ranked = rankReportResults(report.results);
  const hasNothing = ranked.eligible.length === 0 && ranked.needsInfo.length === 0;

  if (hasNothing) {
    return (
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
    );
  }

  return (
    <>
      <ResultGroup tone="eligible" results={ranked.eligible} locale={locale} reportId={report.id} />
      <ResultGroup
        tone="needsInfo"
        results={ranked.needsInfo}
        locale={locale}
        reportId={report.id}
      />
      <ResultGroup
        tone="ineligible"
        results={ranked.ineligible}
        locale={locale}
        reportId={report.id}
      />
    </>
  );
}
