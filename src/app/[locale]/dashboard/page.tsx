import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import {
  Trophy,
  Calendar,
  Newspaper,
  Sparkles,
  ChevronRight,
  Shield,
  Star,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/queries/dashboard";
import { getUserSubscription } from "@/lib/queries/subscriptions";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your personalized sports dashboard.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [dashboardData, subscription] = await Promise.all([
    getDashboardData(user.id),
    getUserSubscription(user.id),
  ]);

  const { followedLeagues, upcomingFixtures, leagueStandings, latestArticles } =
    dashboardData;

  const firstName = user.name?.split(" ")[0] || "there";

  return (
    <main className="min-h-screen bg-surface-2">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Welcome Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-ink">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-muted">
            Here is what is happening across your leagues.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Leagues + Fixtures */}
          <div className="lg:col-span-2 space-y-6">
            {/* Followed Leagues */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-blue-600" />
                  Your Leagues
                </h2>
                {followedLeagues.length > 0 && (
                  <Link
                    href="/account"
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Manage
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>

              {followedLeagues.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface p-6 text-center">
                  <Trophy className="h-10 w-10 text-faint mx-auto mb-3" />
                  <h3 className="font-medium text-ink mb-1">
                    No leagues selected
                  </h3>
                  <p className="text-sm text-muted mb-4">
                    Pick your favorite leagues to see fixtures, standings, and
                    news tailored to you.
                  </p>
                  <Link
                    href="/competitions"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <Star className="h-4 w-4" />
                    Browse Leagues
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {followedLeagues.map(({ competition }) => (
                    <Link
                      key={competition.id}
                      href={`/competitions/${competition.slug}`}
                      className="rounded-xl border border-line bg-surface p-4 hover:shadow-xl transition-shadow flex items-center gap-3"
                    >
                      {competition.logoUrl ? (
                        <img
                          src={competition.logoUrl}
                          alt={competition.name}
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <Shield className="h-8 w-8 text-faint" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {competition.name}
                        </p>
                        {competition.country && (
                          <p className="text-xs text-muted truncate">
                            {competition.country}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Upcoming Fixtures */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Upcoming Fixtures
                </h2>
              </div>

              {upcomingFixtures.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface p-6 text-center">
                  <Calendar className="h-10 w-10 text-faint mx-auto mb-3" />
                  <p className="text-sm text-muted">
                    {followedLeagues.length === 0
                      ? "Follow leagues to see upcoming fixtures here."
                      : "No upcoming matches in the next 7 days."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingFixtures.map((fixture) => (
                    <Link
                      key={fixture.id}
                      href={`/matches/${fixture.slug ?? fixture.id}`}
                      className="block rounded-xl border border-line bg-surface p-4 hover:shadow-xl transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-blue-600">
                          {fixture.competition.name}
                        </span>
                        <span className="text-xs text-muted">
                          {format(
                            new Date(fixture.scheduledAt),
                            "EEE, MMM d - HH:mm"
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {fixture.homeTeam.logoUrl ? (
                            <img
                              src={fixture.homeTeam.logoUrl}
                              alt={fixture.homeTeam.name}
                              className="h-6 w-6 object-contain flex-shrink-0"
                            />
                          ) : (
                            <Shield className="h-6 w-6 text-faint flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-ink truncate">
                            {fixture.homeTeam.shortName ||
                              fixture.homeTeam.name}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-faint px-3">
                          vs
                        </span>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="text-sm font-medium text-ink truncate text-right">
                            {fixture.awayTeam?.shortName ||
                              fixture.awayTeam?.name ||
                              "TBD"}
                          </span>
                          {fixture.awayTeam?.logoUrl ? (
                            <img
                              src={fixture.awayTeam.logoUrl}
                              alt={fixture.awayTeam.name}
                              className="h-6 w-6 object-contain flex-shrink-0"
                            />
                          ) : (
                            <Shield className="h-6 w-6 text-faint flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* League Standings */}
            {leagueStandings.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2 mb-4">
                  <Trophy className="h-5 w-5 text-blue-600" />
                  Standings
                </h2>
                <div className="space-y-6">
                  {leagueStandings.map((league) => (
                    <div
                      key={league.competitionSeasonId}
                      className="rounded-xl border border-line bg-surface overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-line">
                        <h3 className="text-sm font-semibold text-ink">
                          {league.competition.name}
                        </h3>
                        <Link
                          href={`/competitions/${league.competition.slug}`}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          Full table
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                      <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted border-b border-line">
                            <th className="text-left py-2 px-2 sm:px-4 font-medium w-8">
                              #
                            </th>
                            <th className="text-left py-2 px-2 font-medium">
                              Team
                            </th>
                            <th className="text-center py-2 px-2 font-medium">
                              P
                            </th>
                            <th className="text-center py-2 px-2 font-medium">
                              W
                            </th>
                            <th className="text-center py-2 px-2 font-medium hidden sm:table-cell">
                              D
                            </th>
                            <th className="text-center py-2 px-2 font-medium">
                              L
                            </th>
                            <th className="text-center py-2 px-2 font-medium hidden sm:table-cell">
                              GD
                            </th>
                            <th className="text-center py-2 px-2 sm:px-4 font-medium">
                              Pts
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {league.standings.map(({ standing, team }) => (
                            <tr
                              key={standing.id}
                              className="border-b border-neutral-50 last:border-0 hover:bg-surface-2"
                            >
                              <td className="py-2 px-2 sm:px-4 text-muted font-medium">
                                {standing.position}
                              </td>
                              <td className="py-2 px-2">
                                <Link
                                  href={`/teams/${team.slug}`}
                                  className="flex items-center gap-2 hover:text-blue-600"
                                >
                                  {team.logoUrl ? (
                                    <img
                                      src={team.logoUrl}
                                      alt={team.name}
                                      className="h-5 w-5 object-contain"
                                    />
                                  ) : (
                                    <Shield className="h-5 w-5 text-faint" />
                                  )}
                                  <span className="font-medium text-ink truncate hidden md:inline">
                                    {team.name}
                                  </span>
                                  <span className="font-medium text-ink truncate md:hidden">
                                    {team.shortName || team.name}
                                  </span>
                                </Link>
                              </td>
                              <td className="py-2 px-2 text-center text-muted">
                                {standing.played}
                              </td>
                              <td className="py-2 px-2 text-center text-muted">
                                {standing.won}
                              </td>
                              <td className="py-2 px-2 text-center text-muted hidden sm:table-cell">
                                {standing.drawn}
                              </td>
                              <td className="py-2 px-2 text-center text-muted">
                                {standing.lost}
                              </td>
                              <td className="py-2 px-2 text-center text-muted hidden sm:table-cell">
                                {standing.goalDifference > 0
                                  ? `+${standing.goalDifference}`
                                  : standing.goalDifference}
                              </td>
                              <td className="py-2 px-2 sm:px-4 text-center font-bold text-ink">
                                {standing.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column: News + Upgrade */}
          <div className="space-y-6">
            {/* Latest News */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <Newspaper className="h-5 w-5 text-blue-600" />
                  Latest News
                </h2>
                <Link
                  href="/news"
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  All news
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              {latestArticles.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface p-6 text-center">
                  <Newspaper className="h-10 w-10 text-faint mx-auto mb-3" />
                  <p className="text-sm text-muted">
                    No articles published yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {latestArticles.map((article) => (
                    <Link
                      key={article.id}
                      href={`/news/${article.slug}`}
                      className="block rounded-xl border border-line bg-surface p-4 hover:shadow-xl transition-shadow"
                    >
                      <p className="text-sm font-medium text-ink line-clamp-2 mb-2">
                        {article.title}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 font-medium capitalize">
                          {article.type.replace("_", " ")}
                        </span>
                        {article.publishedAt && (
                          <span className="text-xs text-faint">
                            {format(
                              new Date(article.publishedAt),
                              "MMM d, yyyy"
                            )}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Upgrade Card (free users only) */}
            {subscription.tier === "free" && (
              <section>
                <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-ink">
                      Upgrade to Pro
                    </h3>
                  </div>
                  <p className="text-sm text-muted mb-4">
                    Unlock unlimited follows, advanced comparisons, and
                    exclusive insights.
                  </p>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors w-full justify-center"
                  >
                    View Plans
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
