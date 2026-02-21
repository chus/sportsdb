import Link from "next/link";
import { Sparkles, TrendingUp, Calendar } from "lucide-react";
import { format } from "date-fns";
import { getPlayerMatchSummaries } from "@/lib/queries/summaries";

interface PlayerMatchPerformanceProps {
  playerId: string;
  limit?: number;
}

function RatingBadge({ rating }: { rating: number }) {
  let colorClass = "bg-neutral-100 text-neutral-700";
  if (rating >= 8) {
    colorClass = "bg-green-100 text-green-700";
  } else if (rating >= 7) {
    colorClass = "bg-emerald-100 text-emerald-700";
  } else if (rating >= 6) {
    colorClass = "bg-yellow-100 text-yellow-700";
  } else if (rating < 5) {
    colorClass = "bg-red-100 text-red-700";
  }

  return (
    <span className={`px-2 py-1 rounded font-bold text-sm ${colorClass}`}>
      {rating.toFixed(1)}
    </span>
  );
}

export async function PlayerMatchPerformance({
  playerId,
  limit = 5,
}: PlayerMatchPerformanceProps) {
  const performances = await getPlayerMatchSummaries(playerId, limit);

  if (performances.length === 0) return null;

  return (
    <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-bold text-neutral-900">Recent Performances</h2>
        <span className="ml-auto text-xs text-neutral-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-purple-400" />
          AI Analysis
        </span>
      </div>

      <div className="divide-y divide-neutral-100">
        {performances.map((perf) => (
          <Link
            key={perf.id}
            href={`/matches/${perf.matchId}`}
            className="block p-4 hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-start gap-4">
              {/* Rating */}
              <div className="flex-shrink-0">
                {perf.rating !== null && <RatingBadge rating={perf.rating} />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Date */}
                <div className="flex items-center gap-1 text-xs text-neutral-500 mb-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(perf.scheduledAt), "MMM d, yyyy")}
                </div>

                {/* Summary */}
                <p className="text-sm text-neutral-700 line-clamp-2">
                  {perf.summary}
                </p>

                {/* Highlights */}
                {perf.highlights.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {perf.highlights.slice(0, 3).map((highlight: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {performances.length >= limit && (
        <div className="px-6 py-3 border-t border-neutral-100 text-center">
          <span className="text-sm text-neutral-500">
            Showing last {limit} matches
          </span>
        </div>
      )}
    </section>
  );
}
