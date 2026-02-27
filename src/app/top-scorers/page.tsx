import Link from "next/link";
import { Trophy, Shield, User } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  playerSeasonStats,
  players,
  teams,
  competitionSeasons,
  competitions,
  seasons,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://sportsdb-nine.vercel.app";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Top Scorers 2025/26 – Football Goal Leaders",
  description:
    "Top scorers across all major football competitions for the 2025/26 season. See goals, assists, and appearances for the leading strikers.",
  openGraph: {
    title: "Top Scorers 2025/26 – Football Goal Leaders | SportsDB",
    description:
      "Top scorers across all major football competitions for the 2025/26 season.",
    url: `${BASE_URL}/top-scorers`,
  },
  alternates: {
    canonical: `${BASE_URL}/top-scorers`,
  },
};

async function getTopScorersAllCompetitions(limit = 50) {
  return db
    .select({
      stat: playerSeasonStats,
      player: {
        id: players.id,
        name: players.name,
        slug: players.slug,
        imageUrl: players.imageUrl,
        position: players.position,
        nationality: players.nationality,
      },
      team: {
        id: teams.id,
        name: teams.name,
        shortName: teams.shortName,
        slug: teams.slug,
        logoUrl: teams.logoUrl,
      },
      competition: {
        name: competitions.name,
        slug: competitions.slug,
      },
      season: {
        label: seasons.label,
      },
    })
    .from(playerSeasonStats)
    .innerJoin(players, eq(playerSeasonStats.playerId, players.id))
    .innerJoin(teams, eq(playerSeasonStats.teamId, teams.id))
    .innerJoin(competitionSeasons, eq(playerSeasonStats.competitionSeasonId, competitionSeasons.id))
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .innerJoin(seasons, eq(competitionSeasons.seasonId, seasons.id))
    .where(eq(seasons.isCurrent, true))
    .orderBy(desc(playerSeasonStats.goals))
    .limit(limit);
}

export default async function TopScorersPage() {
  const scorers = await getTopScorersAllCompetitions();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Top Scorers", url: `${BASE_URL}/top-scorers` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        {/* Hero */}
        <div className="bg-gradient-to-br from-yellow-500 via-orange-500 to-red-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">Top Scorers</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              Leading goal scorers across all major football competitions this season.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {scorers.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
              <Trophy className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-neutral-900 mb-2">No stats available yet</h2>
              <p className="text-neutral-500">
                Top scorer data will appear once the current season is underway.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-neutral-50 text-left text-sm text-neutral-500">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Player</th>
                      <th className="px-4 py-3 font-medium">Team</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Competition</th>
                      <th className="px-4 py-3 font-medium text-center">Apps</th>
                      <th className="px-4 py-3 font-medium text-center">Goals</th>
                      <th className="px-4 py-3 font-medium text-center">Assists</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {scorers.map(({ stat, player, team, competition }, index) => (
                      <tr key={stat.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-neutral-400">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/players/${player.slug}`}
                            className="flex items-center gap-3 hover:text-blue-600 transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                              {player.imageUrl ? (
                                <img
                                  src={player.imageUrl}
                                  alt={player.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{player.name}</div>
                              <div className="text-xs text-neutral-500">{player.nationality}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/teams/${team.slug}`}
                            className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                          >
                            {team.logoUrl ? (
                              <img
                                src={team.logoUrl}
                                alt={team.name}
                                className="w-5 h-5 object-contain"
                              />
                            ) : (
                              <Shield className="w-4 h-4 text-neutral-300" />
                            )}
                            <span className="text-sm">{team.shortName || team.name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">
                          <Link
                            href={`/competitions/${competition.slug}`}
                            className="hover:text-blue-600 transition-colors"
                          >
                            {competition.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-neutral-600">
                          {stat.appearances}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-neutral-900">
                          {stat.goals}
                        </td>
                        <td className="px-4 py-3 text-center text-neutral-600">
                          {stat.assists}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
