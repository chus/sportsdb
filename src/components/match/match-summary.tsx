import Link from "next/link";
import { Star, Clock, Sparkles } from "lucide-react";
import { getMatchSummary } from "@/lib/queries/summaries";

interface MatchSummaryProps {
  matchId: string;
}

export async function MatchSummary({ matchId }: MatchSummaryProps) {
  const summary = await getMatchSummary(matchId);

  if (!summary) return null;

  return (
    <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h2 className="text-lg font-bold text-neutral-900">Match Report</h2>
        <span className="ml-auto text-xs text-neutral-400 flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-purple-400 rounded-full" />
          AI Generated
        </span>
      </div>

      <div className="p-6">
        {/* Headline */}
        <h3 className="text-xl font-bold text-neutral-900 mb-4">
          {summary.headline}
        </h3>

        {/* Summary paragraphs */}
        <div className="prose prose-neutral prose-sm max-w-none mb-6">
          {summary.summary.split("\n\n").map((paragraph, idx) => (
            <p key={idx} className="text-neutral-700 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Key Moments */}
        {summary.keyMoments.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">
              Key Moments
            </h4>
            <div className="space-y-2">
              {summary.keyMoments.map(
                (moment: { minute: number; description: string }, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span className="flex-shrink-0 w-12 text-neutral-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {moment.minute}&apos;
                    </span>
                    <span className="text-neutral-700">{moment.description}</span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Man of the Match */}
        {summary.manOfTheMatch && (
          <div className="bg-amber-50 rounded-lg p-4 flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                Man of the Match
              </span>
              <div className="mt-1">
                <Link
                  href={`/players/${summary.manOfTheMatch.slug}`}
                  className="font-semibold text-neutral-900 hover:text-blue-600 transition-colors"
                >
                  {summary.manOfTheMatch.name}
                </Link>
                <span className="text-sm text-neutral-500 ml-2">
                  {summary.manOfTheMatch.position}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
