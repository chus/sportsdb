import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Users, TrendingUp, Target, Clock, AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { players, playerSeasonStats, competitionSeasons, seasons, teams } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { SearchBar } from "@/components/search/search-bar";

interface ComparePageProps {
  searchParams: Promise<{ p1?: string; p2?: string }>;
}

export const metadata: Metadata = {
  title: "Compare Players | SportsDB",
  description: "Compare two football players side by side - stats, career, and performance metrics.",
};

interface PlayerWithStats {
  id: string;
  name: string;
  slug: string;
  position: string;
  nationality: string | null;
  imageUrl: string | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  team: { name: string; slug: string; logoUrl: string | null } | null;
  totalStats: {
    appearances: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    minutesPlayed: number;
  };
}

async function getPlayerWithStats(slug: string): Promise<PlayerWithStats | null> {
  const player = await db
    .select()
    .from(players)
    .where(eq(players.slug, slug))
    .limit(1);

  if (player.length === 0) return null;

  const p = player[0];

  // Get aggregated stats
  const stats = await db
    .select({
      appearances: sql<number>`sum(${playerSeasonStats.appearances})::int`,
      goals: sql<number>`sum(${playerSeasonStats.goals})::int`,
      assists: sql<number>`sum(${playerSeasonStats.assists})::int`,
      yellowCards: sql<number>`sum(${playerSeasonStats.yellowCards})::int`,
      redCards: sql<number>`sum(${playerSeasonStats.redCards})::int`,
      minutesPlayed: sql<number>`sum(${playerSeasonStats.minutesPlayed})::int`,
    })
    .from(playerSeasonStats)
    .where(eq(playerSeasonStats.playerId, p.id));

  // Get current team
  const teamResult = await db.execute(sql`
    SELECT t.name, t.slug, t.logo_url
    FROM player_team_history pth
    JOIN teams t ON t.id = pth.team_id
    WHERE pth.player_id = ${p.id} AND pth.valid_to IS NULL
    LIMIT 1
  `);

  const team = teamResult.rows[0] as { name: string; slug: string; logo_url: string | null } | undefined;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    position: p.position,
    nationality: p.nationality,
    imageUrl: p.imageUrl,
    dateOfBirth: p.dateOfBirth,
    heightCm: p.heightCm,
    team: team ? { name: team.name, slug: team.slug, logoUrl: team.logo_url } : null,
    totalStats: {
      appearances: stats[0]?.appearances || 0,
      goals: stats[0]?.goals || 0,
      assists: stats[0]?.assists || 0,
      yellowCards: stats[0]?.yellowCards || 0,
      redCards: stats[0]?.redCards || 0,
      minutesPlayed: stats[0]?.minutesPlayed || 0,
    },
  };
}

function StatComparison({
  label,
  value1,
  value2,
  icon: Icon,
  higherIsBetter = true,
}: {
  label: string;
  value1: number;
  value2: number;
  icon: React.ElementType;
  higherIsBetter?: boolean;
}) {
  const p1Better = higherIsBetter ? value1 > value2 : value1 < value2;
  const p2Better = higherIsBetter ? value2 > value1 : value2 < value1;
  const equal = value1 === value2;

  return (
    <div className="flex items-center py-3 border-b border-neutral-100 last:border-0">
      <div className="flex-1 text-right">
        <span className={`text-lg font-semibold ${p1Better ? "text-green-600" : equal ? "text-neutral-700" : "text-neutral-500"}`}>
          {value1.toLocaleString()}
        </span>
      </div>
      <div className="w-32 text-center">
        <div className="flex items-center justify-center gap-2 text-neutral-500">
          <Icon className="w-4 h-4" />
          <span className="text-sm">{label}</span>
        </div>
      </div>
      <div className="flex-1 text-left">
        <span className={`text-lg font-semibold ${p2Better ? "text-green-600" : equal ? "text-neutral-700" : "text-neutral-500"}`}>
          {value2.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function PlayerCard({ player }: { player: PlayerWithStats }) {
  return (
    <Link href={`/players/${player.slug}`} className="block">
      <div className="text-center p-6 hover:bg-neutral-50 transition-colors rounded-xl">
        <div className="w-24 h-24 bg-neutral-100 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
          {player.imageUrl ? (
            <img src={player.imageUrl} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <Users className="w-12 h-12 text-neutral-300" />
          )}
        </div>
        <h2 className="text-xl font-bold text-neutral-900 hover:text-blue-600 transition-colors">
          {player.name}
        </h2>
        <p className="text-neutral-500">{player.position}</p>
        {player.team && (
          <div className="flex items-center justify-center gap-2 mt-2">
            {player.team.logoUrl && (
              <img src={player.team.logoUrl} alt={player.team.name} className="w-5 h-5 object-contain" />
            )}
            <span className="text-sm text-neutral-600">{player.team.name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptySlot({ position }: { position: 1 | 2 }) {
  return (
    <div className="text-center p-6">
      <div className="w-24 h-24 bg-neutral-100 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-dashed border-neutral-300">
        <Users className="w-12 h-12 text-neutral-300" />
      </div>
      <p className="text-neutral-500">
        Search for Player {position}
      </p>
    </div>
  );
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const p1Slug = params.p1;
  const p2Slug = params.p2;

  const [player1, player2] = await Promise.all([
    p1Slug ? getPlayerWithStats(p1Slug) : null,
    p2Slug ? getPlayerWithStats(p2Slug) : null,
  ]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/search?type=player"
            className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Search
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900">Compare Players</h1>
          <p className="text-neutral-500 mt-1">
            Select two players to compare their statistics side by side
          </p>
        </div>

        {/* Player Selection */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Player 1
            </label>
            <form action="/compare/players" method="get">
              <input type="hidden" name="p2" value={p2Slug || ""} />
              <div className="flex gap-2">
                <input
                  type="text"
                  name="p1"
                  defaultValue={p1Slug || ""}
                  placeholder="Enter player slug..."
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Load
                </button>
              </div>
            </form>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Player 2
            </label>
            <form action="/compare/players" method="get">
              <input type="hidden" name="p1" value={p1Slug || ""} />
              <div className="flex gap-2">
                <input
                  type="text"
                  name="p2"
                  defaultValue={p2Slug || ""}
                  placeholder="Enter player slug..."
                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Load
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Comparison View */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          {/* Player Headers */}
          <div className="grid grid-cols-3 border-b border-neutral-200">
            <div className="border-r border-neutral-200">
              {player1 ? <PlayerCard player={player1} /> : <EmptySlot position={1} />}
            </div>
            <div className="flex items-center justify-center bg-neutral-50">
              <span className="text-2xl font-bold text-neutral-300">VS</span>
            </div>
            <div className="border-l border-neutral-200">
              {player2 ? <PlayerCard player={player2} /> : <EmptySlot position={2} />}
            </div>
          </div>

          {/* Stats Comparison */}
          {player1 && player2 ? (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 text-center">
                Career Statistics
              </h3>
              <StatComparison
                label="Apps"
                value1={player1.totalStats.appearances}
                value2={player2.totalStats.appearances}
                icon={TrendingUp}
              />
              <StatComparison
                label="Goals"
                value1={player1.totalStats.goals}
                value2={player2.totalStats.goals}
                icon={Target}
              />
              <StatComparison
                label="Assists"
                value1={player1.totalStats.assists}
                value2={player2.totalStats.assists}
                icon={TrendingUp}
              />
              <StatComparison
                label="Minutes"
                value1={player1.totalStats.minutesPlayed}
                value2={player2.totalStats.minutesPlayed}
                icon={Clock}
              />
              <StatComparison
                label="Yellows"
                value1={player1.totalStats.yellowCards}
                value2={player2.totalStats.yellowCards}
                icon={AlertTriangle}
                higherIsBetter={false}
              />
              <StatComparison
                label="Reds"
                value1={player1.totalStats.redCards}
                value2={player2.totalStats.redCards}
                icon={AlertTriangle}
                higherIsBetter={false}
              />

              {/* Goals per game ratio */}
              {player1.totalStats.appearances > 0 && player2.totalStats.appearances > 0 && (
                <div className="mt-6 pt-4 border-t border-neutral-200">
                  <h4 className="text-sm font-medium text-neutral-500 text-center mb-4">
                    Ratios
                  </h4>
                  <StatComparison
                    label="Goals/Game"
                    value1={parseFloat((player1.totalStats.goals / player1.totalStats.appearances).toFixed(2))}
                    value2={parseFloat((player2.totalStats.goals / player2.totalStats.appearances).toFixed(2))}
                    icon={Target}
                  />
                  <StatComparison
                    label="Assists/Game"
                    value1={parseFloat((player1.totalStats.assists / player1.totalStats.appearances).toFixed(2))}
                    value2={parseFloat((player2.totalStats.assists / player2.totalStats.appearances).toFixed(2))}
                    icon={TrendingUp}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-neutral-200 mx-auto mb-4" />
              <p className="text-neutral-500">
                Select two players above to compare their statistics
              </p>
              <p className="text-sm text-neutral-400 mt-2">
                Try: erling-haaland vs mohamed-salah
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
