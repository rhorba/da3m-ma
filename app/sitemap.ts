import type { MetadataRoute } from "next";
import { getCatalogueReadRepository } from "@/lib/catalog";
import { absoluteUrl, alternatesFor } from "@/lib/seo";
import { routing } from "@/i18n/routing";

/**
 * The crawlable surface (Story 4.1). Results pages are personal and noindex, so they are
 * deliberately absent. Revalidated on the same hour as the pages themselves.
 */

export const revalidate = 3600;

/** Pages that exist in every locale regardless of what is published. */
const STATIC_PATHS = ["/", "/eligibilite", "/programmes"] as const;

function entry(path: string, lastModified?: Date): MetadataRoute.Sitemap[number][] {
  return routing.locales.map((locale) => ({
    url: absoluteUrl(locale, path),
    lastModified,
    alternates: { languages: alternatesFor(locale, path).languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const programmes = await getCatalogueReadRepository().listPublished();

  return [
    ...STATIC_PATHS.flatMap((path) => entry(path)),
    ...programmes.flatMap((program) =>
      entry(`/programmes/${program.slug}`, new Date(`${program.verifiedAt}T00:00:00Z`)),
    ),
  ];
}
