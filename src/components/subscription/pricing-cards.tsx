"use client";

import { useState } from "react";
import { Check, X, Crown, Zap, Sparkles, ChevronDown, Tag, Loader2 } from "lucide-react";
import { useSubscription } from "./subscription-provider";
import { SUBSCRIPTION_TIERS, SubscriptionTier } from "@/lib/subscriptions/tiers";
import { cn } from "@/lib/utils/cn";

interface PricingCardsProps {
  onUpgrade?: () => void;
}

export function PricingCards({ onUpgrade }: PricingCardsProps) {
  const { tier: currentTier, upgrade, downgrade, isLoading } = useSubscription();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount?: string;
    message?: string;
  } | null>(null);

  const tiers: {
    id: SubscriptionTier;
    icon: typeof Sparkles;
    gradient: string;
    popular?: boolean;
    bestValue?: boolean;
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
      id: "premium",
      icon: Crown,
      gradient: "from-purple-600 to-pink-600",
      bestValue: billingPeriod === "annual",
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
      await upgrade(tier as "pro" | "premium", billingPeriod);
    }
    onUpgrade?.();
  };

  const getDisplayPrice = (tier: SubscriptionTier) => {
    const config = SUBSCRIPTION_TIERS[tier];
    if (billingPeriod === "annual" && config.annualPrice) {
      return config.annualPrice;
    }
    return config.price;
  };

  const getMonthlyEquivalent = (tier: SubscriptionTier) => {
    const config = SUBSCRIPTION_TIERS[tier];
    if (billingPeriod === "annual" && config.annualPrice) {
      return (config.annualPrice / 12).toFixed(2);
    }
    return null;
  };

  const validatePromoCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setPromoResult(null);
      return;
    }
    setPromoValidating(true);
    setPromoResult(null);
    try {
      const res = await fetch(`/api/vouchers/validate?code=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoResult({ valid: true, discount: data.discount, message: data.message });
      } else {
        setPromoResult({ valid: false, message: data.message || "Invalid promo code" });
      }
    } catch {
      setPromoResult({ valid: false, message: "Could not validate code. Try again." });
    } finally {
      setPromoValidating(false);
    }
  };

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span
          className={cn(
            "text-sm font-medium transition-colors",
            billingPeriod === "monthly" ? "text-neutral-900" : "text-neutral-400"
          )}
        >
          Monthly
        </span>
        <button
          onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "annual" : "monthly")}
          className={cn(
            "relative w-14 h-7 rounded-full transition-colors",
            billingPeriod === "annual" ? "bg-green-600" : "bg-neutral-300"
          )}
        >
          <div
            className={cn(
              "absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform",
              billingPeriod === "annual" ? "translate-x-7" : "translate-x-0.5"
            )}
          />
        </button>
        <span
          className={cn(
            "text-sm font-medium transition-colors",
            billingPeriod === "annual" ? "text-neutral-900" : "text-neutral-400"
          )}
        >
          Annual
        </span>
        {billingPeriod === "annual" && (
          <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
            Save 33%
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {tiers.map((tierItem) => {
          const config = SUBSCRIPTION_TIERS[tierItem.id];
          const Icon = tierItem.icon;
          const isCurrentTier = currentTier === tierItem.id;
          const canUpgrade =
            (currentTier === "free" && tierItem.id !== "free") ||
            (currentTier === "pro" && tierItem.id === "premium");
          const canDowngrade =
            tierItem.id === "free" && currentTier !== "free";
          const displayPrice = getDisplayPrice(tierItem.id);
          const monthlyEquiv = getMonthlyEquivalent(tierItem.id);

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
              {tierItem.bestValue && (
                <div className="absolute top-0 left-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-1 text-xs font-bold rounded-br-lg">
                  BEST VALUE
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
                  {config.price === 0 ? (
                    <span className="text-5xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="text-5xl font-bold">
                        &euro;{displayPrice}
                      </span>
                      <span className="text-lg text-white/80">
                        /{billingPeriod === "annual" ? "year" : "month"}
                      </span>
                    </>
                  )}
                </div>
                {monthlyEquiv && billingPeriod === "annual" && (
                  <p className="text-sm text-white/70">
                    <span className="line-through">&euro;{config.price}/mo</span>
                    {" "}&rarr; &euro;{monthlyEquiv}/mo
                  </p>
                )}
                <p className="text-sm text-white/90 mt-1">{config.description}</p>
                {tierItem.id === "pro" && (
                  <p className="text-xs text-white/60 mt-2">Less than a coffee per month</p>
                )}
                {tierItem.id === "premium" && billingPeriod === "monthly" && (
                  <p className="text-xs text-white/60 mt-2">Less than a coffee per week</p>
                )}
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

      {/* Promo code section */}
      <div className="mt-10 max-w-md mx-auto">
        <button
          onClick={() => setShowPromoInput(!showPromoInput)}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors mx-auto"
        >
          <Tag className="w-4 h-4" />
          Have a promo code?
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              showPromoInput && "rotate-180"
            )}
          />
        </button>

        {showPromoInput && (
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setPromoResult(null);
                }}
                onBlur={() => validatePromoCode(promoCode)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") validatePromoCode(promoCode);
                }}
                placeholder="Enter promo code"
                className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => validatePromoCode(promoCode)}
                disabled={promoValidating || !promoCode.trim()}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {promoValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Apply"
                )}
              </button>
            </div>

            {promoResult && (
              <div
                className={cn(
                  "mt-3 px-4 py-3 rounded-lg text-sm flex items-start gap-2",
                  promoResult.valid
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                )}
              >
                {promoResult.valid ? (
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p>{promoResult.message}</p>
                  {promoResult.valid && promoResult.discount && (
                    <p className="font-semibold mt-1">
                      Discount: {promoResult.discount}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
