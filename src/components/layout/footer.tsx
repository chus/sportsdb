"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCookieConsent } from "@/components/cookie-consent/cookie-consent-provider";

export function Footer() {
  const t = useTranslations();
  const { openSettings } = useCookieConsent();

  const footerLinks = {
    [t("footer.explore")]: [
      { label: t("common.players"), href: "/players" },
      { label: t("common.teams"), href: "/teams" },
      { label: t("common.competitions"), href: "/competitions" },
      { label: t("common.matches"), href: "/matches" },
      { label: t("common.news"), href: "/news" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Pricing", href: "/pricing" },
    ],
    [t("common.competitions")]: [
      { label: "Premier League", href: "/competitions/premier-league" },
      { label: "La Liga", href: "/competitions/la-liga" },
      { label: "Champions League", href: "/competitions/uefa-champions-league" },
      { label: "Bundesliga", href: "/competitions/bundesliga" },
      { label: "Serie A", href: "/competitions/serie-a" },
      { label: "Ligue 1", href: "/competitions/ligue-1" },
      { label: "Liga Argentina", href: "/competitions/liga-profesional-argentina" },
      { label: "MLS", href: "/competitions/mls" },
    ],
    Discover: [
      { label: "Top Scorers", href: "/top-scorers" },
      { label: "Top Assists", href: "/top-assists" },
      { label: "Venues", href: "/venues" },
      { label: "Compare Players", href: "/compare" },
      { label: "Methodology", href: "/methodology" },
    ],
    [t("footer.legal")]: [
      { label: t("footer.about"), href: "/about" },
      { label: t("footer.contact"), href: "/contact" },
      { label: t("footer.privacy"), href: "/privacy" },
      { label: t("footer.terms"), href: "/terms" },
      { label: "Cookie Settings", href: "#", onClick: openSettings },
    ],
  };

  return (
    <footer className="bg-neutral-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-lg">SportsDB</div>
                <div className="text-xs text-neutral-400">
                  {t("home.heroTagline")}
                </div>
              </div>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">
              {t("footer.tagline")}
            </p>
            <p className="text-xs text-blue-400 mt-2">Pro from €8/year</p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-semibold text-sm text-white mb-4">
                {title}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {"onClick" in link && link.onClick ? (
                      <button
                        onClick={link.onClick}
                        className="text-sm text-neutral-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-neutral-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-neutral-500">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
