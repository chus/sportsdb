import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

// Frugal mode (Aug 2026, Vercel Hobby fair-use limits): ONLY Googlebot and
// Bingbot may crawl. Every other user agent — SEO tools, scrapers, and the
// AI-assistant crawlers (GPTBot, ClaudeBot, PerplexityBot…) that were
// previously allowed as a GEO channel — is disallowed entirely. Well-behaved
// bots honour this and stop sending requests at all, which is what keeps
// edge-request volume under the free tier. Middleware enforces it for the
// ones that don't.
const SEARCH_ENGINES = ["Googlebot", "Bingbot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: "/" },
      {
        userAgent: SEARCH_ENGINES,
        allow: [
          "/",
          "/api/entity-image",
        ],
        // Disallow both the default-locale (unprefixed) form and the /es
        // form for every private route. Robots.txt is prefix-matched, so
        // "/admin/" does NOT cover "/es/admin/" — they must be listed.
        disallow: [
          "/api/",
          "/admin/",
          "/es/admin/",
          "/account/",
          "/es/account/",
          "/dashboard",
          "/es/dashboard",
          "/login",
          "/es/login",
          "/signup",
          "/es/signup",
          "/search",
          "/es/search",
        ],
      },
    ],
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/news-sitemap.xml`,
    ],
  };
}
