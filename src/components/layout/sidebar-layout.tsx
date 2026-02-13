import { ReactNode } from "react";

interface SidebarLayoutProps {
  main: ReactNode;
  sidebar: ReactNode;
  className?: string;
}

/**
 * Standard 2/3 + 1/3 layout used on Player, Team, and Competition pages.
 * On mobile, sidebar stacks below main content.
 */
export function SidebarLayout({ main, sidebar, className = "" }: SidebarLayoutProps) {
  return (
    <div className={`max-w-7xl mx-auto px-4 py-12 ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">{main}</div>
        <div className="space-y-6">{sidebar}</div>
      </div>
    </div>
  );
}
