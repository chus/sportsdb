import { stripe } from "./index";
import type { SubscriptionTier } from "@/lib/subscriptions/tiers";

const TIER_PRICES: Record<
  "pro" | "ultimate",
  { name: string; amount: number; lookupKey: string }
> = {
  pro: {
    name: "SportsDB Pro",
    amount: 499, // $4.99 in cents
    lookupKey: "sportsdb_pro_monthly",
  },
  ultimate: {
    name: "SportsDB Ultimate",
    amount: 999, // $9.99 in cents
    lookupKey: "sportsdb_ultimate_monthly",
  },
};

/**
 * Get or create a Stripe Price for the given tier.
 * Uses lookup_key for idempotent retrieval.
 */
export async function getStripePriceId(
  tier: "pro" | "ultimate"
): Promise<string> {
  const config = TIER_PRICES[tier];

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
    metadata: { tier },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: config.amount,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: config.lookupKey,
  });

  return price.id;
}

export function tierFromPriceAmount(amount: number): SubscriptionTier | null {
  if (amount === 499) return "pro";
  if (amount === 999) return "ultimate";
  return null;
}
