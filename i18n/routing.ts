import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "ar", "en"],
  defaultLocale: "fr",
});

export type AppLocale = (typeof routing.locales)[number];

export function localeDirection(locale: AppLocale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
