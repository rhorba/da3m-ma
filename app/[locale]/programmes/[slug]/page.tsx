import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CriteriaList } from "@/components/programme/criteria-list";
import { DocumentChecklist } from "@/components/programme/document-checklist";
import { StatusDot } from "@/components/results/status-dot";
import { getCatalogueReadRepository, type PublishedProgram } from "@/lib/catalog";
import { amountLabel, formatDate, formatMad } from "@/lib/reports";
import { absoluteUrl, alternatesFor, jsonLdHtml } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * A programme's public page (Story 4.1). Rendered on demand and cached for an hour, so
 * the build needs no database and a `catalogue:sync` shows up within the hour.
 *
 * Everything on the page comes from the published version: the criteria are the engine's
 * own rule reasons, so the page cannot promise something the wizard would refuse.
 */

export const revalidate = 3600;

type Props = { params: Promise<{ locale: AppLocale; slug: string }> };

function localised(program: PublishedProgram, locale: AppLocale) {
  return program.content[locale] ?? program.content.fr;
}

async function findProgramme(slug: string) {
  return getCatalogueReadRepository().findPublishedBySlug(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const program = await findProgramme(slug);
  if (!program) return {};

  const t = await getTranslations({ locale, namespace: "programme" });
  const content = localised(program, locale);

  return {
    title: content?.title,
    description: content ? t("metaDescription", { summary: content.summary }) : undefined,
    alternates: alternatesFor(locale, `/programmes/${slug}`),
  };
}

export default async function ProgrammePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const program = await findProgramme(slug);
  if (!program) notFound();

  const t = await getTranslations("programme");
  const tResults = await getTranslations("results");
  const tCommon = await getTranslations("common");
  const content = localised(program, locale);
  const amount = amountLabel(program.amountMinMad, program.amountMaxMad);

  const amountText = amount
    ? amount.key === "amountRange"
      ? tResults("amountRange", {
          min: formatMad(locale, amount.min),
          max: formatMad(locale, amount.max),
        })
      : tResults(amount.key, { amount: formatMad(locale, amount.amount) })
    : t("amountUnknown");

  // Marks the page up as the public support scheme it describes, not as an offer of ours.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: content?.title,
    description: content?.summary,
    serviceType: t("kindLabel"),
    provider: { "@type": "Organization", name: program.operator },
    areaServed: { "@type": "Country", name: "Morocco" },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: program.applicationUrl ?? program.sourceUrl,
    },
    url: absoluteUrl(locale, `/programmes/${slug}`),
    isAccessibleForFree: true,
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6">
      <script
        type="application/ld+json"
        // React would HTML-escape a text child, which a browser does not decode inside a
        // script element, so the JSON has to be raw. jsonLdHtml escapes every character
        // that could end the tag or break a parser (lib/seo/json-ld.ts, proven in its tests).
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      <header className="flex flex-col gap-3">
        <Link
          href="/programmes"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
        >
          {t("backToCatalogue")}
        </Link>
        <h1 className="text-2xl font-semibold text-text">{content?.title ?? program.slug}</h1>
        <p className="text-base text-text-muted">{content?.summary}</p>
      </header>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-text-muted">{t("operator")}</dt>
          <dd className="mt-0.5 text-sm font-medium text-text">{program.operator}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">{t("kindLabel")}</dt>
          <dd className="mt-0.5 text-sm font-medium text-text">
            {tResults(`kind.${program.kind}`)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">{t("amountLabel")}</dt>
          <dd className="mt-0.5 text-sm font-medium text-text">
            <bdi>{amountText}</bdi>
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="sr-only">{tResults("status.open")}</dt>
          <dd className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusDot status={program.status} label={tResults(`status.${program.status}`)} />
            {program.opensAt ? (
              <span className="text-sm text-text-muted">
                <bdi>{t("opensAt", { date: formatDate(locale, program.opensAt) })}</bdi>
              </span>
            ) : null}
            {program.closesAt ? (
              <span className="text-sm text-text-muted">
                <bdi>{t("closesAt", { date: formatDate(locale, program.closesAt) })}</bdi>
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <CriteriaList
        rules={program.rules}
        locale={locale}
        heading={t("eligibility")}
        hint={t("eligibilityHint")}
      />

      <DocumentChecklist
        documents={program.documents}
        locale={locale}
        heading={t("documents")}
        hint={t("documentsHint")}
        empty={t("noDocuments")}
      />

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <Link
          href="/eligibilite"
          className="inline-flex min-h-13 w-fit items-center rounded-md bg-primary px-6 text-base font-medium text-primary-fg hover:opacity-90"
        >
          {tCommon("checkEligibility")}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <a
            href={program.applicationUrl ?? program.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
          >
            {program.applicationUrl ? t("howToApply") : t("officialSource")}
          </a>
          <span className="text-text-muted">
            <bdi>{t("verifiedOn", { date: formatDate(locale, program.verifiedAt) })}</bdi>
          </span>
        </div>
      </div>

      <footer className="border-t border-border pt-4">
        <p data-testid="non-affiliation" className="text-xs text-text-muted">
          {tCommon("nonAffiliation")}
        </p>
      </footer>
    </main>
  );
}
