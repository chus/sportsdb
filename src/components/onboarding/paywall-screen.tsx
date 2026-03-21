"use client";

import { useState } from "react";
import { Check, Sparkles, Zap, Loader2, Clock } from "lucide-react";
import { useSubscription } from "@/components/subscription/subscription-provider";
import {
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from "@/lib/subscriptions/tiers";

interface PaywallScreenProps {
  onContinue: () => void;
}

const TIER_ORDER: SubscriptionTier[] = ["free", "pro"];

const TIER_ICONS: Record<SubscriptionTier, React.ElementType> = {
  free: Sparkles,
  pro: Zap,
};

const TIER_COLORS: Record<
  SubscriptionTier,
  { border: string; bg: string; button: string; badge: string }
> = {
  free: {
    border: "border-neutral-200",
    bg: "bg-white",
    button:
      "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
    badge: "",
  },
  pro: {
    border: "border-blue-600 ring-2 ring-blue-100",
    bg: "bg-white",
    button:
      "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg",
    badge: "bg-blue-600 text-white",
  },
};

const FEATURE_LABELS: { key: string; label: string; comingSoon?: boolean }[] = [
  { key: "follows", label: "Player & team follows" },
  { key: "comparisons", label: "Daily comparisons" },
  { key: "advancedStats", label: "Advanced statistics" },
  { key: "adFree", label: "Ad-free experience" },
  { key: "exportData", label: "Export data" },
  { key: "historicalData", label: "Multi-season historical data" },
];

function getFeatureValue(tier: SubscriptionTier, key: string): string | boolean {
  const features = SUBSCRIPTION_TIERS[tier].features;
  switch (key) {
    case "follows":
      return features.maxFollows === Infinity ? "Unlimited" : `${features.maxFollows}`;
    case "comparisons":
      return features.comparisonsPerDay === Infinity
        ? "Unlimited"
        : `${features.comparisonsPerDay}/day`;
    case "advancedStats":
      return features.advancedStats;
    case "adFree":
      return features.adFree;
    case "exportData":
      return features.exportData;
    case "historicalData":
      return features.historicalData;
    default:
      return false;
  }
}

export function PaywallScreen({ onContinue }: PaywallScreenProps) {
  const { upgrade } = useSubscription();
  const [upgrading, setUpgrading] = useState<SubscriptionTier | null>(null);

  const handleSelect = async (tier: SubscriptionTier) => {
    if (tier === "free") {
      onContinue();
      return;
    }

    setUpgrading(tier);
    try {
      await upgrade("pro");
      onContinue();
    } catch {
      // Error already logged in provider
      setUpgrading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-8 text-white text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Zap className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Choose Your Plan</h2>
          </div>
          <p className="text-blue-100 text-lg max-w-xl mx-auto">
            Unlock the full power of SportsDB with a plan that fits your needs
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="p-8 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {TIER_ORDER.map((tierKey) => {
              const config = SUBSCRIPTION_TIERS[tierKey];
              const colors = TIER_COLORS[tierKey];
              const Icon = TIER_ICONS[tierKey];
              const isRecommended = tierKey === "pro";

              return (
                <div
                  key={tierKey}
                  className={`relative rounded-2xl border-2 ${colors.border} ${colors.bg} p-6 flex flex-col`}
                >
                  {isRecommended && (
                    <div
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold ${colors.badge}`}
                    >
                      RECOMMENDED
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div
                      className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${
                        tierKey === "free"
                          ? "bg-neutral-100"
                          : "bg-blue-100"
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          tierKey === "free"
                            ? "text-neutral-600"
                            : "text-blue-600"
                        }`}
                      />
                    </div>
                    <h3 className="text-xl font-bold text-neutral-900">
                      {config.name}
                    </h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      {config.description}
                    </p>
                    <div className="mt-4">
                      {config.price === 0 ? (
                        <span className="text-4xl font-bold text-neutral-900">
                          Free
                        </span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold text-neutral-900">
                            &euro;{config.annualPrice}
                          </span>
                          <span className="text-neutral-500 text-sm">/year</span>
                        </>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6 flex-1">
                    {FEATURE_LABELS.map(({ key, label, comingSoon }) => {
                      const value = getFeatureValue(tierKey, key);
                      const available = value !== false;
                      return (
                        <li
                          key={key}
                          className={`flex items-start gap-2 text-sm ${
                            available ? "text-neutral-700" : "text-neutral-400"
                          }`}
                        >
                          <Check
                            className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                              available ? "text-green-500" : "text-neutral-300"
                            }`}
                          />
                          <span>
                            {label}
                            {typeof value === "string" && (
                              <span className="font-medium text-neutral-900">
                                {" "}
                                ({value})
                              </span>
                            )}
                            {comingSoon && available && (
                              <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-neutral-500 bg-neutral-100 rounded">
                                <Clock className="w-3 h-3" />
                                Soon
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <button
                    onClick={() => handleSelect(tierKey)}
                    disabled={upgrading !== null}
                    className={`w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-50 ${colors.button}`}
                  >
                    {upgrading === tierKey ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : tierKey === "free" ? (
                      "Continue for Free"
                    ) : (
                      `Get ${config.name}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-neutral-50 border-t text-center">
          <button
            onClick={onContinue}
            disabled={upgrading !== null}
            className="text-neutral-500 hover:text-neutral-700 text-sm transition-colors"
          >
            Skip for now — you can always upgrade later
          </button>
        </div>
      </div>
    </div>
  );
}
