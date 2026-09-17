import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Wizard } from "@/components/wizard/wizard";
import { Link } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: AppLocale }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "wizard" });
  return { title: t("title"), description: t("intro") };
}

export default async function EligibilitePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("wizard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-lg font-semibold text-primary" dir="ltr">
          Da3m.ma
        </Link>
        <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
        <p className="text-base text-text-muted">{t("intro")}</p>
      </header>

      {/* The wizard reads its step from the query string, so it renders on the client. */}
      <Suspense fallback={<div className="h-96" aria-hidden="true" />}>
        <Wizard locale={locale} />
      </Suspense>
    </main>
  );
}
