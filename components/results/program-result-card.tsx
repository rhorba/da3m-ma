import { getTranslations } from "next-intl/server";
import { amountLabel, formatDate, formatMad, type ReportResult } from "@/lib/reports";
import type { AppLocale } from "@/i18n/routing";
import { InlineQuestion } from "./inline-question";
import { StatusDot } from "./status-dot";

/**
 * One programme as this report saw it. Everything rendered here comes from the stored
 * snapshot, never from the live catalogue, so an old report still reads as it did on
 * the day it was run (ADR-4).
 */

type Props = {
  result: ReportResult;
  locale: AppLocale;
  reportId: string;
  /** Rendered for the nearest misses on an otherwise empty page. */
  showReasons?: boolean;
};

function contentFor(result: ReportResult, locale: AppLocale) {
  // Arabic and English are optional on a programme; French is the curation baseline.
  return result.content[locale] ?? result.content.fr;
}

export async function ProgramResultCard({ result, locale, reportId, showReasons }: Props) {
  const t = await getTranslations("results");
  const tWizard = await getTranslations("wizard");
  const content = contentFor(result, locale);
  const amount = amountLabel(result.amountMinMad, result.amountMaxMad);
  const question = result.outcome === "needs_info" ? result.missing[0] : undefined;

  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-lg font-semibold text-text">{content?.title ?? result.slug}</h3>
        <p className="text-sm text-text-muted">{result.operator}</p>
      </div>

      {content?.summary ? <p className="mt-2 text-sm text-text-muted">{content.summary}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <StatusDot status={result.status} label={t(`status.${result.status}`)} />
        <span className="text-sm text-text-muted">{t(`kind.${result.kind}`)}</span>
        {amount ? (
          <span className="text-sm font-medium text-text">
            <bdi>
              {amount.key === "amountRange"
                ? t("amountRange", {
                    min: formatMad(locale, amount.min),
                    max: formatMad(locale, amount.max),
                  })
                : t(amount.key, { amount: formatMad(locale, amount.amount) })}
            </bdi>
          </span>
        ) : null}
      </div>

      {result.outcome === "ineligible" && showReasons && result.failing.length > 0 ? (
        <div className="mt-3">
          <h4 className="text-sm font-medium text-text">{t("whyNot")}</h4>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-text-muted">
            {result.failing.map((check) => (
              <li key={check.id}>{check.reason[locale] ?? check.reason.fr}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.missing.length > 1 ? (
        <p className="mt-3 text-sm text-text-muted">
          {t("whatIsMissing")}:{" "}
          {result.missing.map((field) => tWizard(`fields.${field}.label`)).join(" · ")}
        </p>
      ) : null}

      {question ? <InlineQuestion reportId={reportId} field={question} /> : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a
          href={result.applicationUrl ?? result.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-4"
        >
          {result.applicationUrl ? t("howToApply") : t("officialSource")}
        </a>
        <span className="text-text-muted">
          <bdi>{t("verifiedOn", { date: formatDate(locale, result.verifiedAt) })}</bdi>
        </span>
      </div>
    </article>
  );
}
