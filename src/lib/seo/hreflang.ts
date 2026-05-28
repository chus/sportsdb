const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

/**
 * Build canonical + hreflang alternates for an entity page.
 *
 * The default locale (en) is served at the unprefixed path; Spanish
 * lives under /es. Returns the shape Next.js metadata.alternates expects.
 *
 * @param path - The unprefixed path (e.g. "/teams/manchester-city").
 *               Pass "/" for the homepage.
 */
export function localizedAlternates(path: string) {
  const enUrl = path === "/" ? BASE_URL : `${BASE_URL}${path}`;
  const esUrl = path === "/" ? `${BASE_URL}/es` : `${BASE_URL}/es${path}`;
  return {
    canonical: enUrl,
    languages: {
      en: enUrl,
      es: esUrl,
      "x-default": enUrl,
    },
  };
}
