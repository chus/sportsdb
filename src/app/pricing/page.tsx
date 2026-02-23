import { Metadata } from "next";
import { PricingPageContent } from "./pricing-content";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Choose your SportsDB plan. Free for casual fans, Pro for enthusiasts, Ultimate for power users.",
};

export default function PricingPage() {
  return <PricingPageContent />;
}
