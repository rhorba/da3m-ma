import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertLinkPage } from "@/components/alerts/alert-link-page";
import type { AppLocale } from "@/i18n/routing";

// Every visit carries someone's token: never prerendered, never cached.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ t?: string; etat?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "alerts.unsubscribe" });
  // Reached from one person's email; nothing here belongs in a search index.
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t, etat } = await searchParams;
  return <AlertLinkPage purpose="unsubscribe" locale={locale} token={t} state={etat} />;
}
