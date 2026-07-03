"use client";

import { useState } from "react";
import { Check, Zap, Loader2, CalendarDays, Sparkles } from "lucide-react";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { SUBSCRIPTION_TIERS } from "@/lib/subscriptions/tiers";

interface PaywallScreenProps {
  onContinue: () => void;
}

/**
 * Post-onboarding screen. Every new user is auto-provisioned a 7-day Pro
 * reverse trial (getUserSubscription), so this screen's job is to TELL them
 * that — not to demand a plan choice before they've felt any value. Loss-
 * aversion trials convert on the way out of value, not the way in. A single
 * low-pressure "lock it in" option charges exactly what it displays: the
 * interval is passed explicitly to upgrade() (the old version showed the
 * annual price but charged monthly).
 */
const PRO_HIGHLIGHTS = [
  "Unlimited player & team comparisons",
  "Prediction leagues, pick'em and the Daily Challenge",
  "Full multi-season historical data",
  "Ad-free experience",
];

export function PaywallScreen({ onContinue }: PaywallScreenProps) {
  const { upgrade, subscription } = useSubscription();
  const [upgrading, setUpgrading] = useState<"monthly" | "annual" | null>(null);
  const pro = SUBSCRIPTION_TIERS.pro;

  const trialEnd =
    subscription?.status === "trialing" && subscription.endDate
      ? new Date(subscription.endDate).toLocaleDateString(undefined, { month: "long", day: "numeric" })
      : null;

  const handleUpgrade = async (period: "monthly" | "annual") => {
    setUpgrading(period);
    try {
      await upgrade("pro", period);
      onContinue();
    } catch {
      // Error already logged in provider
      setUpgrading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-8 text-white text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Zap className="w-8 h-8" />
            <h2 className="text-3xl font-bold">You&apos;ve got Pro — free</h2>
          </div>
          <p className="text-blue-100 text-lg">
            Your 7-day Pro trial is active. No card, no strings.
          </p>
        </div>

        <div className="p-8">
          {/* What's unlocked */}
          <ul className="space-y-3 mb-6">
            {PRO_HIGHLIGHTS.map((label) => (
              <li key={label} className="flex items-start gap-2 text-sm text-ink">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
                {label}
              </li>
            ))}
          </ul>

          {/* Timeline */}
          <div className="rounded-xl border border-line bg-surface-2 p-4 mb-6 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
              <span className="text-ink"><b>Today</b> — everything above is unlocked. Explore freely.</span>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays className="w-4 h-4 mt-0.5 text-muted shrink-0" />
              <span className="text-muted">
                <b>{trialEnd ? trialEnd : "In 7 days"}</b> — your plan quietly reverts to Free. No charge, ever, unless you choose to keep Pro.
              </span>
            </div>
          </div>

          {/* Primary: continue with trial */}
          <button
            onClick={onContinue}
            disabled={upgrading !== null}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg transition-all disabled:opacity-50"
          >
            Start exploring with Pro
          </button>

          {/* Secondary: lock it in now (honest prices, explicit interval) */}
          <div className="mt-4 text-center text-sm text-muted">
            Already convinced? Lock it in:
            <div className="flex justify-center gap-3 mt-2">
              <button
                onClick={() => handleUpgrade("monthly")}
                disabled={upgrading !== null}
                className="px-4 py-2 rounded-lg border border-line text-ink font-medium hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                {upgrading === "monthly" ? <Loader2 className="w-4 h-4 animate-spin" /> : `€${pro.price}/month`}
              </button>
              <button
                onClick={() => handleUpgrade("annual")}
                disabled={upgrading !== null}
                className="px-4 py-2 rounded-lg border border-line text-ink font-medium hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                {upgrading === "annual" ? <Loader2 className="w-4 h-4 animate-spin" /> : `€${pro.annualPrice}/year`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
