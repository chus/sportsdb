import Link from "next/link";
import { Sparkles, TrendingUp, TrendingDown, Trophy, Users } from "lucide-react";
import { getLatestTournamentSummary } from "@/lib/queries/summaries";

interface TournamentRecapProps {
  competitionSeasonId: string;
}

export async function TournamentRecap({ competitionSeasonId }: TournamentRecapProps) {
  const summary = await getLatestTournamentSummary(competitionSeasonId);

  if (!summary) return null;

  const periodLabel =
    summary.periodType === "matchday"
      ? `Matchday ${summary.periodValue}`
      : summary.periodType === "week"
        ? `Week ${summary.periodValue}`
        : `Month ${summary.periodValue}`;

  return (
    <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-indigo-500" />
        <h2 className="text-lg font-bold text-neutral-900">{periodLabel} Recap</h2>
        <span className="ml-auto text-xs text-neutral-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-purple-400" />
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
          {summary.summary.split("\n\n").map((paragraph: string, idx: number) => (
            <p key={idx} className="text-neutral-700 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Top Performers */}
        {summary.topPerformers.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Top Performers
            </h4>
            <div className="space-y-2">
              {summary.topPerformers.map(
                (performer: { playerId: string; playerName: string; reason: string }, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-sm p-2 bg-neutral-50 rounded-lg"
                  >
                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-medium text-neutral-900">
                        {performer.playerName}
                      </span>
                      <span className="text-neutral-500 ml-2">
                        {performer.reason}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Standings Movement */}
        {summary.standingsMovement && (
          <div className="grid grid-cols-2 gap-4">
            {summary.standingsMovement.biggestRiser && (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Biggest Riser
                </div>
                <div className="font-semibold text-neutral-900">
                  {summary.standingsMovement.biggestRiser.team}
                </div>
                <div className="text-sm text-green-600">
                  +{summary.standingsMovement.biggestRiser.change} positions
                </div>
              </div>
            )}

            {summary.standingsMovement.biggestFaller && (
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-1">
                  <TrendingDown className="w-4 h-4" />
                  Biggest Faller
                </div>
                <div className="font-semibold text-neutral-900">
                  {summary.standingsMovement.biggestFaller.team}
                </div>
                <div className="text-sm text-red-600">
                  {summary.standingsMovement.biggestFaller.change} positions
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
