"use client";

import { Zap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useSubscription } from "./subscription-provider";

/**
 * Reverse-trial countdown. New users get 7 days of Pro free; this nudges
 * them to keep it before the trial lapses (loss-aversion conversion). Only
 * shows while status === "trialing".
 */
export function TrialBanner() {
  const { subscription, isLoading } = useSubscription();
  if (isLoading || !subscription || subscription.status !== "trialing" || !subscription.endDate) {
    return null;
  }

  const msLeft = new Date(subscription.endDate).getTime() - Date.now();
  if (msLeft <= 0) return null;
  const daysLeft = Math.max(1, Math.ceil(msLeft / 86400000));

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3 text-sm">
        <Zap className="w-4 h-4 shrink-0" />
        <span>
          You have <span className="font-semibold">{daysLeft} day{daysLeft === 1 ? "" : "s"}</span> left of Pro free.
        </span>
        <Link
          href="/pricing"
          className="font-semibold underline underline-offset-2 hover:no-underline shrink-0"
        >
          Keep Pro — €3/mo
        </Link>
      </div>
    </div>
  );
}
