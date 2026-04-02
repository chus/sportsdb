import Link from "next/link";
import Image from "next/image";
import { Shield, Trophy, ChevronRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { getTeamBrowseData } from "@/lib/queries/browse";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/layout/page-header";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { SearchBar } from "@/components/search/search-bar";
import { getCountryFlagUrl } from "@/lib/utils/country-flags";
import { PageTracker } from "@/components/analytics/page-tracker";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { totalTeams } = await getTeamBrowseData();

  return {
    title: `Football Teams – Browse ${totalTeams} Clubs | DataSports`,
    description:
      "Explore football clubs across all major competitions. Browse by country, league, or discover table leaders.",
    openGraph: {
      title: `Football Teams – Browse ${totalTeams} Clubs | DataSports`,
      description:
        "Explore football clubs across all major competitions. Browse by country, league, or discover table leaders.",
      url: `${BASE_URL}/teams`,
    },
    alternates: {
      canonical: `${BASE_URL}/teams`,
    },
  };
}

export default async function TeamsPage() {
  const {
    totalTeams,
    competitionCount,
    countryList,
    competitions,
    tableLeaders,
    recentMatches,
  } = await getTeamBrowseData();

  const competitionsWithTeams = competitions.filter((c) => c.teamCount > 0);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Teams", url: `${BASE_URL}/teams` },
        ]}
      />
      <CollectionPageJsonLd name="Football Teams" description="Browse football clubs and teams worldwide. View squads, results, and standings." url={`${BASE_URL}/teams`} />
      <PageTracker />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          compact
          title="Teams"
          subtitle={`${totalTeams} clubs across ${competitionCount} competitions`}
          accentColor="bg-green-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Teams" },
          ]}
          icon={<Shield className="w-7 h-7 text-green-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Search */}
          <div className="mb-8 max-w-xl">
            <SearchBar placeholder="Search teams..." size="default" />
          </div>

          {/* Featured Competitions */}
          {competitionsWithTeams.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">
                Competitions
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {competitionsWithTeams.map((comp) => (
                  <Link
                    key={comp.id}
                    href={`/competitions/${comp.slug}`}
                    className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-all group flex items-center gap-3"
                  >
                    <ImageWithFallback
                      src={comp.logoUrl}
                      alt={comp.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 object-contain flex-shrink-0 rounded-lg"
                      fallbackClassName="w-10 h-10 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                        {comp.name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {comp.teamCount} teams
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* League Leaders */}
          {tableLeaders.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">
                League Leaders
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tableLeaders.map((entry) => (
                  <Link
                    key={entry.team.id}
                    href={`/teams/${entry.team.slug}`}
                    className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <ImageWithFallback
                        src={entry.team.logoUrl}
                        alt={entry.team.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain flex-shrink-0"
                        fallbackClassName="w-12 h-12 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                          {entry.team.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <ImageWithFallback
                            src={entry.competition.logoUrl}
                            alt={entry.competition.name}
                            width={16}
                            height={16}
                            className="w-4 h-4 object-contain flex-shrink-0"
                            fallbackClassName="w-4 h-4 rounded"
                          />
                          <span className="text-xs text-neutral-500 truncate">
                            {entry.competition.name}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-green-700">
                          1st
                        </div>
                        <div className="text-xs text-neutral-500">
                          {entry.points} pts
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Browse by Country */}
          {countryList.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">
                Browse by Country
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {countryList.map((item) => {
                  const flagUrl = getCountryFlagUrl(item.country);
                  return (
                    <Link
                      key={item.country}
                      href={`/teams/country/${encodeURIComponent(item.country)}`}
                      className="bg-white rounded-xl border border-neutral-200 px-4 py-3 hover:shadow-lg transition-all group flex items-center gap-2.5"
                    >
                      {flagUrl ? (
                        <Image
                          src={flagUrl}
                          alt={`${item.country} flag`}
                          width={20}
                          height={15}
                          className="w-5 h-auto flex-shrink-0 rounded-sm"
                          unoptimized
                        />
                      ) : (
                        <MapPin className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                          {item.country}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {item.count} teams
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recent Results */}
          {recentMatches.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">
                Recent Results
              </h2>
              <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
                {recentMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="flex items-center px-5 py-3.5 hover:bg-neutral-50 transition-colors group"
                  >
                    {/* Home Team */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="text-sm font-medium text-neutral-900 truncate text-right">
                        {match.homeTeam.name}
                      </span>
                      <ImageWithFallback
                        src={match.homeTeam.logoUrl}
                        alt={match.homeTeam.name}
                        width={24}
                        height={24}
                        className="w-6 h-6 object-contain flex-shrink-0"
                        fallbackClassName="w-6 h-6 rounded"
                      />
                    </div>

                    {/* Score */}
                    <div className="mx-4 flex-shrink-0 min-w-[56px] text-center">
                      <span className="text-sm font-bold text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-md">
                        {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
                      </span>
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <ImageWithFallback
                        src={match.awayTeam.logoUrl}
                        alt={match.awayTeam.name}
                        width={24}
                        height={24}
                        className="w-6 h-6 object-contain flex-shrink-0"
                        fallbackClassName="w-6 h-6 rounded"
                      />
                      <span className="text-sm font-medium text-neutral-900 truncate">
                        {match.awayTeam.name}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-blue-500 transition-colors flex-shrink-0 ml-2" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
