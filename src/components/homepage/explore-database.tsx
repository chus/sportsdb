import Link from "next/link";
import { ChevronRight, Globe, Shield, Trophy, Users } from "lucide-react";
import type { HomepageStats } from "@/lib/queries/homepage";

const sections = [
  {
    icon: Users,
    label: "Players",
    statKey: "players" as const,
    suffix: "players",
    href: "/players",
    color: "text-blue-600 bg-blue-50",
    links: [
      { label: "Forwards", href: "/players?position=Forward" },
      { label: "Midfielders", href: "/players?position=Midfielder" },
      { label: "Defenders", href: "/players?position=Defender" },
      { label: "Goalkeepers", href: "/players?position=Goalkeeper" },
    ],
  },
  {
    icon: Shield,
    label: "Teams",
    statKey: "teams" as const,
    suffix: "teams",
    href: "/teams/country",
    color: "text-indigo-600 bg-indigo-50",
    links: [
      { label: "By country", href: "/teams/country" },
      { label: "Compare teams", href: "/compare" },
    ],
  },
  {
    icon: Trophy,
    label: "Competitions",
    statKey: "competitions" as const,
    suffix: "leagues worldwide",
    href: "/competitions",
    color: "text-purple-600 bg-purple-50",
    links: [
      { label: "All competitions", href: "/competitions" },
    ],
  },
  {
    icon: Globe,
    label: "Countries",
    statKey: null,
    suffix: null,
    href: "/teams/country",
    color: "text-emerald-600 bg-emerald-50",
    links: [
      { label: "Browse by country", href: "/teams/country" },
      { label: "By nationality", href: "/players/nationality" },
    ],
  },
];

export function ExploreDatabase({ stats }: { stats: HomepageStats }) {
  return (
    <section className="bg-neutral-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-14">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Explore the Database</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Browse our comprehensive football data
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sections.map((s) => (
            <div
              key={s.label}
              className="bg-white/5 border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}
                >
                  <s.icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{s.label}</div>
                  {s.statKey && (
                    <div className="text-xs text-neutral-400">
                      {stats[s.statKey].toLocaleString()} {s.suffix}
                    </div>
                  )}
                  {!s.statKey && (
                    <div className="text-xs text-neutral-400">
                      Browse by location
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                {s.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors py-0.5"
                  >
                    <ChevronRight className="w-3 h-3" />
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
