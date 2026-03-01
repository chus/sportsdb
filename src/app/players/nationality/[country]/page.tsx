import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, User, Shield } from "lucide-react";
import type { Metadata } from "next";
import {
  getDistinctNationalities,
  getPlayersByNationality,
} from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

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

  const title = `${adjective} Football Players – Full List | SportsDB`;
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
          { name: "Players", url: `${BASE_URL}/search?type=player` },
          { name: "By Nationality", url: `${BASE_URL}/players/nationality` },
          { name: nationality, url: `${BASE_URL}/players/nationality/${encodeURIComponent(nationality)}` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-green-500 via-teal-500 to-cyan-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/players/nationality" className="text-white/70 hover:text-white transition-colors text-sm">
                All Nationalities
              </Link>
              <span className="text-white/40">/</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">{adjective} Football Players</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              {playersList.length} players from {nationality} in our database.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {playersList.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.slug}`}
                className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-xl transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    {player.imageUrl ? (
                      <img src={player.imageUrl} alt={player.name} className="w-12 h-12 rounded-full object-cover" />
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
                          <img src={player.team.logoUrl} alt="" className="w-3 h-3 object-contain" />
                        ) : (
                          <Shield className="w-3 h-3" />
                        )}
                        {player.team.name}
                      </div>
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
