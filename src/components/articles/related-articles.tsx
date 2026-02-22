import Link from "next/link";
import { Newspaper, ChevronRight } from "lucide-react";
import { getArticlesForPlayer, getArticlesForTeam } from "@/lib/queries/articles";
import { format } from "date-fns";

interface RelatedArticlesProps {
  playerId?: string;
  teamId?: string;
  limit?: number;
}

export async function RelatedArticles({ playerId, teamId, limit = 5 }: RelatedArticlesProps) {
  const articles = playerId
    ? await getArticlesForPlayer(playerId, limit)
    : teamId
    ? await getArticlesForTeam(teamId, limit)
    : [];

  if (articles.length === 0) {
    return null;
  }

  const typeLabels: Record<string, string> = {
    match_report: "Match Report",
    match_preview: "Preview",
    season_review: "Season Review",
    round_recap: "Recap",
    player_spotlight: "Spotlight",
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-500 flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          Latest News
        </h3>
        <Link
          href="/news"
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View All
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-4">
        {articles.map(({ article, competition }) => (
          <Link
            key={article.id}
            href={`/news/${article.slug}`}
            className="block group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                  {typeLabels[article.type] || article.type}
                </span>
                <h4 className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 transition-colors line-clamp-2 mt-0.5">
                  {article.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                  {competition && <span>{competition.name}</span>}
                  {article.publishedAt && (
                    <span>
                      {format(new Date(article.publishedAt), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
