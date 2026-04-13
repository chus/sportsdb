import Link from "next/link";
import { Globe, ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import { getDistinctNationalities } from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/json-ld";
import { PageHeader } from "@/components/layout/page-header";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Football Players by Nationality | DataSports",
  description:
    "Browse football players by nationality. Find players from every country in our comprehensive football database.",
  openGraph: {
    title: "Football Players by Nationality | DataSports",
    description: "Browse football players by nationality.",
    url: `${BASE_URL}/players/nationality`,
  },
  alternates: {
    canonical: `${BASE_URL}/players/nationality`,
  },
};

export default async function NationalityIndexPage() {
  const nationalities = await getDistinctNationalities();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Players", url: `${BASE_URL}/players` },
          { name: "By Nationality", url: `${BASE_URL}/players/nationality` },
        ]}
      />
      <CollectionPageJsonLd
        name="Football Players by Nationality"
        description={`Browse football players from ${nationalities.length} countries around the world`}
        url={`${BASE_URL}/players/nationality`}
      />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Players by Nationality"
          subtitle={`Browse football players from ${nationalities.length} countries around the world`}
          accentColor="bg-teal-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Players", href: "/players" },
            { label: "By Nationality" },
          ]}
          icon={<Globe className="w-7 h-7 text-teal-300" />}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nationalities.map((item) => (
              <Link
                key={item.nationality}
                href={`/players/nationality/${encodeURIComponent(item.nationality)}`}
                className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-md transition-shadow flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-teal-500" />
                  <div>
                    <span className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors">
                      {item.nationality}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      <Users className="w-3 h-3" />
                      {item.count} players
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
