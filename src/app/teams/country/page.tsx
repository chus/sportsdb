import Link from "next/link";
import { MapPin, ChevronRight, Shield } from "lucide-react";
import type { Metadata } from "next";
import { getDistinctTeamCountries } from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/layout/page-header";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Football Teams by Country | DataSports",
  description:
    "Browse football clubs and teams by country. Find teams from every football nation in our comprehensive database.",
  openGraph: {
    title: "Football Teams by Country | DataSports",
    description: "Browse football clubs and teams by country.",
    url: `${BASE_URL}/teams/country`,
  },
  alternates: {
    canonical: `${BASE_URL}/teams/country`,
  },
};

export default async function TeamCountryIndexPage() {
  const countries = await getDistinctTeamCountries();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Teams", url: `${BASE_URL}/teams` },
          { name: "By Country", url: `${BASE_URL}/teams/country` },
        ]}
      />
      <CollectionPageJsonLd
        name="Football Teams by Country"
        description={`Browse football clubs from ${countries.length} countries around the world`}
        url={`${BASE_URL}/teams/country`}
      />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Teams by Country"
          subtitle={`Browse football clubs from ${countries.length} countries around the world`}
          accentColor="bg-indigo-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Teams", href: "/teams" },
            { label: "By Country" },
          ]}
          icon={<MapPin className="w-7 h-7 text-indigo-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {countries.map((item) => (
              <Link
                key={item.country}
                href={`/teams/country/${encodeURIComponent(item.country)}`}
                className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-indigo-500" />
                  <div>
                    <span className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                      {item.country}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      <Shield className="w-3 h-3" />
                      {item.count} teams
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
