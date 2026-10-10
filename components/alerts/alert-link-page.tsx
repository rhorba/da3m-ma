import { getTranslations } from "next-intl/server";
import { confirmAlerts, unsubscribeAlerts } from "@/app/[locale]/alertes/actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

/**
 * Where an alert email's link lands (Story 4.4): one sentence and one button. The
 * button, not the visit, does the work, so a mail scanner that opens the link changes
 * nothing. After the press the action redirects back here with `etat`.
 */
export async function AlertLinkPage({
  purpose,
  locale,
  token,
  state,
}: {
  purpose: "confirm" | "unsubscribe";
  locale: AppLocale;
  token: string | undefined;
  state: string | undefined;
}) {
  const t = await getTranslations(`alerts.${purpose}`);
  const tCommon = await getTranslations("common");
  const action = (purpose === "confirm" ? confirmAlerts : unsubscribeAlerts).bind(null, locale);

  const message = state === "ok" ? t("done") : state === "invalide" || !token ? t("invalid") : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center text-lg font-semibold text-primary"
        dir="ltr"
      >
        Da3m.ma
      </Link>
      <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>

      {message ? (
        <p role="status" className="text-base text-text">
          {message}
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <p className="text-base text-text-muted">{t("body")}</p>
          <input type="hidden" name="t" value={token} />
          <Button type="submit" size="lg" className="w-fit">
            {t("button")}
          </Button>
        </form>
      )}

      <footer className="mt-auto border-t border-border pt-4">
        <p className="text-xs text-text-muted">{tCommon("nonAffiliation")}</p>
      </footer>
    </main>
  );
}
