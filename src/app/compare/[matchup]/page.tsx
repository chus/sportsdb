import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, TrendingUp, Target, Clock, AlertTriangle, Shield } from "lucide-react";
import type { Metadata } from "next";
import {
  getTopPlayerPairs,
  getPlayerWithAggregatedStats,
} from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ matchup: string }>;
}

function parseMatchup(matchup: string): { slug1: string; slug2: string } | null {
  const idx = matchup.indexOf("-vs-");
  if (idx === -1) return null;
  const slug1 = matchup.slice(0, idx);
  const slug2 = matchup.slice(idx + 4);
  if (!slug1 || !slug2) return null;
  return { slug1, slug2 };
}

export async function generateStaticParams() {
  const topPlayers = await getTopPlayerPairs(15);
  const params: { matchup: string }[] = [];

  for (let i = 0; i < topPlayers.length; i++) {
    for (let j = i + 1; j < topPlayers.length; j++) {
      params.push({
        matchup: `${topPlayers[i].slug}-vs-${topPlayers[j].slug}`,
      });
    }
  }

  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { matchup } = await params;
  const parsed = parseMatchup(matchup);
  if (!parsed) return { title: "Not Found" };

  const [p1, p2] = await Promise.all([
    getPlayerWithAggregatedStats(parsed.slug1),
    getPlayerWithAggregatedStats(parsed.slug2),
  ]);

  if (!p1 || !p2) return { title: "Not Found" };

  const title = `${p1.name} vs ${p2.name} – Stats Comparison | SportsDB`;
  const description = `Compare ${p1.name} and ${p2.name} side by side. Goals, assists, appearances, and career statistics.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/compare/${matchup}`,
    },
    alternates: { canonical: `${BASE_URL}/compare/${matchup}` },
  };
}

function StatRow({
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

function PlayerHeader({ player }: {
  player: {
    name: string;
    slug: string;
    position: string;
    imageUrl: string | null;
    team: { name: string; slug: string; logoUrl: string | null } | null;
  };
}) {
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

export default async function CompareMatchupPage({ params }: PageProps) {
  const { matchup } = await params;
  const parsed = parseMatchup(matchup);
  if (!parsed) notFound();

  const [player1, player2] = await Promise.all([
    getPlayerWithAggregatedStats(parsed.slug1),
    getPlayerWithAggregatedStats(parsed.slug2),
  ]);

  if (!player1 || !player2) notFound();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Compare", url: `${BASE_URL}/compare` },
          { name: `${player1.name} vs ${player2.name}`, url: `${BASE_URL}/compare/${matchup}` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-8">
            <Link
              href="/compare"
              className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-4"
            >
              &larr; Compare Players
            </Link>
            <h1 className="text-3xl font-bold text-neutral-900">
              {player1.name} vs {player2.name}
            </h1>
            <p className="text-neutral-500 mt-1">Career statistics comparison</p>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="grid grid-cols-3 border-b border-neutral-200">
              <div className="border-r border-neutral-200">
                <PlayerHeader player={player1} />
              </div>
              <div className="flex items-center justify-center bg-neutral-50">
                <span className="text-2xl font-bold text-neutral-300">VS</span>
              </div>
              <div className="border-l border-neutral-200">
                <PlayerHeader player={player2} />
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 text-center">
                Career Statistics
              </h3>
              <StatRow
                label="Apps"
                value1={player1.totalStats.appearances}
                value2={player2.totalStats.appearances}
                icon={TrendingUp}
              />
              <StatRow
                label="Goals"
                value1={player1.totalStats.goals}
                value2={player2.totalStats.goals}
                icon={Target}
              />
              <StatRow
                label="Assists"
                value1={player1.totalStats.assists}
                value2={player2.totalStats.assists}
                icon={TrendingUp}
              />
              <StatRow
                label="Minutes"
                value1={player1.totalStats.minutesPlayed}
                value2={player2.totalStats.minutesPlayed}
                icon={Clock}
              />
              <StatRow
                label="Yellows"
                value1={player1.totalStats.yellowCards}
                value2={player2.totalStats.yellowCards}
                icon={AlertTriangle}
                higherIsBetter={false}
              />
              <StatRow
                label="Reds"
                value1={player1.totalStats.redCards}
                value2={player2.totalStats.redCards}
                icon={AlertTriangle}
                higherIsBetter={false}
              />

              {player1.totalStats.appearances > 0 && player2.totalStats.appearances > 0 && (
                <div className="mt-6 pt-4 border-t border-neutral-200">
                  <h4 className="text-sm font-medium text-neutral-500 text-center mb-4">
                    Ratios
                  </h4>
                  <StatRow
                    label="Goals/Game"
                    value1={parseFloat((player1.totalStats.goals / player1.totalStats.appearances).toFixed(2))}
                    value2={parseFloat((player2.totalStats.goals / player2.totalStats.appearances).toFixed(2))}
                    icon={Target}
                  />
                  <StatRow
                    label="Assists/Game"
                    value1={parseFloat((player1.totalStats.assists / player1.totalStats.appearances).toFixed(2))}
                    value2={parseFloat((player2.totalStats.assists / player2.totalStats.appearances).toFixed(2))}
                    icon={TrendingUp}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href={`/compare/players?p1=${player1.slug}&p2=${player2.slug}`}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Open in interactive comparison tool &rarr;
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
