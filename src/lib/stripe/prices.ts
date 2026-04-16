import { stripe } from "./index";
import type { SubscriptionTier } from "@/lib/subscriptions/tiers";

export type BillingPeriod = "monthly" | "annual";

interface PriceConfig {
  name: string;
  amount: number; // in cents (EUR)
  lookupKey: string;
  interval: "month" | "year";
}

const TIER_PRICES: Record<"pro", Record<BillingPeriod, PriceConfig>> = {
  pro: {
    monthly: {
      name: "DataSports Pro (Monthly)",
      amount: 100, // €1.00
      lookupKey: "sportsdb_pro_monthly",
      interval: "month",
    },
    annual: {
      name: "DataSports Pro (Annual)",
      amount: 800, // €8.00
      lookupKey: "sportsdb_pro_annual",
      interval: "year",
    },
  },
};

/**
 * Get or create a Stripe Price for the given tier and billing period.
 * Uses lookup_key for idempotent retrieval.
 */
export async function getStripePriceId(
  tier: "pro",
  period: BillingPeriod = "monthly"
): Promise<string> {
  const config = TIER_PRICES[tier][period];

  // Try to find existing price by lookup key
  const existing = await stripe.prices.list({
    lookup_keys: [config.lookupKey],
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  // Create product and price
  const product = await stripe.products.create({
    name: config.name,
    metadata: { tier, period },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: config.amount,
    currency: "eur",
    recurring: { interval: config.interval },
    lookup_key: config.lookupKey,
  });

  return price.id;
}

export function tierFromLookupKey(lookupKey: string): { tier: SubscriptionTier; period: BillingPeriod } | null {
  for (const [tier, periods] of Object.entries(TIER_PRICES)) {
    for (const [period, config] of Object.entries(periods)) {
      if (config.lookupKey === lookupKey) {
        return { tier: tier as SubscriptionTier, period: period as BillingPeriod };
      }
    }
  }
  return null;
}

export function tierFromPriceAmount(amount: number): SubscriptionTier | null {
  if (amount === 100 || amount === 800) return "pro";
  return null;
}
