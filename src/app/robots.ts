import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/entity-image", "/matches", "/players/", "/compare/", "/venues", "/competitions", "/top-scorers", "/top-assists", "/teams", "/news", "/transfers", "/trending"],
        disallow: [
          "/api/",
          "/admin/",
          "/search",
          "/dashboard",
          "/games/",
        ],
      },
    ],
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/news-sitemap.xml`,
    ],
  };
}
