import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { ArticleWithRelations } from "@/lib/queries/articles";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  match_report: { label: "Match Report", color: "bg-blue-100 text-blue-700" },
  match_preview: { label: "Match Preview", color: "bg-indigo-100 text-indigo-700" },
  round_recap: { label: "Matchday Recap", color: "bg-purple-100 text-purple-700" },
  player_spotlight: { label: "Player Spotlight", color: "bg-amber-100 text-amber-700" },
  season_review: { label: "Season Review", color: "bg-green-100 text-green-700" },
  transfer_news: { label: "Transfer News", color: "bg-red-100 text-red-700" },
};

interface ArticleCardProps {
  article: ArticleWithRelations;
  featured?: boolean;
}

export function ArticleCard({ article, featured = false }: ArticleCardProps) {
  const { article: a, competition, primaryTeam, primaryPlayer } = article;
  const typeInfo = TYPE_LABELS[a.type] || { label: a.type, color: "bg-neutral-100 text-neutral-700" };

  const publishedDate = a.publishedAt
    ? formatDistanceToNow(new Date(a.publishedAt), { addSuffix: true })
    : null;

  if (featured) {
    return (
      <Link
        href={`/news/${a.slug}`}
        className="group block bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-xl transition-shadow"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            {competition && (
              <span className="text-sm text-neutral-500">{competition.name}</span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 group-hover:text-blue-600 transition-colors mb-3">
            {a.title}
          </h2>
          <p className="text-neutral-600 mb-4 line-clamp-2">{a.excerpt}</p>
          <div className="flex items-center justify-between text-sm text-neutral-500">
            <div className="flex items-center gap-4">
              {primaryTeam && (
                <span className="flex items-center gap-2">
                  {primaryTeam.logoUrl && (
                    <img
                      src={primaryTeam.logoUrl}
                      alt={primaryTeam.name}
                      className="w-5 h-5 object-contain"
                    />
                  )}
                  {primaryTeam.name}
                </span>
              )}
              {primaryPlayer && (
                <span>{primaryPlayer.name}</span>
              )}
            </div>
            {publishedDate && <span>{publishedDate}</span>}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/news/${a.slug}`}
      className="group block bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo.color}`}>
          {typeInfo.label}
        </span>
        {competition && (
          <span className="text-xs text-neutral-400">{competition.name}</span>
        )}
      </div>
      <h3 className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors mb-2 line-clamp-2">
        {a.title}
      </h3>
      <p className="text-sm text-neutral-600 line-clamp-2 mb-3">{a.excerpt}</p>
      <div className="flex items-center justify-between text-xs text-neutral-400">
        {primaryTeam && (
          <span className="flex items-center gap-1">
            {primaryTeam.logoUrl && (
              <img
                src={primaryTeam.logoUrl}
                alt={primaryTeam.name}
                className="w-4 h-4 object-contain"
              />
            )}
            {primaryTeam.name}
          </span>
        )}
        {publishedDate && <span>{publishedDate}</span>}
      </div>
    </Link>
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-5 w-20 bg-neutral-200 rounded-full" />
        <div className="h-4 w-24 bg-neutral-100 rounded" />
      </div>
      <div className="h-5 w-full bg-neutral-200 rounded mb-2" />
      <div className="h-5 w-3/4 bg-neutral-200 rounded mb-3" />
      <div className="h-4 w-full bg-neutral-100 rounded mb-1" />
      <div className="h-4 w-2/3 bg-neutral-100 rounded" />
    </div>
  );
}
