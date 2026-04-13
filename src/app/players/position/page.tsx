import Link from "next/link";
import { User, ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import { getPositionCounts } from "@/lib/queries/leaderboards";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/json-ld";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Football Players by Position | DataSports",
  description:
    "Browse football players by position: goalkeepers, defenders, midfielders, and forwards. Find players by their role on the pitch.",
  openGraph: {
    title: "Football Players by Position | DataSports",
    description: "Browse football players by position.",
    url: `${BASE_URL}/players/position`,
  },
  alternates: {
    canonical: `${BASE_URL}/players/position`,
  },
};

const POSITION_META: Record<string, { color: string; description: string }> = {
  Goalkeeper: { color: "text-yellow-600", description: "Last line of defence" },
  Defender: { color: "text-blue-600", description: "Marshalling the backline" },
  Midfielder: { color: "text-green-600", description: "Controlling the tempo" },
  Forward: { color: "text-red-600", description: "Leading the attack" },
};

export default async function PositionIndexPage() {
  const positions = await getPositionCounts();

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Players", url: `${BASE_URL}/players` },
          { name: "By Position", url: `${BASE_URL}/players/position` },
        ]}
      />
      <CollectionPageJsonLd
        name="Football Players by Position"
        description="Browse football players by position: goalkeepers, defenders, midfielders, and forwards"
        url={`${BASE_URL}/players/position`}
      />

      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-8 h-8" />
              <h1 className="text-3xl md:text-5xl font-bold">Players by Position</h1>
            </div>
            <p className="text-lg text-white/80 max-w-2xl">
              Browse football players by their position on the pitch.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid sm:grid-cols-2 gap-4">
            {positions.map((item) => {
              const meta = POSITION_META[item.position];
              return (
                <Link
                  key={item.position}
                  href={`/players/position/${item.position.toLowerCase()}`}
                  className="bg-white rounded-xl border border-neutral-200 p-6 hover:shadow-xl transition-shadow flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{item.position.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-lg font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">
                        {item.position}s
                      </span>
                      <div className="flex items-center gap-1 text-sm text-neutral-500">
                        <Users className="w-3 h-3" />
                        {item.count.toLocaleString()} players
                      </div>
                      {meta && (
                        <div className="text-xs text-neutral-400 mt-0.5">{meta.description}</div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
