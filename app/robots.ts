import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { routing } from "@/i18n/routing";

/**
 * A report belongs to one visitor and is already noindex; keeping crawlers out of the
 * path as well means a shared link never turns into an indexed page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", ...routing.locales.map((locale) => `/${locale}/resultats/`)],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
