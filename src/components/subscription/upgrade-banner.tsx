"use client";

import Link from "next/link";
import { Zap, BarChart3, Shield, Star, Ban } from "lucide-react";
import { useSubscription } from "./subscription-provider";
import { cn } from "@/lib/utils/cn";

const contextCopy: Record<
  string,
  { headline: string; bullets: string[] }
> = {
  player: {
    headline: "Unlock Full Player Data",
    bullets: [
      "Complete season-by-season stats",
      "Advanced analytics & radar charts",
      "Ad-free experience",
    ],
  },
  team: {
    headline: "Unlock Full Team Insights",
    bullets: [
      "Historical squad data",
      "Advanced team analytics",
      "Ad-free experience",
    ],
  },
  article: {
    headline: "Read Without Ads",
    bullets: [
      "Ad-free reading experience",
      "Advanced player stats",
      "Unlimited follows & comparisons",
    ],
  },
  compare: {
    headline: "Unlimited Comparisons",
    bullets: [
      "Compare any players, anytime",
      "Advanced stat breakdowns",
      "Export comparison data",
    ],
  },
  default: {
    headline: "Unlock Pro Features",
    bullets: [
      "Advanced stats & visualizations",
      "Unlimited follows & comparisons",
      "Ad-free experience",
    ],
  },
};

interface UpgradeBannerProps {
  variant?: "sidebar" | "inline";
  context?: string;
  className?: string;
}

export function UpgradeBanner({
  variant = "sidebar",
  context = "default",
  className,
}: UpgradeBannerProps) {
  const { tier, isLoading } = useSubscription();

  if (isLoading || tier !== "free") return null;

  const copy = contextCopy[context] || contextCopy.default;

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-neutral-900 text-sm">
              {copy.headline}
            </p>
            <p className="text-xs text-neutral-500">
              Pro from €8/year
            </p>
          </div>
        </div>
        <Link
          href="/pricing"
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all whitespace-nowrap"
        >
          Upgrade to Pro
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-blue-200 overflow-hidden",
        className
      )}
    >
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-white" />
          <h3 className="font-semibold text-white text-sm">{copy.headline}</h3>
        </div>
      </div>
      <div className="p-5">
        <ul className="space-y-2.5 mb-4">
          {copy.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
              <Star className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              {bullet}
            </li>
          ))}
        </ul>
        <Link
          href="/pricing"
          className="block w-full text-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all"
        >
          Upgrade to Pro — from €8/yr
        </Link>
      </div>
    </div>
  );
}
