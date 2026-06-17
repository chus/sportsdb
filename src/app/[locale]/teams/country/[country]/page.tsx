import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, Shield } from "lucide-react";
import type { Metadata } from "next";
import {
  getDistinctTeamCountries,
  getTeamsByCountry,
} from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { getCountryFlagUrl } from "@/lib/utils/country-flags";
import { PageHeader } from "@/components/layout/page-header";

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

  const title = `${adjective} Football Teams – Clubs & Info`;
  const description = `Browse all football clubs from ${decodedCountry}. View team profiles, stadiums, and squad information.`;

  // Match the sitemap gate (>= 3 teams). Countries with < 3 teams render
  // a near-empty list — Google flags them as Soft 404. Emitting noindex
  // here keeps them out of the index without depending on notFound()
  // (which has the Next.js 16 streaming bug that returns HTTP 200).
  const teamsCount = (await getTeamsByCountry(decodedCountry, 100)).length;
  const isThin = teamsCount < 3;

  return {
    title,
    description,
    ...(isThin && { robots: { index: false, follow: true } }),
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
          { name: "Teams", url: `${BASE_URL}/teams` },
          { name: "By Country", url: `${BASE_URL}/teams/country` },
          { name: decodedCountry, url: `${BASE_URL}/teams/country/${encodeURIComponent(decodedCountry)}` },
        ]}
      />
      <ItemListJsonLd
        name={`${adjective} Football Teams`}
        items={teamsList.map((team, i) => ({
          position: i + 1,
          url: `${BASE_URL}/teams/${team.slug}`,
          name: team.name,
          image: team.logoUrl,
        }))}
      />

      <div className="min-h-screen bg-surface-2">
        <PageHeader
          title={`${adjective} Football Teams`}
          subtitle={`${teamsList.length} football clubs from ${decodedCountry}`}
          accentColor="bg-indigo-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Teams", href: "/teams" },
            { label: "By Country", href: "/teams/country" },
            { label: decodedCountry },
          ]}
          icon={(() => {
            const flagUrl = getCountryFlagUrl(decodedCountry);
            return flagUrl ? (
              <Image src={flagUrl} alt={`${decodedCountry} flag`} width={48} height={32} className="rounded shadow-sm" />
            ) : (
              <MapPin className="w-7 h-7 text-indigo-300" />
            );
          })()}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {teamsList.map((team) => (
              <Link
                key={team.id}
                href={`/teams/${team.slug}`}
                className="bg-surface rounded-xl border border-line p-4 hover:shadow-xl transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-surface-2 rounded-lg flex items-center justify-center flex-shrink-0">
                    {team.logoUrl ? (
                      <ImageWithFallback src={team.logoUrl} alt={team.name} className="w-8 h-8 object-contain" width={32} height={32} />
                    ) : (
                      <Shield className="w-6 h-6 text-faint" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-ink group-hover:text-blue-600 transition-colors truncate">
                      {team.name}
                    </div>
                    {team.city && (
                      <div className="text-sm text-muted">{team.city}</div>
                    )}
                    {team.foundedYear && (
                      <div className="text-xs text-faint">Est. {team.foundedYear}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Cross-link back to hub */}
          <div className="mt-8">
            <h2 className="text-lg font-bold text-ink mb-4">Browse More</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/teams/country"
                className="px-4 py-2 bg-surface rounded-lg border border-line text-sm font-medium text-ink hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                All Countries
              </Link>
              <Link
                href="/players/nationality"
                className="px-4 py-2 bg-surface rounded-lg border border-line text-sm font-medium text-ink hover:border-teal-300 hover:text-teal-600 transition-colors"
              >
                Players by Nationality
              </Link>
              <Link
                href="/teams"
                className="px-4 py-2 bg-surface rounded-lg border border-line text-sm font-medium text-ink hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                All Teams
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
