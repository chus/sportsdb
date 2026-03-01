import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Shield } from "lucide-react";
import type { Metadata } from "next";
import {
  getDistinctTeamCountries,
  getTeamsByCountry,
} from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ country: string }>;
}

export async function generateStaticParams() {
  const countries = await getDistinctTeamCountries();
  return countries.map((c) => ({ country: c.country }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country } = await params;
  const decodedCountry = decodeURIComponent(country);
  const adjective = countryAdjective(decodedCountry);

  const title = `${adjective} Football Teams – Clubs & Info | SportsDB`;
  const description = `Browse all football clubs from ${decodedCountry}. View team profiles, stadiums, and squad information.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/teams/country/${country}`,
    },
    alternates: { canonical: `${BASE_URL}/teams/country/${encodeURIComponent(decodedCountry)}` },
  };
}

function countryAdjective(country: string): string {
  const map: Record<string, string> = {
    England: "English",
    Spain: "Spanish",
    Germany: "German",
    Italy: "Italian",
    France: "French",
    Netherlands: "Dutch",
    Portugal: "Portuguese",
    Brazil: "Brazilian",
    Argentina: "Argentine",
    Belgium: "Belgian",
    Scotland: "Scottish",
    Turkey: "Turkish",
    USA: "American",
    "United States": "American",
    Japan: "Japanese",
    Mexico: "Mexican",
    Australia: "Australian",
  };
  return map[country] || country;
}

export default async function CountryTeamsPage({ params }: PageProps) {
  const { country } = await params;
  const decodedCountry = decodeURIComponent(country);
  const teamsList = await getTeamsByCountry(decodedCountry, 100);

  if (teamsList.length === 0) {
    notFound();
  }

  const adjective = countryAdjective(decodedCountry);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Teams", url: `${BASE_URL}/search?type=team` },
          { name: "By Country", url: `${BASE_URL}/teams/country` },
          { name: decodedCountry, url: `${BASE_URL}/teams/country/${encodeURIComponent(decodedCountry)}` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/teams/country" className="text-white/70 hover:text-white transition-colors text-sm">
                All Countries
              </Link>
              <span className="text-white/40">/</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">{adjective} Football Teams</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              {teamsList.length} football clubs from {decodedCountry}.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {teamsList.map((team) => (
              <Link
                key={team.id}
                href={`/teams/${team.slug}`}
                className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-xl transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {team.logoUrl ? (
                      <img src={team.logoUrl} alt={team.name} className="w-8 h-8 object-contain" />
                    ) : (
                      <Shield className="w-6 h-6 text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                      {team.name}
                    </div>
                    {team.city && (
                      <div className="text-sm text-neutral-500">{team.city}</div>
                    )}
                    {team.foundedYear && (
                      <div className="text-xs text-neutral-400">Est. {team.foundedYear}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
