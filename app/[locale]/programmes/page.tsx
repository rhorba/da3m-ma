import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CatalogueList, type CatalogueEntry } from "@/components/programme/catalogue-list";
import { getCatalogueReadRepository } from "@/lib/catalog";
import { amountLabel, formatMad } from "@/lib/reports";
import { alternatesFor } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * Every published programme (Story 4.2). Cached for an hour like the programme pages,
 * so the list is crawlable and cheap while filtering happens in the browser.
 */

export const revalidate = 3600;

type Props = { params: Promise<{ locale: AppLocale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalogue" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: alternatesFor(locale, "/programmes"),
  };
}

export default async function CataloguePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("catalogue");
  const tResults = await getTranslations("results");
  const tCommon = await getTranslations("common");
  const programmes = await getCatalogueReadRepository().listPublished();

  // Only what the list renders crosses to the client; rule trees stay on the server.
  const entries: CatalogueEntry[] = programmes.map((program) => {
    const content = program.content[locale] ?? program.content.fr;
    const amount = amountLabel(program.amountMinMad, program.amountMaxMad);
    return {
      slug: program.slug,
      title: content?.title ?? program.slug,
      summary: content?.summary ?? "",
      operator: program.operator,
      kind: program.kind,
      status: program.status,
      amount: amount
        ? amount.key === "amountRange"
          ? tResults("amountRange", {
              min: formatMad(locale, amount.min),
              max: formatMad(locale, amount.max),
            })
          : tResults(amount.key, { amount: formatMad(locale, amount.amount) })
        : null,
    };
  });

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

      {entries.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-5 text-sm text-text-muted">
          {t("none")}
        </p>
      ) : (
        <CatalogueList entries={entries} />
      )}

      <footer className="flex flex-col gap-4 border-t border-border pt-6">
        <p className="text-base text-text">{t("cta")}</p>
        <Link
          href="/eligibilite"
          className="inline-flex min-h-13 w-fit items-center rounded-md bg-primary px-6 text-base font-medium text-primary-fg hover:opacity-90"
        >
          {tCommon("checkEligibility")}
        </Link>
        <p data-testid="non-affiliation" className="text-xs text-text-muted">
          {tCommon("nonAffiliation")}
        </p>
      </footer>
    </main>
  );
}
