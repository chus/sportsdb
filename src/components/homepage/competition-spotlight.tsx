import Link from "next/link";
import { Globe, Shield, Target, TrendingUp, Users } from "lucide-react";
import type { CompetitionSpotlight as Spotlight } from "@/lib/queries/homepage";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

function resultDot(r: {
  homeScore: number | null;
  awayScore: number | null;
}): { letter: string; className: string } {
  const h = r.homeScore ?? 0;
  const a = r.awayScore ?? 0;
  if (h === a) return { letter: "D", className: "bg-neutral-300 text-neutral-700" };
  return { letter: "W", className: "bg-green-500 text-white" };
}

export function CompetitionSpotlight({ data }: { data: Spotlight }) {
  const {
    competition,
    season,
    leader,
    topScorer,
    nextFixture,
    recentForm,
    teamCount,
    featuredTeams,
  } = data;

  const hasStats = leader || topScorer || nextFixture || recentForm.length > 0;

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Competition Spotlight</h2>
          <p className="text-sm text-neutral-500 mt-1">Featured league today</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              {competition.logoUrl ? (
                <ImageWithFallback
                  src={competition.logoUrl}
                  alt={competition.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <Shield className="w-8 h-8" />
              )}
            </div>
            <div className="min-w-0">
              <Link
                href={`/competitions/${competition.slug}`}
                className="text-2xl font-bold hover:underline block truncate"
              >
                {competition.name}
              </Link>
              <div className="text-sm text-white/80">
                {competition.country ? `${competition.country} · ` : ""}
                {season?.label ?? "Current Season"}
              </div>
            </div>
          </div>
        </div>

        {hasStats ? (
          <div className="p-6 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {leader && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-2">
                  <TrendingUp className="w-3 h-3" />
                  LEAGUE LEADER
                </div>
                <Link
                  href={`/teams/${leader.slug}`}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center flex-shrink-0">
                    {leader.logoUrl ? (
                      <ImageWithFallback
                        src={leader.logoUrl}
                        alt={leader.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Shield className="w-5 h-5 text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                      {leader.name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {leader.points} pts · {leader.played} played
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {topScorer && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-2">
                  <Target className="w-3 h-3" />
                  TOP SCORER
                </div>
                <Link
                  href={`/players/${topScorer.slug}`}
                  className="group block"
                >
                  <div className="font-semibold text-sm text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                    {topScorer.name}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    {topScorer.teamName} · {topScorer.goals} goals
                  </div>
                </Link>
              </div>
            )}

            {nextFixture && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-2">
                  NEXT FIXTURE
                </div>
                <Link
                  href={`/matches/${nextFixture.slug ?? nextFixture.id}`}
                  className="group block"
                >
                  <div className="font-semibold text-sm text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                    {nextFixture.homeTeam.name} vs {nextFixture.awayTeam.name}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {new Date(nextFixture.scheduledAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </Link>
              </div>
            )}

            {recentForm.length > 0 && (
              <div>
                <div className="text-xs font-medium text-neutral-500 mb-2">
                  RECENT RESULTS
                </div>
                <div className="flex items-center gap-1.5">
                  {recentForm.slice(0, 5).map((r) => {
                    const dot = resultDot(r);
                    return (
                      <div
                        key={r.id}
                        title={`${r.homeTeam} ${r.homeScore}-${r.awayScore} ${r.awayTeam}`}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${dot.className}`}
                      >
                        {dot.letter}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 grid md:grid-cols-2 gap-6">
            {teamCount > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-3">
                  <Users className="w-3 h-3" />
                  TEAMS
                </div>
                <p className="text-sm font-semibold text-neutral-900 mb-3">
                  {teamCount} teams compete
                </p>
                <div className="flex flex-wrap gap-2">
                  {featuredTeams.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/teams/${t.slug}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-full text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                      {t.logoUrl ? (
                        <ImageWithFallback
                          src={t.logoUrl}
                          alt={t.name}
                          width={14}
                          height={14}
                          className="w-3.5 h-3.5 object-contain"
                        />
                      ) : (
                        <Shield className="w-3 h-3 text-neutral-400" />
                      )}
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-3">
                <Globe className="w-3 h-3" />
                ABOUT
              </div>
              <p className="text-sm text-neutral-700">
                {competition.country && (
                  <span className="font-semibold">{competition.country}</span>
                )}
                {competition.country && " · "}
                <span className="capitalize">{competition.type}</span>
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-neutral-100 px-6 py-3 bg-neutral-50">
          <Link
            href={`/competitions/${competition.slug}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Explore {competition.name} →
          </Link>
        </div>
      </div>
    </section>
  );
}
