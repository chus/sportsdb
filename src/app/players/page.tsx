import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Users, ArrowRight, Shield, Crosshair, ShieldHalf, Goal } from "lucide-react";
import { getPlayerBrowseData } from "@/lib/queries/browse";
import type { LeaderboardEntry } from "@/lib/queries/leaderboards";
import { PageHeader } from "@/components/layout/page-header";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { PlayerLink } from "@/components/player/player-link";
import { SearchBar } from "@/components/search/search-bar";
import { getCountryFlagUrl } from "@/lib/utils/country-flags";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/json-ld";
import { PageTracker } from "@/components/analytics/page-tracker";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { totalPlayers } = await getPlayerBrowseData();

  return {
    title: `Football Players – Browse ${totalPlayers.toLocaleString()} Players | DataSports`,
    description:
      "Explore football players across all major competitions. Browse by position, nationality, or discover top scorers and rising stars.",
    openGraph: {
      title: `Football Players – Browse ${totalPlayers.toLocaleString()} Players | DataSports`,
      description:
        "Explore football players across all major competitions. Browse by position, nationality, or discover top scorers and rising stars.",
      url: `${BASE_URL}/players`,
    },
    alternates: {
      canonical: `${BASE_URL}/players`,
    },
  };
}

const POSITION_META: Record<string, { icon: React.ReactNode; color: string }> = {
  Goalkeeper: {
    icon: <ShieldHalf className="w-6 h-6" />,
    color: "text-amber-500",
  },
  Defender: {
    icon: <Shield className="w-6 h-6" />,
    color: "text-blue-500",
  },
  Midfielder: {
    icon: <Crosshair className="w-6 h-6" />,
    color: "text-green-500",
  },
  Forward: {
    icon: <Goal className="w-6 h-6" />,
    color: "text-red-500",
  },
};

// Normalize position names like "Goalkeeper" -> "Goalkeepers" for display
function positionPlural(pos: string): string {
  if (pos.endsWith("er")) return pos + "s"; // Defender -> Defenders, Goalkeeper -> Goalkeepers
  if (pos.endsWith("d")) return pos + "s"; // Forward -> Forwards (already ends in d)
  return pos + "s";
}

// Map position name to URL segment
function positionSlug(pos: string): string {
  return pos.toLowerCase();
}

export default async function PlayersPage() {
  const data = await getPlayerBrowseData();

  const {
    totalPlayers,
    competitionCount,
    featuredPlayers,
    topScorers,
    topAssists,
    positionCounts,
    nationalities,
    recentlyUpdated,
    competitions,
  } = data;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Players", url: `${BASE_URL}/players` },
        ]}
      />
      <CollectionPageJsonLd name="Football Players" description="Browse football players worldwide. Search by name, nationality, or position." url={`${BASE_URL}/players`} />
      <PageTracker />

      <div className="min-h-screen bg-neutral-50">
        {/* Hero */}
        <PageHeader
          title="Players"
          subtitle={`Explore ${totalPlayers.toLocaleString()} players across ${competitionCount} competitions`}
          accentColor="bg-blue-800"
          compact
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Players" },
          ]}
          icon={<Users className="w-7 h-7 text-blue-300" />}
        />

        {/* Search */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="max-w-md">
            <SearchBar placeholder="Search players..." size="default" />
          </div>
        </div>

        {/* Featured Players */}
        {featuredPlayers.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pb-12">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">
              Featured Players
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredPlayers.map((entry: LeaderboardEntry) => (
                <PlayerLink
                  key={entry.player.id}
                  slug={entry.player.slug}
                  isLinkWorthy={entry.player.isIndexable ?? false}
                  className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-all text-center group"
                >
                  <div className="flex justify-center mb-3">
                    <ImageWithFallback
                      src={entry.player.imageUrl}
                      alt={entry.player.name}
                      width={120}
                      height={120}
                      className="w-[120px] h-[120px] rounded-full object-cover"
                    />
                  </div>
                  <div className="font-bold text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                    {entry.player.name}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-500 mt-1">
                    {entry.team.logoUrl && (
                      <ImageWithFallback
                        src={entry.team.logoUrl}
                        alt={entry.team.name}
                        width={16}
                        height={16}
                        className="w-4 h-4 object-contain"
                      />
                    )}
                    <span className="truncate">{entry.team.name}</span>
                  </div>
                  <div className="text-sm font-semibold text-neutral-700 mt-2">
                    {entry.stat.goals} goals this season
                  </div>
                </PlayerLink>
              ))}
            </div>
          </section>
        )}

        {/* Top Scorers Strip */}
        {topScorers.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-neutral-900">
                Top Scorers
              </h2>
              <Link
                href="/top-scorers"
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-2 snap-x snap-mandatory scrollbar-hide">
              {topScorers.slice(0, 10).map((entry: LeaderboardEntry, idx: number) => (
                <PlayerLink
                  key={entry.player.id}
                  slug={entry.player.slug}
                  isLinkWorthy={entry.player.isIndexable ?? false}
                  className="flex items-center gap-3 bg-white rounded-xl border border-neutral-200 px-4 py-3 hover:shadow-lg transition-all min-w-[260px] snap-start flex-shrink-0 group"
                >
                  <span className="text-lg font-bold text-neutral-400 w-6 text-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-neutral-100">
                    <ImageWithFallback
                      src={entry.player.imageUrl}
                      alt={entry.player.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                      {entry.player.name}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {entry.team.shortName || entry.team.name}
                    </div>
                  </div>
                  <div className="font-bold text-neutral-900 flex-shrink-0">
                    {entry.stat.goals}
                  </div>
                </PlayerLink>
              ))}
            </div>
          </section>
        )}

        {/* Top Assists Strip */}
        {topAssists.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-neutral-900">
                Top Assists
              </h2>
              <Link
                href="/top-assists"
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-2 snap-x snap-mandatory scrollbar-hide">
              {topAssists.slice(0, 10).map((entry: LeaderboardEntry, idx: number) => (
                <PlayerLink
                  key={entry.player.id}
                  slug={entry.player.slug}
                  isLinkWorthy={entry.player.isIndexable ?? false}
                  className="flex items-center gap-3 bg-white rounded-xl border border-neutral-200 px-4 py-3 hover:shadow-lg transition-all min-w-[260px] snap-start flex-shrink-0 group"
                >
                  <span className="text-lg font-bold text-neutral-400 w-6 text-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-neutral-100">
                    <ImageWithFallback
                      src={entry.player.imageUrl}
                      alt={entry.player.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                      {entry.player.name}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {entry.team.shortName || entry.team.name}
                    </div>
                  </div>
                  <div className="font-bold text-neutral-900 flex-shrink-0">
                    {entry.stat.assists}
                  </div>
                </PlayerLink>
              ))}
            </div>
          </section>
        )}

        {/* Browse by Position */}
        {positionCounts.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pb-12">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">
              Browse by Position
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {positionCounts.map((p) => {
                const meta = POSITION_META[p.position];
                return (
                  <Link
                    key={p.position}
                    href={`/players/position/${positionSlug(p.position)}`}
                    className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {meta ? (
                        <span className={meta.color}>{meta.icon}</span>
                      ) : (
                        <span className="w-3 h-3 rounded-full bg-neutral-300" />
                      )}
                      <h3 className="font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">
                        {positionPlural(p.position)}
                      </h3>
                    </div>
                    <p className="text-sm text-neutral-500">
                      {p.count.toLocaleString()} players
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Browse by Nationality */}
        {nationalities.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pb-12">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">
              Browse by Nationality
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {nationalities.map((n) => {
                const flagUrl = getCountryFlagUrl(n.nationality, 40);
                return (
                  <Link
                    key={n.nationality}
                    href={`/players/nationality/${encodeURIComponent(n.nationality)}`}
                    className="flex items-center gap-3 bg-white rounded-xl border border-neutral-200 px-4 py-3 hover:shadow-lg transition-all group"
                  >
                    {flagUrl ? (
                      <Image
                        src={flagUrl}
                        alt={`${n.nationality} flag`}
                        width={20}
                        height={15}
                        className="w-5 h-auto object-contain flex-shrink-0"
                        unoptimized
                      />
                    ) : (
                      <span className="w-5 h-3.5 rounded-sm bg-neutral-200 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 transition-colors truncate flex-1">
                      {n.nationality}
                    </span>
                    <span className="text-xs text-neutral-400 flex-shrink-0">
                      {n.count.toLocaleString()}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Browse by Competition */}
        {competitions.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pb-12">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">
              Browse by Competition
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {competitions.map((comp) => (
                <Link
                  key={comp.id}
                  href={`/competitions/${comp.slug}`}
                  className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-all flex items-center gap-3 group"
                >
                  <ImageWithFallback
                    src={comp.logoUrl}
                    alt={comp.name}
                    width={24}
                    height={24}
                    className="w-6 h-6 object-contain flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                      {comp.name}
                    </div>
                  </div>
                  <span className="text-sm text-blue-600 flex-shrink-0 flex items-center gap-1">
                    View players <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recently Updated */}
        {recentlyUpdated.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 pb-12">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">
              Recently Updated Players
            </h2>
            <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
              {recentlyUpdated.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-neutral-100">
                    <ImageWithFallback
                      src={p.imageUrl}
                      alt={p.name}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <PlayerLink
                      slug={p.slug}
                      isLinkWorthy={p.isIndexable}
                      className="font-medium text-sm text-neutral-900 hover:text-blue-600 transition-colors"
                    >
                      {p.name}
                    </PlayerLink>
                    <div className="text-xs text-neutral-500">
                      {p.position}
                      {p.team && <> &middot; {p.team.name}</>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
