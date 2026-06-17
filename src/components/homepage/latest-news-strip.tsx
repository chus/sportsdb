import { Link } from "@/i18n/navigation";
import { ChevronRight, Newspaper } from "lucide-react";
import type { ArticleWithRelations } from "@/lib/queries/articles";

function formatArticleDate(date: Date | string | null): string {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function LatestNewsStrip({
  articles,
}: {
  articles: ArticleWithRelations[];
}) {
  if (!articles.length) return null;

  const [featured, ...rest] = articles;

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-blue-600" />
          <h2 className="text-2xl font-bold text-ink">Latest News</h2>
        </div>
        <Link
          href="/news"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View all <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Link
          href={`/news/${featured.article.slug}`}
          className="block bg-surface rounded-xl border border-line overflow-hidden hover:shadow-xl transition-shadow group"
        >
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              {featured.competition && (
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {featured.competition.name}
                </span>
              )}
              <span className="text-xs text-faint">
                {formatArticleDate(featured.article.publishedAt)}
              </span>
            </div>
            <h3 className="text-xl font-bold text-ink group-hover:text-blue-600 transition-colors mb-2">
              {featured.article.title}
            </h3>
            {featured.article.excerpt && (
              <p className="text-sm text-muted line-clamp-3">
                {featured.article.excerpt}
              </p>
            )}
          </div>
        </Link>

        <div className="bg-surface rounded-xl border border-line divide-y divide-line">
          {rest.slice(0, 5).map(({ article, competition }) => (
            <Link
              key={article.id}
              href={`/news/${article.slug}`}
              className="flex items-start gap-4 p-4 hover:bg-surface-2 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {competition && (
                    <span className="text-xs font-medium text-blue-600">
                      {competition.name}
                    </span>
                  )}
                  <span className="text-xs text-faint">
                    {formatArticleDate(article.publishedAt)}
                  </span>
                </div>
                <h4 className="font-semibold text-sm text-ink group-hover:text-blue-600 transition-colors line-clamp-2">
                  {article.title}
                </h4>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
