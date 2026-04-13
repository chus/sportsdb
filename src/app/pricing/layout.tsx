import type { Metadata } from "next";

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
  return children;
}
