import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Globe, User, Shield } from "lucide-react";
import type { Metadata } from "next";
import {
  getDistinctNationalities,
  getPlayersByNationality,
} from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { getCountryFlagUrl } from "@/lib/utils/country-flags";
import { PageHeader } from "@/components/layout/page-header";
import { PlayerLink } from "@/components/player/player-link";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ country: string }>;
}

export async function generateStaticParams() {
  const nationalities = await getDistinctNationalities();
  return nationalities.map((n) => ({ country: n.nationality }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country } = await params;
  const nationality = decodeURIComponent(country);
  const adjective = nationalityAdjective(nationality);

  const title = `${adjective} Football Players – Full List | DataSports`;
  const description = `Browse all ${adjective} football players. View profiles, positions, and current teams for players from ${nationality}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/players/nationality/${country}`,
    },
    alternates: { canonical: `${BASE_URL}/players/nationality/${encodeURIComponent(nationality)}` },
  };
}

function nationalityAdjective(country: string): string {
  const map: Record<string, string> = {
    Brazil: "Brazilian",
    France: "French",
    Germany: "German",
    Spain: "Spanish",
    England: "English",
    Italy: "Italian",
    Argentina: "Argentine",
    Portugal: "Portuguese",
    Netherlands: "Dutch",
    Belgium: "Belgian",
    Colombia: "Colombian",
    Uruguay: "Uruguayan",
    Croatia: "Croatian",
    Nigeria: "Nigerian",
    Japan: "Japanese",
    "South Korea": "South Korean",
    Mexico: "Mexican",
    USA: "American",
    "United States": "American",
    Wales: "Welsh",
    Scotland: "Scottish",
    Ireland: "Irish",
    Poland: "Polish",
    Denmark: "Danish",
    Sweden: "Swedish",
    Norway: "Norwegian",
    Switzerland: "Swiss",
    Austria: "Austrian",
    Serbia: "Serbian",
    Turkey: "Turkish",
    Ghana: "Ghanaian",
    Cameroon: "Cameroonian",
    Senegal: "Senegalese",
    Morocco: "Moroccan",
    Egypt: "Egyptian",
    Australia: "Australian",
    Canada: "Canadian",
    Chile: "Chilean",
    Paraguay: "Paraguayan",
    Ecuador: "Ecuadorian",
    Peru: "Peruvian",
  };
  return map[country] || country;
}

export default async function NationalityPlayersPage({ params }: PageProps) {
  const { country } = await params;
  const nationality = decodeURIComponent(country);
  const playersList = await getPlayersByNationality(nationality, 100);

  if (playersList.length === 0) {
    notFound();
  }

  const adjective = nationalityAdjective(nationality);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Players", url: `${BASE_URL}/players` },
          { name: "By Nationality", url: `${BASE_URL}/players/nationality` },
          { name: nationality, url: `${BASE_URL}/players/nationality/${encodeURIComponent(nationality)}` },
        ]}
      />
      <ItemListJsonLd
        name={`${adjective} Football Players`}
        items={playersList.map((player, i) => ({
          position: i + 1,
          url: `${BASE_URL}/players/${player.slug}`,
          name: player.name,
          image: player.imageUrl,
        }))}
      />

      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title={`${adjective} Football Players`}
          subtitle={`${playersList.length} players from ${nationality} in our database`}
          accentColor="bg-teal-800"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Players", href: "/players" },
            { label: "By Nationality", href: "/players/nationality" },
            { label: nationality },
          ]}
          icon={(() => {
            const flagUrl = getCountryFlagUrl(nationality);
            return flagUrl ? (
              <Image src={flagUrl} alt={`${nationality} flag`} width={48} height={32} className="rounded shadow-sm" />
            ) : (
              <Globe className="w-7 h-7 text-teal-300" />
            );
          })()}
        />

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {playersList.map((player) => (
              <PlayerLink
                key={player.id}
                slug={player.slug}
                isLinkWorthy={player.isIndexable}
                className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-xl transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    {player.imageUrl ? (
                      <ImageWithFallback src={player.imageUrl} alt={player.name} className="w-12 h-12 rounded-full object-cover" width={48} height={48} />
                    ) : (
                      <User className="w-6 h-6 text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                      {player.name}
                    </div>
                    <div className="text-sm text-neutral-500">{player.position}</div>
                    {player.team && (
                      <div className="flex items-center gap-1 text-xs text-neutral-400 mt-0.5">
                        {player.team.logoUrl ? (
                          <ImageWithFallback src={player.team.logoUrl} alt={player.team.name} className="w-3 h-3 object-contain" width={12} height={12} />
                        ) : (
                          <Shield className="w-3 h-3" />
                        )}
                        {player.team.name}
                      </div>
                    )}
                  </div>
                </div>
              </PlayerLink>
            ))}
          </div>

          {/* Cross-links */}
          <div className="mt-8">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Explore More</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/players"
                className="px-4 py-2 bg-white rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                All Players
              </Link>
              <Link
                href="/players/nationality"
                className="px-4 py-2 bg-white rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-teal-300 hover:text-teal-600 transition-colors"
              >
                All Nationalities
              </Link>
              <Link
                href={`/teams/country/${encodeURIComponent(nationality.toLowerCase())}`}
                className="px-4 py-2 bg-white rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-green-300 hover:text-green-600 transition-colors"
              >
                {adjective} Teams
              </Link>
              {["Goalkeeper", "Defender", "Midfielder", "Forward"].map((pos) => (
                <Link
                  key={pos}
                  href={`/players/position/${pos.toLowerCase()}`}
                  className="px-4 py-2 bg-white rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-purple-300 hover:text-purple-600 transition-colors"
                >
                  {pos}s
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
