import Link from "next/link";
import { Globe, ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import { getDistinctNationalities } from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Football Players by Nationality | SportsDB",
  description:
    "Browse football players by nationality. Find players from every country in our comprehensive football database.",
  openGraph: {
    title: "Football Players by Nationality | SportsDB",
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
          { name: "Players", url: `${BASE_URL}/search?type=player` },
          { name: "By Nationality", url: `${BASE_URL}/players/nationality` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-green-500 via-teal-500 to-cyan-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">Players by Nationality</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              Browse football players from {nationalities.length} countries around the world.
            </p>
          </div>
        </div>

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
