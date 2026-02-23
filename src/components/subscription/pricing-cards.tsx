"use client";

import { Check, X, Crown, Zap, Sparkles } from "lucide-react";
import { useSubscription } from "./subscription-provider";
import { SUBSCRIPTION_TIERS, SubscriptionTier } from "@/lib/subscriptions/tiers";
import { cn } from "@/lib/utils/cn";

interface PricingCardsProps {
  onUpgrade?: () => void;
}

export function PricingCards({ onUpgrade }: PricingCardsProps) {
  const { tier: currentTier, upgrade, downgrade, isLoading } = useSubscription();

  const tiers: {
    id: SubscriptionTier;
    icon: typeof Sparkles;
    gradient: string;
    popular?: boolean;
    features: { text: string; included: boolean }[];
  }[] = [
    {
      id: "free",
      icon: Sparkles,
      gradient: "from-neutral-500 to-neutral-600",
      features: [
        { text: "Follow up to 10 entities", included: true },
        { text: "Basic stats & timelines", included: true },
        { text: "3 player comparisons/day", included: true },
        { text: "Advanced stats", included: false },
        { text: "Export data", included: false },
        { text: "Ad-free experience", included: false },
      ],
    },
    {
      id: "pro",
      icon: Zap,
      gradient: "from-blue-600 to-indigo-600",
      popular: true,
      features: [
        { text: "Unlimited follows", included: true },
        { text: "Advanced stats & visualizations", included: true },
        { text: "Unlimited player comparisons", included: true },
        { text: "Export data (CSV, PDF)", included: true },
        { text: "Ad-free experience", included: true },
        { text: "Historical data (20+ years)", included: true },
        { text: "Early access to features", included: true },
        { text: "Fantasy team optimizer", included: false },
        { text: "AI predictive analytics", included: false },
      ],
    },
    {
      id: "ultimate",
      icon: Crown,
      gradient: "from-purple-600 to-pink-600",
      features: [
        { text: "Everything in Pro", included: true },
        { text: "Fantasy team optimizer", included: true },
        { text: "AI predictive analytics", included: true },
        { text: "API access (1000 calls/day)", included: true },
        { text: "White-label embeds", included: true },
        { text: "Downloadable reports", included: true },
        { text: "Custom alerts", included: true },
        { text: "Priority support", included: true },
      ],
    },
  ];

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === "free") {
      await downgrade();
    } else {
      await upgrade(tier as "pro" | "ultimate");
    }
    onUpgrade?.();
  };

  return (
    <div className="grid md:grid-cols-3 gap-8">
      {tiers.map((tierItem) => {
        const config = SUBSCRIPTION_TIERS[tierItem.id];
        const Icon = tierItem.icon;
        const isCurrentTier = currentTier === tierItem.id;
        const canUpgrade =
          (currentTier === "free" && tierItem.id !== "free") ||
          (currentTier === "pro" && tierItem.id === "ultimate");
        const canDowngrade =
          tierItem.id === "free" && currentTier !== "free";

        return (
          <div
            key={tierItem.id}
            className={cn(
              "relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all hover:shadow-2xl",
              tierItem.popular && "ring-4 ring-blue-600 scale-105"
            )}
          >
            {tierItem.popular && (
              <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                MOST POPULAR
              </div>
            )}

            <div
              className={cn(
                "bg-gradient-to-r p-6 text-white",
                tierItem.gradient
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <Icon className="w-8 h-8" />
                <h3 className="text-2xl font-bold">{config.name}</h3>
              </div>
              <div className="mb-2">
                <span className="text-5xl font-bold">${config.price}</span>
                {config.period !== "forever" && (
                  <span className="text-lg text-white/80">/{config.period}</span>
                )}
              </div>
              <p className="text-sm text-white/90">{config.description}</p>
            </div>

            <div className="p-6">
              <ul className="space-y-3 mb-6">
                {tierItem.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-5 h-5 text-neutral-300 flex-shrink-0 mt-0.5" />
                    )}
                    <span
                      className={cn(
                        "text-sm",
                        feature.included ? "text-neutral-900" : "text-neutral-400"
                      )}
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrentTier ? (
                <div className="w-full px-4 py-3 bg-neutral-100 text-neutral-900 rounded-lg text-center font-semibold">
                  Current Plan
                </div>
              ) : canUpgrade ? (
                <button
                  onClick={() => handleUpgrade(tierItem.id)}
                  disabled={isLoading}
                  className={cn(
                    "w-full px-4 py-3 bg-gradient-to-r text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50",
                    tierItem.gradient
                  )}
                >
                  Upgrade to {config.name}
                </button>
              ) : canDowngrade ? (
                <button
                  onClick={() => handleUpgrade("free")}
                  disabled={isLoading}
                  className="w-full px-4 py-3 border-2 border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-semibold disabled:opacity-50"
                >
                  Downgrade to Free
                </button>
              ) : (
                <div className="w-full px-4 py-3 bg-neutral-50 text-neutral-500 rounded-lg text-center font-semibold">
                  {tierItem.id === "pro" ? "Included in Current Plan" : "N/A"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
