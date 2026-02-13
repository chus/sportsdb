import { Trophy } from "lucide-react";
import Link from "next/link";

const footerLinks = {
  Explore: [
    { label: "Players", href: "/search?type=player" },
    { label: "Teams", href: "/search?type=team" },
    { label: "Competitions", href: "/search?type=competition" },
    { label: "Matches", href: "/search?type=match" },
  ],
  Competitions: [
    { label: "Premier League", href: "/competitions/premier-league" },
    { label: "La Liga", href: "/competitions/la-liga" },
    { label: "Champions League", href: "/competitions/champions-league" },
    { label: "Bundesliga", href: "/competitions/bundesliga" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-neutral-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-lg">SportsDB</div>
                <div className="text-xs text-neutral-400">
                  International Sports Database
                </div>
              </div>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">
              The comprehensive, structured database for football entities.
              Search players, teams, competitions, and matches with time-aware
              data.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-semibold text-sm text-white mb-4">
                {title}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-neutral-500">
            &copy; {new Date().getFullYear()} SportsDB. All rights reserved.
          </p>
          <p className="text-xs text-neutral-500">
            Database updated every 5 minutes
          </p>
        </div>
      </div>
    </footer>
  );
}
