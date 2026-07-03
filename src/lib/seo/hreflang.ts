const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

/**
 * Build canonical + hreflang alternates for an entity page.
 *
 * The default locale (en) is served at the unprefixed path; Spanish
 * lives under /es. Returns the shape Next.js metadata.alternates expects.
 *
 * CANONICAL POLICY: pass the request `locale` ONLY from page types whose es
 * variant is genuinely translated (player/team/competition/match detail pages
 * — es metadata + es body prose). Those self-canonicalize per Google's
 * guidance, making the es page indexable. Untranslated page types (hubs,
 * articles, studies…) must NOT pass a locale: their es variant keeps
 * canonical=en, deliberately deduping the mixed-language page out of the
 * index instead of exposing an ~English page under /es during the AdSense
 * probation.
 *
 * @param path - The unprefixed path (e.g. "/teams/manchester-city").
 *               Pass "/" for the homepage.
 * @param locale - Current request locale; only pass from translated page types.
 */
export function localizedAlternates(path: string, locale?: string) {
  const enUrl = path === "/" ? BASE_URL : `${BASE_URL}${path}`;
  const esUrl = path === "/" ? `${BASE_URL}/es` : `${BASE_URL}/es${path}`;
  return {
    canonical: locale === "es" ? esUrl : enUrl,
    languages: {
      en: enUrl,
      es: esUrl,
      "x-default": enUrl,
    },
  };
}
