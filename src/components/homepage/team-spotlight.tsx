import Link from "next/link";
import { ChevronRight, Shield, Users } from "lucide-react";
import type { TeamSpotlight } from "@/lib/queries/homepage";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

const positionColors: Record<string, string> = {
  Forward: "bg-red-100 text-red-700",
  Midfielder: "bg-amber-100 text-amber-700",
  Defender: "bg-blue-100 text-blue-700",
  Goalkeeper: "bg-green-100 text-green-700",
};

export function TeamSpotlightSection({ data }: { data: TeamSpotlight }) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900">
          Team of the Day
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Discover a new squad every day
        </p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center flex-shrink-0">
            {data.team.logoUrl ? (
              <ImageWithFallback
                src={data.team.logoUrl}
                alt={data.team.name}
                width={48}
                height={48}
                className="w-12 h-12 object-contain"
              />
            ) : (
              <Shield className="w-8 h-8 text-neutral-400" />
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/teams/${data.team.slug}`}
              className="text-xl font-bold text-neutral-900 hover:text-blue-600 transition-colors truncate block"
            >
              {data.team.name}
            </Link>
            <div className="text-sm text-neutral-500">
              {data.team.country}
              {data.competition && (
                <>
                  {" · "}
                  <Link
                    href={`/competitions/${data.competition.slug}`}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {data.competition.name}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-1.5 text-sm text-neutral-600">
            <Users className="w-4 h-4 text-neutral-400" />
            <span className="font-semibold">{data.squadSize}</span> players
          </div>
        </div>

        {data.positions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {data.positions.map((p) => (
              <span
                key={p.position}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${positionColors[p.position] ?? "bg-neutral-100 text-neutral-600"}`}
              >
                {p.position}
                <span className="font-bold">{p.count}</span>
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/teams/${data.team.slug}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Explore squad <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
