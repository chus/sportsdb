import { Link } from "@/i18n/navigation";
import { Shield, Users } from "lucide-react";
import type { FeaturedLeague } from "@/lib/queries/homepage";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

export function FeaturedLeagues({ leagues }: { leagues: FeaturedLeague[] }) {
  if (!leagues.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-ink">
          Featured Leagues
        </h2>
        <p className="text-sm text-muted mt-1">
          Top competitions with squad data
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leagues.map((league) => (
          <Link
            key={league.id}
            href={`/competitions/${league.slug}`}
            className="group block bg-surface rounded-xl border border-line p-5 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-surface-2 border border-line flex items-center justify-center flex-shrink-0">
                {league.logoUrl ? (
                  <ImageWithFallback
                    src={league.logoUrl}
                    alt={league.name}
                    width={32}
                    height={32}
                    className="w-8 h-8 object-contain"
                  />
                ) : (
                  <Shield className="w-5 h-5 text-faint" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink truncate group-hover:text-blue-600 transition-colors">
                  {league.name}
                </div>
                {league.country && (
                  <div className="text-xs text-muted">{league.country}</div>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-muted bg-surface-2 px-2 py-1 rounded-full flex-shrink-0">
                <Users className="w-3 h-3" />
                {league.teamCount}
              </span>
            </div>

            {league.sampleTeams.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {league.sampleTeams.map((t) => (
                  <span
                    key={t.slug}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-line rounded text-xs text-muted"
                  >
                    {t.logoUrl ? (
                      <ImageWithFallback
                        src={t.logoUrl}
                        alt={t.name}
                        width={12}
                        height={12}
                        className="w-3 h-3 object-contain"
                      />
                    ) : (
                      <Shield className="w-2.5 h-2.5 text-faint" />
                    )}
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
