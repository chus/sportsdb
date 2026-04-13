import type { Metadata } from "next";
import { BreadcrumbJsonLd, FAQJsonLd, JsonLd } from "@/components/seo/json-ld";
import { PageTracker } from "@/components/analytics/page-tracker";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://datasports.co";

export const metadata: Metadata = {
  title: "Pricing – Free & Pro Plans | DataSports",
  description:
    "Compare DataSports Free and Pro plans. Unlock advanced stats, unlimited comparisons, historical data, and more from €8/year.",
  openGraph: {
    title: "Pricing – Free & Pro Plans | DataSports",
    description:
      "Compare DataSports Free and Pro plans. Unlock advanced stats, unlimited comparisons, historical data, and more from €8/year.",
    url: `${BASE_URL}/pricing`,
  },
  alternates: { canonical: `${BASE_URL}/pricing` },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Pricing", url: `${BASE_URL}/pricing` },
        ]}
      />
      <FAQJsonLd
        items={[
          {
            question: "Can I cancel my subscription at any time?",
            answer: "Yes, you can cancel your subscription at any time. Your access will continue until the end of your current billing period.",
          },
          {
            question: "What payment methods do you accept?",
            answer: "We accept all major credit cards (Visa, Mastercard, American Express) and PayPal.",
          },
          {
            question: "Is there a free trial for Pro?",
            answer: "The Free tier gives you access to core features. Upgrade to Pro anytime to unlock advanced stats, unlimited comparisons, and more.",
          },
          {
            question: "What happens to my data if I downgrade?",
            answer: "Your data is always preserved. If you downgrade, you keep your follows (up to the free tier limit) and can still access basic features.",
          },
          {
            question: "Do you offer team or organization pricing?",
            answer: "Not yet, but we're working on it. Contact us if you're interested in a team plan.",
          },
        ]}
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: "DataSports Pro",
        description: "Premium football statistics platform with advanced stats, unlimited player comparisons, historical data, and priority support.",
        url: `${BASE_URL}/pricing`,
        brand: { "@type": "Organization", name: "DataSports" },
        offers: [
          {
            "@type": "Offer",
            name: "Free Plan",
            price: "0",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            description: "Core football data with basic stats and limited comparisons.",
          },
          {
            "@type": "Offer",
            name: "Pro Plan",
            price: "8",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            priceValidUntil: "2026-12-31",
            description: "Full access to advanced stats, unlimited comparisons, historical data, and export features.",
          },
        ],
      }} />
      <PageTracker />
      {children}
    </>
  );
}
