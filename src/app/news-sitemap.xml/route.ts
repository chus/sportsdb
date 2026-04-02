import { db } from "@/lib/db";
import { articles, competitions, competitionSeasons, seasons } from "@/lib/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  // Google News sitemap: only articles from last 48 hours
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const recentArticles = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      publishedAt: articles.publishedAt,
      type: articles.type,
      competitionName: competitions.name,
    })
    .from(articles)
    .leftJoin(competitionSeasons, eq(articles.competitionSeasonId, competitionSeasons.id))
    .leftJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .where(
      and(
        eq(articles.status, "published"),
        gte(articles.publishedAt, twoDaysAgo)
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(1000);

  const urls = recentArticles
    .map((article) => {
      const pubDate = article.publishedAt
        ? new Date(article.publishedAt).toISOString()
        : new Date().toISOString();

      const keywords = [
        article.type.replace("_", " "),
        article.competitionName,
        "football",
        "soccer",
      ]
        .filter(Boolean)
        .join(", ");

      return `  <url>
    <loc>${BASE_URL}/news/${escapeXml(article.slug)}</loc>
    <news:news>
      <news:publication>
        <news:name>DataSports</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>
      <news:keywords>${escapeXml(keywords)}</news:keywords>
    </news:news>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300",
    },
  });
}
