import Link from "next/link";
import Image from "next/image";
import { Trophy, ChevronRight, Globe } from "lucide-react";
import type { Metadata } from "next";
import { getCompetitionBrowseData } from "@/lib/queries/browse";
import { PageHeader } from "@/components/layout/page-header";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { SearchBar } from "@/components/search/search-bar";
import { getCountryFlagUrl } from "@/lib/utils/country-flags";
import { BreadcrumbJsonLd, CollectionPageJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { PageTracker } from "@/components/analytics/page-tracker";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Football Competitions – Leagues & Tournaments | DataSports",
  description:
    "Explore football leagues and tournaments worldwide. Browse Premier League, La Liga, Bundesliga, Serie A, Champions League and more.",
  openGraph: {
    title: "Football Competitions – Leagues & Tournaments | DataSports",
    description:
      "Explore football leagues and tournaments worldwide. Browse Premier League, La Liga, Bundesliga, Serie A, Champions League and more.",
    url: `${BASE_URL}/competitions`,
    siteName: "DataSports",
    type: "website",
  },
  alternates: {
    canonical: `${BASE_URL}/competitions`,
  },
};

export default async function CompetitionsPage() {
  const { totalCount, competitions } = await getCompetitionBrowseData();

  // Major leagues: type="league" with teams and a leader
  const majorLeagues = competitions.filter(
    (c) => c.type === "league" && c.teamCount > 0 && c.leader
  );

  // Cup competitions
  const cupCompetitions = competitions.filter((c) => c.type === "cup");

  // Group all competitions by region
  const regionMap = new Map<string, typeof competitions>();
  for (const comp of competitions) {
    const region = comp.region;
    if (!regionMap.has(region)) {
      regionMap.set(region, []);
    }
    regionMap.get(region)!.push(comp);
  }

  // Sort regions: Europe first, then South America, International, Other
  const regionOrder = ["Europe", "South America", "International", "Other"];
  const sortedRegions = [...regionMap.entries()].sort(
    (a, b) =>
      (regionOrder.indexOf(a[0]) === -1 ? 999 : regionOrder.indexOf(a[0])) -
      (regionOrder.indexOf(b[0]) === -1 ? 999 : regionOrder.indexOf(b[0]))
  );

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Competitions", url: `${BASE_URL}/competitions` },
        ]}
      />
      <CollectionPageJsonLd name="Football Competitions" description="Explore football leagues and tournaments worldwide. Browse standings, results, and stats." url={`${BASE_URL}/competitions`} />
      <FAQJsonLd
        items={[
          { question: "Which football leagues does DataSports cover?", answer: "DataSports covers major leagues including the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, as well as cup competitions and international tournaments." },
          { question: "What data is available for each competition?", answer: "Each competition page includes current standings, top scorers, top assists, recent results, upcoming fixtures, and matchday-by-matchday breakdowns." },
          { question: "How are competitions organized on DataSports?", answer: "Competitions are grouped by type (leagues vs cups) and by region (Europe, South America, International). You can browse or search for any competition." },
        ]}
      />
      <PageTracker />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Competitions"
          subtitle={`Covering ${totalCount} leagues and tournaments worldwide`}
          accentColor="bg-purple-800"
          compact
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Competitions" },
          ]}
          icon={<Trophy className="w-7 h-7 text-purple-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Inline Search */}
          <div className="mb-8">
            <SearchBar placeholder="Search competitions..." size="default" />
          </div>

          {/* Major Leagues */}
          {majorLeagues.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">
                Major Leagues
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {majorLeagues.map((comp) => {
                  const flagUrl = comp.country
                    ? getCountryFlagUrl(comp.country)
                    : null;

                  return (
                    <Link
                      key={comp.id}
                      href={`/competitions/${comp.slug}`}
                      className="bg-white rounded-xl border border-neutral-200 p-6 min-h-[180px] hover:shadow-xl transition-all group flex flex-col"
                    >
                      {/* Logo + Name */}
                      <div className="flex items-start gap-4 mb-3">
                        <div className="flex-shrink-0">
                          <ImageWithFallback
                            src={comp.logoUrl}
                            alt={comp.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                            {comp.name}
                          </h3>
                          {comp.country && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {flagUrl && (
                                <Image
                                  src={flagUrl}
                                  alt={comp.country}
                                  width={16}
                                  height={12}
                                  className="w-4 h-3 object-cover rounded-sm"
                                  unoptimized
                                />
                              )}
                              <span className="text-sm text-neutral-500">
                                {comp.country}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Leader */}
                      {comp.leader && (
                        <div className="text-sm text-neutral-600 mb-2">
                          Led by{" "}
                          <span className="font-semibold text-neutral-800">
                            {comp.leader.teamName}
                          </span>{" "}
                          &mdash; {comp.leader.points} pts
                        </div>
                      )}

                      {/* Stats row */}
                      <div className="mt-auto flex items-center gap-3 text-xs text-neutral-500">
                        {comp.teamCount > 0 && (
                          <span>{comp.teamCount} teams</span>
                        )}
                        {comp.currentMatchday && (
                          <span>Matchday {comp.currentMatchday}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* By Region */}
          {sortedRegions.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">
                By Region
              </h2>
              <div className="space-y-6">
                {sortedRegions.map(([region, comps]) => (
                  <div key={region}>
                    <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-purple-500" />
                      {region}
                    </h3>
                    <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                      {comps.map((comp) => {
                        const flagUrl = comp.country
                          ? getCountryFlagUrl(comp.country)
                          : null;

                        return (
                          <Link
                            key={comp.id}
                            href={`/competitions/${comp.slug}`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors group"
                          >
                            <ImageWithFallback
                              src={comp.logoUrl}
                              alt={comp.name}
                              width={24}
                              height={24}
                              className="w-6 h-6 object-contain flex-shrink-0"
                            />
                            <span className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors flex-1 min-w-0 truncate">
                              {comp.name}
                            </span>
                            {comp.country && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {flagUrl && (
                                  <Image
                                    src={flagUrl}
                                    alt={comp.country}
                                    width={16}
                                    height={12}
                                    className="w-4 h-3 object-cover rounded-sm"
                                    unoptimized
                                  />
                                )}
                                <span className="text-sm text-neutral-500 hidden sm:inline">
                                  {comp.country}
                                </span>
                              </div>
                            )}
                            <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Cup Competitions */}
          {cupCompetitions.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">
                Cup Competitions
              </h2>
              <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                {cupCompetitions.map((comp) => {
                  const flagUrl = comp.country
                    ? getCountryFlagUrl(comp.country)
                    : null;

                  return (
                    <Link
                      key={comp.id}
                      href={`/competitions/${comp.slug}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors group"
                    >
                      <ImageWithFallback
                        src={comp.logoUrl}
                        alt={comp.name}
                        width={24}
                        height={24}
                        className="w-6 h-6 object-contain flex-shrink-0"
                      />
                      <span className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors flex-1 min-w-0 truncate">
                        {comp.name}
                      </span>
                      {comp.country && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {flagUrl && (
                            <Image
                              src={flagUrl}
                              alt={comp.country}
                              width={16}
                              height={12}
                              className="w-4 h-3 object-cover rounded-sm"
                              unoptimized
                            />
                          )}
                          <span className="text-sm text-neutral-500 hidden sm:inline">
                            {comp.country}
                          </span>
                        </div>
                      )}
                      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
