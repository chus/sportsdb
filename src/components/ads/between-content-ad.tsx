"use client";

import Link from "next/link";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { AdUnit } from "./ad-unit";

export function BetweenContentAd() {
  const { canAccess, isLoading } = useSubscription();

  if (isLoading || canAccess("adFree")) return null;

  const slot = process.env.NEXT_PUBLIC_ADSENSE_LEADERBOARD_SLOT;
  if (!slot) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-neutral-400">Advertisement</span>
          <Link
            href="/pricing"
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            Remove ads
          </Link>
        </div>
        <div className="flex justify-center" style={{ minHeight: 90 }}>
          <AdUnit slot={slot} format="horizontal" style={{ width: "100%", height: 90 }} />
        </div>
      </div>
    </div>
  );
}
