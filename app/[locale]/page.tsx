import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: AppLocale }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tNav = await getTranslations("nav");
  const tLang = await getTranslations("languages");

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <span className="text-lg font-semibold text-primary" dir="ltr">
          Da3m.ma
        </span>
        <nav aria-label={tNav("language")}>
          <ul className="flex gap-3 text-sm">
            {routing.locales.map((l) => (
              <li key={l}>
                <Link
                  href="/"
                  locale={l}
                  lang={l}
                  aria-current={l === locale ? "page" : undefined}
                  className={
                    l === locale
                      ? "font-semibold text-text underline underline-offset-4"
                      : "text-text-muted hover:text-text"
                  }
                >
                  {tLang(l)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-6 py-16">
        <h1 className="text-3xl leading-tight font-semibold sm:text-5xl">{t("title")}</h1>
        <p className="text-lg text-text-muted">{t("tagline")}</p>
        <p className="w-fit rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg">
          {t("comingSoon")}
        </p>
      </main>

      <footer className="border-t border-border pt-4 text-sm text-text-muted">
        <p data-testid="non-affiliation">{t("nonAffiliation")}</p>
      </footer>
    </div>
  );
}
