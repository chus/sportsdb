import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

// SEO-tool and scraper crawlers that hammer the entity/compare matrix but
// send no users and no ranking value. Search engines (Googlebot, Bingbot)
// and AI-assistant crawlers (GPTBot, ClaudeBot, PerplexityBot…) stay allowed
// on purpose — they are the GEO/SEO acquisition channel.
const BLOCKED_BOTS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "DataForSeoBot",
  "PetalBot",
  "Bytespider",
  "serpstatbot",
  "ZoominfoBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...BLOCKED_BOTS.map((bot) => ({ userAgent: bot, disallow: "/" })),
      {
        userAgent: "*",
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
