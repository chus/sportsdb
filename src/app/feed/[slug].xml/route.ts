import { getArticlesForCompetition } from "@/lib/queries/articles";
import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Verify competition exists
  const allComps = await db.select({ slug: competitions.slug, name: competitions.name }).from(competitions);
  const comp = allComps.find((c) => c.slug === slug);

  if (!comp) {
    return new Response("Competition not found", { status: 404 });
  }

  const articles = await getArticlesForCompetition(slug, 30);

  const items = articles
    .map(({ article }) => {
      const link = `${BASE_URL}/news/${article.slug}`;
      const pubDate = article.publishedAt
        ? new Date(article.publishedAt).toUTCString()
        : new Date().toUTCString();
      const category = article.type.replace("_", " ");

      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(article.excerpt)}</description>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(category)}</category>
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SportsDB – ${escapeXml(comp.name)} News</title>
    <link>${BASE_URL}/competitions/${slug}</link>
    <description>Latest ${escapeXml(comp.name)} news, match reports, and analysis from SportsDB.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed/${slug}.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
