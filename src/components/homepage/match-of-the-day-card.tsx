import Link from "next/link";
import { Trophy, Shield, ArrowRight } from "lucide-react";
import type { MatchOfTheDay } from "@/lib/queries/homepage";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

export function MatchOfTheDayCard({ data }: { data: MatchOfTheDay }) {
  const date = new Date(data.scheduledAt).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <Link
      href={`/matches/${data.slug ?? data.id}`}
      className="group block bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-xl transition-shadow"
    >
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wide">Match of the Day</span>
        </div>
        <span className="text-xs font-medium opacity-90">{date}</span>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          {data.competition.logoUrl && (
            <ImageWithFallback
              src={data.competition.logoUrl}
              alt={data.competition.name}
              width={16}
              height={16}
              className="w-4 h-4 object-contain"
            />
          )}
          <span className="text-xs font-medium text-neutral-500">
            {data.competition.name}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center mb-4">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center mb-2">
              {data.homeTeam.logoUrl ? (
                <ImageWithFallback
                  src={data.homeTeam.logoUrl}
                  alt={data.homeTeam.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <Shield className="w-8 h-8 text-neutral-400" />
              )}
            </div>
            <span className="text-sm font-semibold text-neutral-900 line-clamp-2">
              {data.homeTeam.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-neutral-900 tabular-nums">
              {data.homeScore}
            </span>
            <span className="text-neutral-300 text-2xl">–</span>
            <span className="text-4xl font-bold text-neutral-900 tabular-nums">
              {data.awayScore}
            </span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center mb-2">
              {data.awayTeam.logoUrl ? (
                <ImageWithFallback
                  src={data.awayTeam.logoUrl}
                  alt={data.awayTeam.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <Shield className="w-8 h-8 text-neutral-400" />
              )}
            </div>
            <span className="text-sm font-semibold text-neutral-900 line-clamp-2">
              {data.awayTeam.name}
            </span>
          </div>
        </div>

        {data.linkedArticle && (
          <div className="border-t border-neutral-100 pt-4 mt-4">
            <p className="text-xs font-medium text-orange-600 mb-1">Read the story</p>
            <p className="text-sm font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors line-clamp-1">
              {data.linkedArticle.title}
            </p>
            <p className="text-xs text-neutral-500 line-clamp-2 mt-1">
              {data.linkedArticle.excerpt}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end text-xs font-medium text-blue-600 mt-4">
          View full match
          <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
