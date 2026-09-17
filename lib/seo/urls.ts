import { routing, type AppLocale } from "@/i18n/routing";

/**
 * Canonical and alternate URLs (Story 4.1). Pure string building so the rules are
 * tested once rather than re-derived in every page's metadata.
 */

/** Falls back to localhost so a developer build produces usable links, not broken ones. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** A path under one locale, e.g. ("fr", "/programmes/x") → "/fr/programmes/x". */
export function localisedPath(locale: AppLocale, path: string): string {
  const clean = path === "/" ? "" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  return `/${locale}${clean}`;
}

export function absoluteUrl(locale: AppLocale, path: string): string {
  return `${siteUrl()}${localisedPath(locale, path)}`;
}

/**
 * What `<link rel="canonical">` and `hreflang` should say for one page. Every locale is
 * listed, plus x-default pointing at French: it is the default locale and the language
 * most of the catalogue is written in.
 */
export function alternatesFor(
  locale: AppLocale,
  path: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const other of routing.locales) languages[other] = absoluteUrl(other, path);
  languages["x-default"] = absoluteUrl(routing.defaultLocale, path);

  return { canonical: absoluteUrl(locale, path), languages };
}
