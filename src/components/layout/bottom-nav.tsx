"use client";

import { Home, CalendarDays, Users, Shield, Search } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * App-style bottom tab bar for mobile (hidden on lg+). Primary entities
 * within thumb reach; the full menu stays in the navbar's slide-out. Uses
 * theme tokens so it tracks light/dark. The layout adds bottom padding so
 * page content clears the fixed bar.
 */
const ITEMS = [
  { href: "/", label: "Home", icon: Home, isActive: (p: string) => p === "/" },
  { href: "/matches", label: "Matches", icon: CalendarDays, isActive: (p: string) => p.startsWith("/matches") },
  { href: "/players", label: "Players", icon: Users, isActive: (p: string) => p.startsWith("/players") },
  { href: "/teams", label: "Teams", icon: Shield, isActive: (p: string) => p.startsWith("/teams") },
  { href: "/search", label: "Search", icon: Search, isActive: (p: string) => p.startsWith("/search") },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-brand" : "text-muted hover:text-ink"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
