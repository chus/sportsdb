import Link from "next/link";
import { CalendarDays, Flame, Shield, Trophy } from "lucide-react";
import type { WeekPreviewDay } from "@/lib/queries/homepage";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { WeekCountdownChip } from "./week-countdown-chip";

function formatDayHeader(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function eventIcon(type: string) {
  if (type === "final" || type === "tournament_start") return Trophy;
  if (type === "derby") return Flame;
  return CalendarDays;
}

export function WeekPreview({ data }: { data: WeekPreviewDay[] }) {
  if (!data.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">This Week in Football</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Fixtures, derbies and finals for the next 7 days
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {data.slice(0, 7).map((day) => {
          const featured = day.events.filter((e) => e.isFeatured || e.importance >= 4);
          return (
            <div
              key={day.date}
              className="bg-white rounded-xl border border-neutral-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-sm text-neutral-900">
                    {formatDayHeader(day.date)}
                  </h3>
                  <span className="text-xs text-neutral-500">
                    {day.matches.length} match{day.matches.length !== 1 ? "es" : ""}
                  </span>
                </div>
                {day.matches[0] && (
                  <WeekCountdownChip targetIso={day.matches[0].scheduledAt} />
                )}
              </div>

              {featured.length > 0 && (
                <div className="px-5 py-3 border-b border-neutral-100 space-y-2">
                  {featured.map((e) => {
                    const Icon = eventIcon(e.type);
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Icon
                          className={`w-4 h-4 ${
                            e.type === "final"
                              ? "text-amber-500"
                              : e.type === "derby"
                                ? "text-orange-500"
                                : "text-blue-500"
                          }`}
                        />
                        <span className="font-semibold text-neutral-900">{e.title}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="divide-y divide-neutral-50">
                {day.matches.slice(0, 4).map((m) => (
                  <Link
                    key={m.id}
                    href={`/matches/${m.slug ?? m.id}`}
                    className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {m.homeTeam.logoUrl ? (
                        <ImageWithFallback
                          src={m.homeTeam.logoUrl}
                          alt={m.homeTeam.name}
                          width={20}
                          height={20}
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Shield className="w-4 h-4 text-neutral-300" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-neutral-900 truncate text-right">
                      {m.homeTeam.name}
                    </span>
                    <span className="text-xs text-neutral-400 mx-2">vs</span>
                    <span className="text-sm font-medium text-neutral-900 truncate">
                      {m.awayTeam.name}
                    </span>
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {m.awayTeam.logoUrl ? (
                        <ImageWithFallback
                          src={m.awayTeam.logoUrl}
                          alt={m.awayTeam.name}
                          width={20}
                          height={20}
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Shield className="w-4 h-4 text-neutral-300" />
                      )}
                    </div>
                  </Link>
                ))}
                {day.matches.length > 4 && (
                  <Link
                    href="/matches"
                    className="block px-5 py-3 text-xs font-medium text-blue-600 hover:bg-neutral-50 text-center transition-colors"
                  >
                    + {day.matches.length - 4} more fixtures
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
