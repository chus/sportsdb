import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderStat {
  label: string;
  value: string | number;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  badges?: ReactNode;
  stats?: HeaderStat[];
  accentColor?: string;
  actions?: ReactNode;
  compact?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  breadcrumbs,
  badges,
  stats,
  accentColor = "bg-neutral-800",
  actions,
  compact = false,
}: PageHeaderProps) {
  return (
    <div className={cn("text-white", accentColor)}>
      <div className={cn("max-w-7xl mx-auto px-4", compact ? "py-6" : "py-8 md:py-10")}>
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex items-center gap-1 text-sm text-white/60">
              {breadcrumbs.map((crumb, i) => (
                <li key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-white/30" />}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-white transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-white/80">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Main content row */}
        <div className="flex items-center gap-4">
          {/* Icon */}
          {icon && (
            <div className="flex-shrink-0">{icon}</div>
          )}

          {/* Title block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className={cn(
                "font-bold tracking-tight",
                compact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"
              )}>
                {title}
              </h1>
              {badges}
            </div>
            {subtitle && (
              <p className="text-white/70 text-sm mt-1">{subtitle}</p>
            )}
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex-shrink-0 flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        {/* Inline stats */}
        {stats && stats.length > 0 && (
          <div className="flex items-center gap-6 mt-4">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-white/60 uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
