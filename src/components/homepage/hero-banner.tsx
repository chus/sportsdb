import Link from "next/link";
import { Calendar, CheckCircle, Circle, Clock, Shield } from "lucide-react";
import type { HeroBanner, HeroMatch } from "@/lib/queries/homepage";
import { LiveMatchesSection } from "@/components/live/live-matches-section";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";

function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function formatDayLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return "Today";
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function MatchResultCard({ m }: { m: HeroMatch }) {
  return (
    <Link
      key={m.id}
      href={`/matches/${m.slug ?? m.id}`}
      className="group block bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl p-4 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/70 truncate">
          {m.competition?.name ?? "Competition"}
        </span>
        <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
          FT
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-white/20 flex-shrink-0 flex items-center justify-center">
            {m.homeTeam.logoUrl ? (
              <ImageWithFallback
                src={m.homeTeam.logoUrl}
                alt={m.homeTeam.name}
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            ) : (
              <Shield className="w-3 h-3" />
            )}
          </div>
          <span className="font-semibold text-sm truncate flex-1 group-hover:underline">
            {m.homeTeam.name}
          </span>
          <span className="font-bold text-lg tabular-nums">{m.homeScore ?? "-"}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-white/20 flex-shrink-0 flex items-center justify-center">
            {m.awayTeam.logoUrl ? (
              <ImageWithFallback
                src={m.awayTeam.logoUrl}
                alt={m.awayTeam.name}
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            ) : (
              <Shield className="w-3 h-3" />
            )}
          </div>
          <span className="font-semibold text-sm truncate flex-1 group-hover:underline">
            {m.awayTeam.name}
          </span>
          <span className="font-bold text-lg tabular-nums">{m.awayScore ?? "-"}</span>
        </div>
      </div>
    </Link>
  );
}

export function HeroBannerSection({ data }: { data: HeroBanner }) {
  if (data.kind === "live") {
    return <LiveMatchesSection />;
  }

  if (data.kind === "today") {
    if (!data.matches.length) return null;
    return (
      <section className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Today&apos;s Fixtures
            </span>
            <span className="text-xs text-white/70">
              {data.matches.length} match{data.matches.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.matches.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.slug ?? m.id}`}
                className="group block bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-white/70 truncate">
                    {m.competition?.name ?? "Competition"}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3" />
                    {formatClock(m.scheduledAt)}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded bg-white/20 flex-shrink-0 flex items-center justify-center">
                      {m.homeTeam.logoUrl ? (
                        <ImageWithFallback
                          src={m.homeTeam.logoUrl}
                          alt={m.homeTeam.name}
                          width={20}
                          height={20}
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Shield className="w-3 h-3" />
                      )}
                    </div>
                    <span className="font-semibold text-sm truncate group-hover:underline">
                      {m.homeTeam.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded bg-white/20 flex-shrink-0 flex items-center justify-center">
                      {m.awayTeam.logoUrl ? (
                        <ImageWithFallback
                          src={m.awayTeam.logoUrl}
                          alt={m.awayTeam.name}
                          width={20}
                          height={20}
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Shield className="w-3 h-3" />
                      )}
                    </div>
                    <span className="font-semibold text-sm truncate group-hover:underline">
                      {m.awayTeam.name}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (data.kind === "results") {
    if (!data.matches.length) return null;
    return (
      <section className="bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              {data.label}
            </span>
            <span className="text-xs text-white/70">
              {data.matches.length} match{data.matches.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.matches.map((m) => (
              <MatchResultCard key={m.id} m={m} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Upcoming
  if (!data.matches.length) return null;
  return (
    <section className="bg-neutral-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-6">
          <Circle className="w-2 h-2 fill-white" />
          <span className="text-sm font-semibold uppercase tracking-wide text-white/80">
            Next Up
          </span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.matches.map((m) => (
            <Link
              key={m.id}
              href={`/matches/${m.slug ?? m.id}`}
              className="group block bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/60 truncate">
                  {m.competition?.name ?? "Competition"}
                </span>
                <span className="text-xs text-white/70">{formatDayLabel(m.scheduledAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-sm truncate">{m.homeTeam.name}</span>
                <span className="text-xs text-white/50">vs</span>
                <span className="font-semibold text-sm truncate text-right">{m.awayTeam.name}</span>
              </div>
              <div className="mt-2 text-xs text-white/50">{formatClock(m.scheduledAt)}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
