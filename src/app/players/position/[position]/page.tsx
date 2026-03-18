import Link from "next/link";
import { notFound } from "next/navigation";
import { User, Shield } from "lucide-react";
import type { Metadata } from "next";
import { getPlayersByPosition } from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 86400;

const VALID_POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"] as const;
type ValidPosition = (typeof VALID_POSITIONS)[number];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface PageProps {
  params: Promise<{ position: string }>;
}

export async function generateStaticParams() {
  return VALID_POSITIONS.map((p) => ({ position: p }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { position } = await params;
  if (!VALID_POSITIONS.includes(position as ValidPosition)) return { title: "Not Found" };

  const posName = capitalize(position);
  const title = `Football ${posName}s – Full Player List | SportsDB`;
  const description = `Browse all ${position}s in our football database. View profiles, current teams, and nationalities for ${position}s across top leagues.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/players/position/${position}`,
    },
    alternates: { canonical: `${BASE_URL}/players/position/${position}` },
  };
}

export default async function PositionPlayersPage({ params }: PageProps) {
  const { position } = await params;

  if (!VALID_POSITIONS.includes(position as ValidPosition)) {
    notFound();
  }

  const posName = capitalize(position);
  const playersList = await getPlayersByPosition(posName, 100);

  if (playersList.length === 0) {
    notFound();
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Players", url: `${BASE_URL}/search?type=player` },
          { name: "By Position", url: `${BASE_URL}/players/position` },
          { name: `${posName}s`, url: `${BASE_URL}/players/position/${position}` },
        ]}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/players/position" className="text-white/70 hover:text-white transition-colors text-sm">
                All Positions
              </Link>
              <span className="text-white/40">/</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <User className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">Football {posName}s</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              {playersList.length} {position}s in our database, sorted by popularity.
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
                      <ImageWithFallback src={player.imageUrl} alt={player.name} className="w-12 h-12 rounded-full object-cover" width={48} height={48} />
                    ) : (
                      <User className="w-6 h-6 text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900 group-hover:text-blue-600 transition-colors truncate">
                      {player.name}
                    </div>
                    <div className="text-sm text-neutral-500">{player.nationality}</div>
                    {player.team && (
                      <div className="flex items-center gap-1 text-xs text-neutral-400 mt-0.5">
                        {player.team.logoUrl ? (
                          <ImageWithFallback src={player.team.logoUrl} alt="" className="w-3 h-3 object-contain" width={12} height={12} />
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

          {/* Cross-link to nationalities */}
          <div className="mt-8">
            <Link
              href="/players/nationality"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:border-teal-300 hover:text-teal-600 transition-colors"
            >
              Browse by Nationality →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
