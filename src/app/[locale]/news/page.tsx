import { Metadata } from "next";
import Link from "next/link";
import { getPublishedArticles, getArticleCount } from "@/lib/queries/articles";
import { ArticleCard } from "@/components/news/article-card";
import { Newspaper, FileText, Users, Trophy, Eye } from "lucide-react";
import { BetweenContentAd } from "@/components/ads/between-content-ad";
import { BreadcrumbJsonLd, ItemListJsonLd, CollectionPageJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/layout/page-header";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

const TYPE_META: Record<string, { title: string; description: string }> = {
  match_report: {
    title: "Match Reports — Post-Game Analysis & Results",
    description: "In-depth football match reports with post-game analysis, key moments, and player ratings across the Premier League, La Liga, Serie A, and more.",
  },
  round_recap: {
    title: "Matchday Recaps — Round-by-Round Summaries",
    description: "Complete matchday recaps covering all results, standout performances, and talking points from each round of major football competitions.",
  },
  match_preview: {
    title: "Match Previews — Upcoming Fixtures & Predictions",
    description: "Pre-match previews with team form, head-to-head records, and key players to watch for upcoming football fixtures.",
  },
  player_spotlight: {
    title: "Player Spotlights — Standout Performers & Season Reviews",
    description: "Featured profiles and season reviews of football's standout performers, with stats, achievements, and career analysis.",
  },
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const type = params.type || "";

  const meta = type && TYPE_META[type]
    ? TYPE_META[type]
    : { title: "Football News & Match Reports", description: "Latest football news, match reports, player spotlights, and competition recaps. Stay updated with in-depth analysis and coverage." };

  const qs = (p: number) => {
    const parts: string[] = [];
    if (type) parts.push(`type=${type}`);
    if (p > 1) parts.push(`page=${p}`);
    return parts.length ? `?${parts.join("&")}` : "";
  };

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${BASE_URL}/news${qs(page)}`,
      types: {
        "application/rss+xml": `${BASE_URL}/feed.xml`,
      },
    },
    ...(page > 1 && { robots: { index: false, follow: true } }),
  };
}

const ARTICLE_TYPES = [
  { value: "", label: "All News", icon: Newspaper },
  { value: "match_report", label: "Match Reports", icon: FileText },
  { value: "round_recap", label: "Matchday Recaps", icon: Trophy },
  { value: "match_preview", label: "Match Previews", icon: Eye },
  { value: "player_spotlight", label: "Player Spotlights", icon: Users },
];

interface Props {
  searchParams: Promise<{ type?: string; page?: string }>;
}

export default async function NewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const type = params.type || "";
  const page = parseInt(params.page || "1", 10);
  const pageSize = 12;
  const offset = (page - 1) * pageSize;

  const [articles, totalCount, matchReportCount, recapCount, previewCount, spotlightCount] = await Promise.all([
    getPublishedArticles(pageSize, offset, type || undefined),
    getArticleCount(type || undefined),
    getArticleCount("match_report"),
    getArticleCount("round_recap"),
    getArticleCount("match_preview"),
    getArticleCount("player_spotlight"),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const featuredArticle = page === 1 ? articles[0] : null;
  const regularArticles = page === 1 ? articles.slice(1) : articles;

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

  return (
    <>
    <BreadcrumbJsonLd
      items={[
        { name: "Home", url: BASE_URL },
        { name: "News", url: `${BASE_URL}/news` },
      ]}
    />
    <CollectionPageJsonLd name="Football News" description="Latest football news, match reports, player spotlights, and competition recaps." url={`${BASE_URL}/news`} />
    <FAQJsonLd
      items={[
        { question: "What types of articles does DataSports publish?", answer: "DataSports publishes match reports with post-game analysis, matchday recaps covering full round results, match previews for upcoming fixtures, and player spotlights featuring standout performers." },
        { question: "How often is news content published?", answer: "New articles are published regularly after each matchday, covering all major competitions. Match reports typically appear within 24 hours of final whistle." },
        { question: "Can I filter articles by type?", answer: "Yes, you can filter articles by type — All News, Match Reports, Matchday Recaps, Match Previews, or Player Spotlights — using the filter buttons at the top of the news page." },
      ]}
    />
    {page === 1 && (
      <ItemListJsonLd
        name="Football News"
        items={articles.map((a, i) => ({
          position: i + 1,
          url: `${BASE_URL}/news/${a.article.slug}`,
          name: a.article.title,
          image: a.article.imageUrl,
        }))}
      />
    )}
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="News"
        subtitle="Latest match reports, analysis, and football coverage"
        accentColor="bg-neutral-800"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "News" },
        ]}
        icon={<Newspaper className="w-7 h-7 text-neutral-300" />}
      />
      <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Summary Stats */}
      {page === 1 && !type && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Total Articles</div>
            <div className="text-2xl font-bold text-neutral-900">{totalCount}</div>
            <div className="text-xs text-neutral-500">published stories</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Match Reports</div>
            <div className="text-2xl font-bold text-neutral-900">{matchReportCount}</div>
            <div className="text-xs text-neutral-500">post-match analysis</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Matchday Recaps</div>
            <div className="text-2xl font-bold text-neutral-900">{recapCount}</div>
            <div className="text-xs text-neutral-500">round summaries</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Match Previews</div>
            <div className="text-2xl font-bold text-neutral-900">{previewCount}</div>
            <div className="text-xs text-neutral-500">upcoming fixtures</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Player Spotlights</div>
            <div className="text-2xl font-bold text-neutral-900">{spotlightCount}</div>
            <div className="text-xs text-neutral-500">player features</div>
          </div>
        </div>
      )}

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {ARTICLE_TYPES.map((t) => {
          const Icon = t.icon;
          const isActive = type === t.value;
          return (
            <Link
              key={t.value}
              href={t.value ? `/news?type=${t.value}` : "/news"}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-neutral-200 text-neutral-700 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-16 bg-neutral-50 rounded-xl">
          <Newspaper className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-neutral-500">No articles found</p>
        </div>
      ) : (
        <>
          {/* Featured Article */}
          {featuredArticle && (
            <div className="mb-8">
              <ArticleCard article={featuredArticle} featured />
            </div>
          )}

          <BetweenContentAd />

          {/* Article Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {regularArticles.map((article) => (
              <ArticleCard key={article.article.id} article={article} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/news?${type ? `type=${type}&` : ""}page=${page - 1}`}
                  className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm hover:border-blue-300 transition-colors"
                >
                  Previous
                </Link>
              )}
              <span className="px-4 py-2 text-sm text-neutral-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/news?${type ? `type=${type}&` : ""}page=${page + 1}`}
                  className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm hover:border-blue-300 transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
    </div>
    </>
  );
}
