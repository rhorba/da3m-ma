import { createTranslator } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";
import { absoluteUrl, siteUrl } from "@/lib/seo";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import type { DigestItem } from "./digest";
import type { OutgoingEmail } from "./mailer";

/**
 * The two emails alerts send (Story 4.4), in the subscriber's language. Plain text is
 * the source of truth; the HTML is the same words with links, so neither can say
 * something the other does not.
 */

const MESSAGES = { fr, ar, en } as const;

export function asLocale(value: string): AppLocale {
  return (routing.locales as readonly string[]).includes(value)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

function translator(locale: AppLocale) {
  return createTranslator({ locale, messages: MESSAGES[locale], namespace: "alerts.email" });
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(locale: AppLocale, body: string): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1712;max-width:560px;margin:0 auto;padding:24px">${body}</body></html>`;
}

const link = (href: string, label: string) =>
  `<a href="${escape(href)}" style="color:#0f5e5a">${escape(label)}</a>`;

export function confirmationEmail(input: {
  to: string;
  locale: string;
  confirmToken: string;
}): OutgoingEmail {
  const locale = asLocale(input.locale);
  const t = translator(locale);
  const url = `${absoluteUrl(locale, "/alertes/confirmer")}?t=${encodeURIComponent(input.confirmToken)}`;

  return {
    to: input.to,
    subject: t("confirm.subject"),
    text: [t("confirm.body"), "", url, "", t("confirm.ignore")].join("\n"),
    html: page(
      locale,
      `<p>${escape(t("confirm.body"))}</p><p>${link(url, t("confirm.button"))}</p><p style="color:#6a645a;font-size:14px">${escape(t("confirm.ignore"))}</p>`,
    ),
  };
}

export function digestEmail(input: {
  to: string;
  locale: string;
  items: readonly DigestItem[];
  unsubscribeToken: string;
}): OutgoingEmail {
  const locale = asLocale(input.locale);
  const t = translator(locale);
  const unsubscribeUrl = `${absoluteUrl(locale, "/alertes/desinscription")}?t=${encodeURIComponent(input.unsubscribeToken)}`;
  const oneClickUrl = `${siteUrl()}/api/alerts/unsubscribe?t=${encodeURIComponent(input.unsubscribeToken)}`;

  const lines = input.items.map((item) => {
    const title = item.content[locale]?.title ?? item.content.fr?.title ?? item.slug;
    return {
      title,
      label: t(item.outcome === "eligible" ? "digest.eligible" : "digest.needsInfo"),
      url: absoluteUrl(locale, `/programmes/${item.slug}`),
    };
  });

  return {
    to: input.to,
    subject: t("digest.subject", { count: input.items.length }),
    text: [
      t("digest.intro"),
      "",
      ...lines.flatMap((l) => [`- ${l.title} (${l.label})`, `  ${l.url}`]),
      "",
      t("digest.why"),
      `${t("digest.unsubscribe")}: ${unsubscribeUrl}`,
    ].join("\n"),
    html: page(
      locale,
      `<p>${escape(t("digest.intro"))}</p><ul>${lines
        .map((l) => `<li>${link(l.url, l.title)} — ${escape(l.label)}</li>`)
        .join(
          "",
        )}</ul><p style="color:#6a645a;font-size:14px">${escape(t("digest.why"))} ${link(unsubscribeUrl, t("digest.unsubscribe"))}</p>`,
    ),
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
