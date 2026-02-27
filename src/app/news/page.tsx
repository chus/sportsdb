import { Metadata } from "next";
import { getPublishedArticles, getArticleCount } from "@/lib/queries/articles";
import { ArticleCard } from "@/components/news/article-card";
import { Newspaper, FileText, Users, Trophy } from "lucide-react";
import { BetweenContentAd } from "@/components/ads/between-content-ad";

export const metadata: Metadata = {
  title: "Football News & Match Reports | SportsDB",
  description:
    "Latest football news, match reports, player spotlights, and competition recaps. Stay updated with in-depth analysis and coverage.",
};

const ARTICLE_TYPES = [
  { value: "", label: "All News", icon: Newspaper },
  { value: "match_report", label: "Match Reports", icon: FileText },
  { value: "round_recap", label: "Matchday Recaps", icon: Trophy },
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

  const [articles, totalCount] = await Promise.all([
    getPublishedArticles(pageSize, offset, type || undefined),
    getArticleCount(type || undefined),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const featuredArticle = page === 1 ? articles[0] : null;
  const regularArticles = page === 1 ? articles.slice(1) : articles;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">News</h1>
        <p className="text-neutral-600">
          Latest match reports, analysis, and football coverage
        </p>
      </div>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {ARTICLE_TYPES.map((t) => {
          const Icon = t.icon;
          const isActive = type === t.value;
          return (
            <a
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
            </a>
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
                <a
                  href={`/news?${type ? `type=${type}&` : ""}page=${page - 1}`}
                  className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm hover:border-blue-300 transition-colors"
                >
                  Previous
                </a>
              )}
              <span className="px-4 py-2 text-sm text-neutral-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <a
                  href={`/news?${type ? `type=${type}&` : ""}page=${page + 1}`}
                  className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm hover:border-blue-300 transition-colors"
                >
                  Next
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
