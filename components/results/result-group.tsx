import { getTranslations } from "next-intl/server";
import type { ReportResult } from "@/lib/reports";
import type { AppLocale } from "@/i18n/routing";
import { ProgramResultCard } from "./program-result-card";

/**
 * One outcome group. Ineligible programmes are collapsed behind a native <details>:
 * they are information, not failure (UI foundation §2), and they should not be the
 * first thing a visitor scrolls through.
 */

type Props = {
  tone: "eligible" | "needsInfo" | "ineligible";
  results: ReportResult[];
  locale: AppLocale;
  reportId: string;
};

const HEADING_TONE = {
  eligible: "text-primary",
  needsInfo: "text-warning",
  ineligible: "text-ineligible",
} as const;

export async function ResultGroup({ tone, results, locale, reportId }: Props) {
  const t = await getTranslations("results");
  if (results.length === 0) return null;

  const cards = (
    <div className="mt-4 grid gap-3">
      {results.map((result) => (
        <ProgramResultCard
          key={result.programVersionId}
          result={result}
          locale={locale}
          reportId={reportId}
          showReasons={tone === "ineligible"}
        />
      ))}
    </div>
  );

  const heading = (
    <>
      <span className={`text-xl font-semibold ${HEADING_TONE[tone]}`}>{t(`groups.${tone}`)}</span>
      <span className="text-sm text-text-muted">
        {t("groups.count", { count: results.length })}
      </span>
    </>
  );

  if (tone === "ineligible") {
    return (
      <details className="border-t border-border pt-6">
        <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1">
          {heading}
        </summary>
        {cards}
      </details>
    );
  }

  return (
    <section className="border-t border-border pt-6">
      <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">{heading}</h2>
      {cards}
    </section>
  );
}
