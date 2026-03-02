import { TrendingUp, Trophy, RefreshCw, ChevronRight } from "lucide-react";
import Link from "next/link";

const explorationCards = [
  {
    title: "Rising Stars",
    description: "Discover the next generation of football talent breaking into the scene",
    icon: TrendingUp,
    gradient: "from-green-500 to-emerald-600",
    href: "/trending",
    linkText: "Explore players",
  },
  {
    title: "Historic Rivalries",
    description: "Explore the greatest matchups and intense competitions throughout history",
    icon: Trophy,
    gradient: "from-red-500 to-orange-600",
    href: "/search?type=competition",
    linkText: "View rivalries",
  },
  {
    title: "Recently Updated",
    description: "Check out the latest profile updates and newly added information",
    icon: RefreshCw,
    gradient: "from-purple-500 to-indigo-600",
    href: "/transfers",
    linkText: "See updates",
  },
];

export function LandingFeatures() {
  return (
    <section className="py-16 bg-gradient-to-b from-neutral-50 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {explorationCards.map((card) => (
            <div
              key={card.title}
              className="bg-white rounded-2xl p-6 border border-neutral-200 hover:shadow-lg transition-shadow"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center mb-4`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">{card.title}</h3>
              <p className="text-neutral-600 mb-4 text-sm">{card.description}</p>
              <Link
                href={card.href}
                className="text-blue-600 font-medium text-sm hover:text-blue-700 flex items-center gap-1"
              >
                {card.linkText}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
